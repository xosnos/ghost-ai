import { createClient } from "@supabase/supabase-js";
import assert from "node:assert";

// ---------------------------------------------------------------------------
// Environment & Client Configuration
// ---------------------------------------------------------------------------
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "http://127.0.0.1:54321";

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Admin / Service Role client
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Unauthenticated / Anon client
const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Helper for pgmq_public RPC calls with service_role
async function callPgmqRpc(
  fn: string,
  body: Record<string, unknown>,
  clientToken: string = SERVICE_ROLE_KEY
): Promise<{ status: number; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: clientToken,
        Authorization: `Bearer ${clientToken}`,
        "Accept-Profile": "pgmq_public",
        "Content-Profile": "pgmq_public",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      return { status: res.status, data };
    }
    const errText = await res.text();
    return { status: res.status, error: errText };
  } catch (err: unknown) {
    return { status: 500, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Test Runner Harness
// ---------------------------------------------------------------------------
interface TestContext {
  passed: number;
  failed: number;
  errors: Array<{ title: string; error: unknown }>;
}

const ctx: TestContext = {
  passed: 0,
  failed: 0,
  errors: [],
};

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  • ${name} ... `);
  try {
    await fn();
    ctx.passed++;
    console.log("\x1b[32mPASSED\x1b[0m");
  } catch (err) {
    ctx.failed++;
    console.log("\x1b[31mFAILED\x1b[0m");
    ctx.errors.push({ title: name, error: err });
  }
}

// Track resources to clean up after test suite
const cleanupUserIds: string[] = [];
const cleanupProjectIds: string[] = [];
const cleanupTaskRunIds: string[] = [];

async function createTestUser(emailPrefix: string) {
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = "TestPassword123!";

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message || "unknown error"}`);
  }

  cleanupUserIds.push(data.user.id);

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !authData.session) {
    throw new Error(`Failed to sign in test user: ${signInError?.message}`);
  }

  return {
    user: data.user,
    token: authData.session.access_token,
    client,
  };
}

async function createTestProject(ownerId: string, name: string) {
  const { data, error } = await adminClient
    .from("projects")
    .insert({
      name,
      owner_id: ownerId,
    })
    .select("id, name, owner_id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test project: ${error?.message}`);
  }

  cleanupProjectIds.push(data.id);
  return data;
}

// ---------------------------------------------------------------------------
// Main Suite Execution
// ---------------------------------------------------------------------------
async function runSuite() {
  console.log("\n==================================================");
  console.log("  Spec 22 Database & Queue Integration Test Suite ");
  console.log("==================================================\n");

  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let collaborator: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let project: Awaited<ReturnType<typeof createTestProject>>;

  try {
    // 0. Setup test users and project
    owner = await createTestUser("spec22-owner");
    collaborator = await createTestUser("spec22-collab");
    outsider = await createTestUser("spec22-outsider");
    project = await createTestProject(owner.user.id, "Spec 22 Test Project");

    // Add collaborator to project
    const { error: collabError } = await adminClient
      .from("project_collaborators")
      .insert({
        project_id: project.id,
        email: collaborator.user.email,
      });
    if (collabError) {
      throw new Error(`Failed to add collaborator: ${collabError.message}`);
    }

    console.log("Setup complete:");
    console.log(`  - Project ID:      ${project.id}`);
    console.log(`  - Owner ID:        ${owner.user.id} (${owner.user.email})`);
    console.log(`  - Collaborator ID: ${collaborator.user.id} (${collaborator.user.email})`);
    console.log(`  - Outsider ID:     ${outsider.user.id} (${outsider.user.email})\n`);

    // =========================================================================
    // a. Grants & Permissions
    // =========================================================================
    console.log("\x1b[36m[a. Grants & Permissions]\x1b[0m");

    // Create a fixture run via adminClient for permission tests
    const fixtureCreated = new Date(Date.now() - 5000).toISOString();
    const fixtureCompleted = new Date().toISOString();
    const { data: fixtureRun, error: fixtureError } = await adminClient
      .from("task_runs")
      .insert({
        project_id: project.id,
        user_id: owner.user.id,
        kind: "design",
        status: "completed",
        attempt_count: 1,
        created_at: fixtureCreated,
        completed_at: fixtureCompleted,
      })
      .select()
      .single();
    if (fixtureError || !fixtureRun) {
      throw new Error(`Failed to insert fixture task run: ${fixtureError?.message}`);
    }
    cleanupTaskRunIds.push(fixtureRun.id);

    await test("Authenticated user can SELECT their project's task_runs", async () => {
      const { data, error } = await owner.client
        .from("task_runs")
        .select("*")
        .eq("id", fixtureRun.id);
      assert.strictEqual(error, null, `Expected no error, got ${error?.message}`);
      assert.strictEqual(data?.length, 1, "Expected 1 task run row returned");
      assert.strictEqual(data?.[0].id, fixtureRun.id);
    });

    await test("Authenticated user is DENIED direct INSERT on task_runs (42501)", async () => {
      const { error } = await owner.client
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "queued",
        });
      assert.ok(error, "Expected INSERT to fail with permission denied");
      assert.ok(
        error.code === "42501" || error.message.includes("permission denied"),
        `Expected error code 42501 or permission denied, got ${error.code}: ${error.message}`
      );
    });

    await test("Authenticated user is DENIED direct UPDATE on task_runs (42501)", async () => {
      const { error } = await owner.client
        .from("task_runs")
        .update({ status: "running" })
        .eq("id", fixtureRun.id);
      assert.ok(error, "Expected UPDATE to fail with permission denied");
      assert.ok(
        error.code === "42501" || error.message.includes("permission denied"),
        `Expected error code 42501 or permission denied, got ${error.code}: ${error.message}`
      );
    });

    await test("Authenticated user is DENIED direct DELETE on task_runs (42501)", async () => {
      const { error } = await owner.client
        .from("task_runs")
        .delete()
        .eq("id", fixtureRun.id);
      assert.ok(error, "Expected DELETE to fail with permission denied");
      assert.ok(
        error.code === "42501" || error.message.includes("permission denied"),
        `Expected error code 42501 or permission denied, got ${error.code}: ${error.message}`
      );
    });

    await test("Anon user is DENIED INSERT, UPDATE, DELETE on task_runs (42501)", async () => {
      const { error: insertErr } = await anonClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "queued",
        });
      assert.ok(insertErr, "Anon INSERT should fail");
      assert.ok(
        insertErr.code === "42501" || insertErr.message.includes("permission denied"),
        `Expected 42501 on anon insert, got ${insertErr.code}`
      );

      const { error: updateErr } = await anonClient
        .from("task_runs")
        .update({ status: "running" })
        .eq("id", fixtureRun.id);
      assert.ok(updateErr, "Anon UPDATE should fail");
      assert.ok(
        updateErr.code === "42501" || updateErr.message.includes("permission denied"),
        `Expected 42501 on anon update, got ${updateErr.code}`
      );

      const { error: deleteErr } = await anonClient
        .from("task_runs")
        .delete()
        .eq("id", fixtureRun.id);
      assert.ok(deleteErr, "Anon DELETE should fail");
      assert.ok(
        deleteErr.code === "42501" || deleteErr.message.includes("permission denied"),
        `Expected 42501 on anon delete, got ${deleteErr.code}`
      );
    });

    await test("Anon user receives 0 rows when attempting to SELECT task_runs", async () => {
      const { data, error } = await anonClient
        .from("task_runs")
        .select("*")
        .eq("id", fixtureRun.id);
      // Either RLS returns 0 rows or permission denied
      if (!error) {
        assert.strictEqual(data?.length, 0, "Anon should see 0 rows under RLS");
      } else {
        assert.ok(
          error.code === "42501" || error.message.includes("permission denied"),
          `Expected 42501 or 0 rows for anon SELECT, got ${error.code}: ${error.message}`
        );
      }
    });

    await test("Public, anon, authenticated cannot execute public.enqueue_task_run", async () => {
      // 1. Authenticated caller
      const { error: authRpcErr } = await owner.client.rpc("enqueue_task_run", {
        p_project_id: project.id,
        p_user_id: owner.user.id,
        p_kind: "design",
        p_input: { test: true },
      });
      assert.ok(authRpcErr, "Authenticated user should not be able to execute enqueue_task_run");
      assert.ok(
        authRpcErr.code === "42501" || authRpcErr.message.includes("permission denied"),
        `Expected 42501 on rpc execute for authenticated, got ${authRpcErr.code}: ${authRpcErr.message}`
      );

      // 2. Anon caller
      const { error: anonRpcErr } = await anonClient.rpc("enqueue_task_run", {
        p_project_id: project.id,
        p_user_id: owner.user.id,
        p_kind: "design",
        p_input: { test: true },
      });
      assert.ok(anonRpcErr, "Anon user should not be able to execute enqueue_task_run");
      assert.ok(
        anonRpcErr.code === "42501" ||
          anonRpcErr.message.includes("permission denied") ||
          anonRpcErr.message.includes("function") ||
          anonRpcErr.message.includes("not found"),
        `Expected permission denial for anon RPC, got ${anonRpcErr.code}: ${anonRpcErr.message}`
      );
    });

    await test("Public, anon, authenticated cannot execute pgmq_public functions", async () => {
      // Authenticated caller trying pgmq_public.read
      const authRes = await callPgmqRpc(
        "read",
        { queue_name: "ai-generation", sleep_seconds: 10, n: 1 },
        owner.token
      );
      assert.ok(
        authRes.status === 401 || authRes.status === 403 || authRes.status === 404 || authRes.error?.includes("permission denied"),
        `Expected pgmq_public.read to be forbidden for authenticated user, got status ${authRes.status}: ${authRes.error}`
      );

      // Anon caller trying pgmq_public.send
      const anonRes = await callPgmqRpc(
        "send",
        { queue_name: "ai-generation", message: { test: "unauthorized" } },
        ANON_KEY
      );
      assert.ok(
        anonRes.status === 401 || anonRes.status === 403 || anonRes.status === 404 || anonRes.error?.includes("permission denied"),
        `Expected pgmq_public.send to be forbidden for anon user, got status ${anonRes.status}: ${anonRes.error}`
      );
    });

    await test("service_role can execute enqueue_task_run and all queue functions", async () => {
      // 1. Enqueue task run via service_role RPC
      const { data: runId, error: enqueueErr } = await adminClient.rpc("enqueue_task_run", {
        p_project_id: project.id,
        p_user_id: owner.user.id,
        p_kind: "design",
        p_input: { prompt: "Test service role permissions" },
      });
      assert.strictEqual(enqueueErr, null, `service_role enqueue failed: ${enqueueErr?.message}`);
      assert.ok(typeof runId === "string" && runId.length > 0, "Expected returned run ID string");
      cleanupTaskRunIds.push(runId);

      // 2. Read message via pgmq_public.read RPC
      const readRes = await callPgmqRpc("read", {
        queue_name: "ai-generation",
        sleep_seconds: 30,
        n: 10,
      });
      assert.strictEqual(readRes.status, 200, `pgmq_public.read failed: ${readRes.error}`);
      const messages = readRes.data as Array<{ msg_id: number; message: { run_id: string } }>;
      const matchingMsg = messages.find((m) => m.message?.run_id === runId);
      assert.ok(matchingMsg, "Expected to find enqueued message in queue");

      // 3. Set visibility timeout via pgmq_public.set_vt
      const vtRes = await callPgmqRpc("set_vt", {
        queue_name: "ai-generation",
        message_id: matchingMsg.msg_id,
        sleep_seconds: 60,
      });
      assert.strictEqual(vtRes.status, 200, `pgmq_public.set_vt failed: ${vtRes.error}`);

      // 4. Archive message via pgmq_public.archive
      const archRes = await callPgmqRpc("archive", {
        queue_name: "ai-generation",
        message_id: matchingMsg.msg_id,
      });
      assert.strictEqual(archRes.status, 200, `pgmq_public.archive failed: ${archRes.error}`);

      // Clean up the task run so project is not blocked
      await adminClient.from("task_runs").delete().eq("id", runId);
    });

    // =========================================================================
    // b. RLS Policies
    // =========================================================================
    console.log("\n\x1b[36m[b. RLS Policies]\x1b[0m");

    await test("Project owner can SELECT task_runs for that project", async () => {
      const { data, error } = await owner.client
        .from("task_runs")
        .select("id, project_id, status")
        .eq("project_id", project.id);
      assert.strictEqual(error, null, `Owner query failed: ${error?.message}`);
      assert.ok((data?.length ?? 0) >= 1, "Owner should see at least 1 run row");
      assert.ok(data?.some((r) => r.id === fixtureRun.id));
    });

    await test("Project collaborator can SELECT task_runs for that project", async () => {
      const { data, error } = await collaborator.client
        .from("task_runs")
        .select("id, project_id, status")
        .eq("project_id", project.id);
      assert.strictEqual(error, null, `Collaborator query failed: ${error?.message}`);
      assert.ok((data?.length ?? 0) >= 1, "Collaborator should see at least 1 run row");
      assert.ok(data?.some((r) => r.id === fixtureRun.id));
    });

    await test("Non-collaborator authenticated user receives 0 rows when SELECTing another project's task_runs", async () => {
      const { data, error } = await outsider.client
        .from("task_runs")
        .select("id, project_id, status")
        .eq("project_id", project.id);
      assert.strictEqual(error, null, `Outsider query error: ${error?.message}`);
      assert.strictEqual(data?.length, 0, "Outsider should see 0 rows for other user's project");
    });

    // =========================================================================
    // c. Constraints & Timestamps
    // =========================================================================
    console.log("\n\x1b[36m[c. Constraints & Timestamps]\x1b[0m");

    await test("Valid kinds ('design', 'spec') and statuses are accepted", async () => {
      const created = new Date(Date.now() - 5000).toISOString();
      const completed = new Date().toISOString();

      const { data: r1, error: e1 } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "completed",
          created_at: created,
          completed_at: completed,
        })
        .select("id")
        .single();
      assert.strictEqual(e1, null, `design completed run insert failed: ${e1?.message}`);
      if (r1) cleanupTaskRunIds.push(r1.id);

      const { data: r2, error: e2 } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "spec",
          status: "failed",
          created_at: created,
          completed_at: completed,
          error_message: "Intentional test failure",
        })
        .select("id")
        .single();
      assert.strictEqual(e2, null, `spec failed run insert failed: ${e2?.message}`);
      if (r2) cleanupTaskRunIds.push(r2.id);
    });

    await test("Invalid kind is REJECTED by CHECK constraint", async () => {
      const { error } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "invalid_kind",
          status: "queued",
        });
      assert.ok(error, "Expected invalid kind to be rejected");
      assert.ok(
        error.code === "23514" || error.message.includes("check constraint"),
        `Expected check constraint 23514, got ${error.code}: ${error.message}`
      );
    });

    await test("Invalid status is REJECTED by CHECK constraint", async () => {
      const { error } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "invalid_status",
        });
      assert.ok(error, "Expected invalid status to be rejected");
      assert.ok(
        error.code === "23514" || error.message.includes("check constraint"),
        `Expected check constraint 23514, got ${error.code}: ${error.message}`
      );
    });

    await test("Negative attempt_count is REJECTED (attempt_count >= 0)", async () => {
      const { error } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "queued",
          attempt_count: -1,
        });
      assert.ok(error, "Expected negative attempt_count to be rejected");
      assert.ok(
        error.code === "23514" || error.message.includes("check constraint"),
        `Expected check constraint 23514, got ${error.code}: ${error.message}`
      );
    });

    await test("Terminal status ('completed', 'failed') REQUIRES non-null completed_at", async () => {
      // 1. completed with null completed_at
      const { error: eCompleted } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "completed",
          completed_at: null,
        });
      assert.ok(eCompleted, "completed status without completed_at must be rejected");
      assert.ok(
        eCompleted.code === "23514" || eCompleted.message.includes("task_runs_terminal_timestamps_check"),
        `Expected task_runs_terminal_timestamps_check violation, got ${eCompleted.code}: ${eCompleted.message}`
      );

      // 2. failed with null completed_at
      const { error: eFailed } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "spec",
          status: "failed",
          completed_at: null,
        });
      assert.ok(eFailed, "failed status without completed_at must be rejected");
      assert.ok(
        eFailed.code === "23514" || eFailed.message.includes("task_runs_terminal_timestamps_check"),
        `Expected task_runs_terminal_timestamps_check violation, got ${eFailed.code}: ${eFailed.message}`
      );
    });

    await test("Active status ('queued', 'running', 'retrying') FORBIDS completed_at", async () => {
      const now = new Date().toISOString();

      // 1. queued with completed_at set
      const { error: eQueued } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "queued",
          completed_at: now,
        });
      assert.ok(eQueued, "queued status with completed_at must be rejected");
      assert.ok(
        eQueued.code === "23514" || eQueued.message.includes("task_runs_terminal_timestamps_check"),
        `Expected task_runs_terminal_timestamps_check violation, got ${eQueued.code}: ${eQueued.message}`
      );

      // 2. running with completed_at set
      const { error: eRunning } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "running",
          started_at: now,
          completed_at: now,
        });
      assert.ok(eRunning, "running status with completed_at must be rejected");
      assert.ok(
        eRunning.code === "23514" || eRunning.message.includes("task_runs_terminal_timestamps_check"),
        `Expected task_runs_terminal_timestamps_check violation, got ${eRunning.code}: ${eRunning.message}`
      );

      // 3. retrying with completed_at set
      const { error: eRetrying } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "retrying",
          completed_at: now,
        });
      assert.ok(eRetrying, "retrying status with completed_at must be rejected");
      assert.ok(
        eRetrying.code === "23514" || eRetrying.message.includes("task_runs_terminal_timestamps_check"),
        `Expected task_runs_terminal_timestamps_check violation, got ${eRetrying.code}: ${eRetrying.message}`
      );
    });

    await test("completed_at >= started_at and completed_at >= created_at checks", async () => {
      const created = new Date("2026-08-17T12:00:00Z").toISOString();
      const started = new Date("2026-08-17T12:05:00Z").toISOString();
      const invalidCompleted = new Date("2026-08-17T12:02:00Z").toISOString(); // Earlier than started!

      const { error } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "completed",
          created_at: created,
          started_at: started,
          completed_at: invalidCompleted,
        });
      assert.ok(error, "completed_at < started_at must be rejected");
      assert.ok(
        error.code === "23514" || error.message.includes("task_runs_terminal_timestamps_check"),
        `Expected task_runs_terminal_timestamps_check, got ${error.code}: ${error.message}`
      );
    });

    // =========================================================================
    // d. Partial Unique Index
    // =========================================================================
    console.log("\n\x1b[36m[d. Partial Unique Index]\x1b[0m");

    await test("Only 1 active run allowed per project; 2nd active run raises unique_violation (23505)", async () => {
      // 1. Insert 1st active run
      const { data: run1, error: err1 } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "queued",
        })
        .select("id")
        .single();
      assert.strictEqual(err1, null, `1st active run insert failed: ${err1?.message}`);
      assert.ok(run1, "Run 1 must exist");
      cleanupTaskRunIds.push(run1.id);

      // 2. Attempt 2nd active run for same project (status 'running')
      const { error: err2Running } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "spec",
          status: "running",
          created_at: new Date(Date.now() - 1000).toISOString(),
          started_at: new Date().toISOString(),
        });
      assert.ok(err2Running, "2nd active run ('running') should fail unique constraint");
      assert.strictEqual(
        err2Running.code,
        "23505",
        `Expected Postgres code 23505, got ${err2Running.code}: ${err2Running.message}`
      );
      assert.ok(
        err2Running.message.includes("task_runs_active_project_idx") ||
          err2Running.message.includes("duplicate key"),
        `Expected task_runs_active_project_idx conflict, got ${err2Running.message}`
      );

      // 3. Attempt 2nd active run for same project (status 'retrying')
      const { error: err2Retrying } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "retrying",
        });
      assert.ok(err2Retrying, "2nd active run ('retrying') should fail unique constraint");
      assert.strictEqual(err2Retrying.code, "23505");

      // Clean up 1st active run
      await adminClient.from("task_runs").delete().eq("id", run1.id);
    });

    await test("Multiple terminal runs ('completed', 'failed') for the same project are permitted", async () => {
      const created = new Date(Date.now() - 5000).toISOString();
      const completed = new Date().toISOString();

      const { data: term1, error: e1 } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "completed",
          created_at: created,
          completed_at: completed,
        })
        .select("id")
        .single();
      assert.strictEqual(e1, null, `1st terminal run failed: ${e1?.message}`);
      if (term1) cleanupTaskRunIds.push(term1.id);

      const { data: term2, error: e2 } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "design",
          status: "completed",
          created_at: created,
          completed_at: completed,
        })
        .select("id")
        .single();
      assert.strictEqual(e2, null, `2nd terminal run failed: ${e2?.message}`);
      if (term2) cleanupTaskRunIds.push(term2.id);

      const { data: term3, error: e3 } = await adminClient
        .from("task_runs")
        .insert({
          project_id: project.id,
          user_id: owner.user.id,
          kind: "spec",
          status: "failed",
          created_at: created,
          completed_at: completed,
          error_message: "Terminal error",
        })
        .select("id")
        .single();
      assert.strictEqual(e3, null, `3rd terminal run failed: ${e3?.message}`);
      if (term3) cleanupTaskRunIds.push(term3.id);
    });

    // =========================================================================
    // e. Transactional Enqueueing (`public.enqueue_task_run`)
    // =========================================================================
    console.log("\n\x1b[36m[e. Transactional Enqueueing]\x1b[0m");

    // Ensure no active runs remain on project before enqueueing tests
    await adminClient
      .from("task_runs")
      .delete()
      .eq("project_id", project.id)
      .in("status", ["queued", "running", "retrying"]);

    await test("enqueue_task_run atomically creates task_runs row and queue message", async () => {
      const testPrompt = "Generate modern dashboard layout";
      const { data: runId, error: enqueueErr } = await adminClient.rpc("enqueue_task_run", {
        p_project_id: project.id,
        p_user_id: owner.user.id,
        p_kind: "design",
        p_input: { prompt: testPrompt, roomId: project.id },
      });

      assert.strictEqual(enqueueErr, null, `Enqueue failed: ${enqueueErr?.message}`);
      assert.ok(runId && typeof runId === "string", "Expected runId string returned");
      cleanupTaskRunIds.push(runId);

      // Verify DB row
      const { data: runRow, error: runRowErr } = await adminClient
        .from("task_runs")
        .select("*")
        .eq("id", runId)
        .single();
      assert.strictEqual(runRowErr, null, `Fetch task run failed: ${runRowErr?.message}`);
      assert.strictEqual(runRow.project_id, project.id);
      assert.strictEqual(runRow.user_id, owner.user.id);
      assert.strictEqual(runRow.kind, "design");
      assert.strictEqual(runRow.status, "queued");
      assert.strictEqual(runRow.attempt_count, 0);
      assert.strictEqual(runRow.completed_at, null);

      // Verify queue message in 'ai-generation'
      const readRes = await callPgmqRpc("read", {
        queue_name: "ai-generation",
        sleep_seconds: 30,
        n: 10,
      });
      assert.strictEqual(readRes.status, 200);
      const messages = readRes.data as Array<{
        msg_id: number;
        message: { run_id: string; kind: string; project_id: string; input: { prompt: string } };
      }>;
      const foundMsg = messages.find((m) => m.message?.run_id === runId);
      assert.ok(foundMsg, `Expected queue message for run ${runId}`);
      assert.strictEqual(foundMsg.message.kind, "design");
      assert.strictEqual(foundMsg.message.project_id, project.id);
      assert.strictEqual(foundMsg.message.input.prompt, testPrompt);

      // Archive message
      await callPgmqRpc("archive", {
        queue_name: "ai-generation",
        message_id: foundMsg.msg_id,
      });

      // Keep run active for conflict test below
    });

    await test("enqueue_task_run fails with unique_violation if project already has active run", async () => {
      // The previous test created an active run that is still in 'queued' state for project.id
      const { data, error } = await adminClient.rpc("enqueue_task_run", {
        p_project_id: project.id,
        p_user_id: owner.user.id,
        p_kind: "design",
        p_input: { prompt: "Conflicting prompt" },
      });

      assert.strictEqual(data, null, "Should return null on conflict");
      assert.ok(error, "Expected enqueue conflict error");
      assert.strictEqual(
        error.code,
        "23505",
        `Expected code 23505 unique_violation, got ${error.code}: ${error.message}`
      );
      assert.ok(
        error.message.includes("task_runs_active_project_idx") ||
          error.message.includes("duplicate key"),
        `Expected active project constraint message, got ${error.message}`
      );
    });

    // =========================================================================
    // f. Retry & Lifecycle Transitions
    // =========================================================================
    console.log("\n\x1b[36m[f. Retry & Lifecycle Transitions]\x1b[0m");

    await test("Full lifecycle transition: queued -> running -> retrying -> running -> completed", async () => {
      // Find the active run from earlier
      const { data: activeRun, error: fetchErr } = await adminClient
        .from("task_runs")
        .select("id")
        .eq("project_id", project.id)
        .eq("status", "queued")
        .single();
      assert.strictEqual(fetchErr, null);
      const runId = activeRun.id;

      // 1. Transition to 'running' (attempt 1)
      const startedAt = new Date().toISOString();
      const { error: eRunning1 } = await adminClient
        .from("task_runs")
        .update({
          status: "running",
          attempt_count: 1,
          started_at: startedAt,
          updated_at: startedAt,
        })
        .eq("id", runId);
      assert.strictEqual(eRunning1, null, `Running 1 update failed: ${eRunning1?.message}`);

      // 2. Transition to 'retrying' after transient failure
      const retryAt = new Date().toISOString();
      const { error: eRetrying } = await adminClient
        .from("task_runs")
        .update({
          status: "retrying",
          error_message: "Transient AI gateway 503",
          updated_at: retryAt,
        })
        .eq("id", runId);
      assert.strictEqual(eRetrying, null, `Retrying update failed: ${eRetrying?.message}`);

      // 3. Transition back to 'running' (attempt 2)
      const running2At = new Date().toISOString();
      const { error: eRunning2 } = await adminClient
        .from("task_runs")
        .update({
          status: "running",
          attempt_count: 2,
          error_message: null,
          updated_at: running2At,
        })
        .eq("id", runId);
      assert.strictEqual(eRunning2, null, `Running 2 update failed: ${eRunning2?.message}`);

      // 4. Transition to 'completed' with completed_at
      const completedAt = new Date().toISOString();
      const { error: eCompleted } = await adminClient
        .from("task_runs")
        .update({
          status: "completed",
          completed_at: completedAt,
          updated_at: completedAt,
        })
        .eq("id", runId);
      assert.strictEqual(eCompleted, null, `Completed update failed: ${eCompleted?.message}`);

      // Verify final DB state
      const { data: finalRow } = await adminClient
        .from("task_runs")
        .select("*")
        .eq("id", runId)
        .single();
      assert.strictEqual(finalRow?.status, "completed");
      assert.strictEqual(finalRow?.attempt_count, 2);
      assert.ok(finalRow?.completed_at != null);
      assert.ok(new Date(finalRow!.completed_at) >= new Date(finalRow!.started_at!));

      // Now that the run is completed, verify project can accept a new active run!
      const { data: newRunId, error: newRunErr } = await adminClient.rpc("enqueue_task_run", {
        p_project_id: project.id,
        p_user_id: owner.user.id,
        p_kind: "spec",
        p_input: { prompt: "Next spec generation" },
      });
      assert.strictEqual(newRunErr, null, `Expected project to allow new run after completion: ${newRunErr?.message}`);
      assert.ok(newRunId);
      cleanupTaskRunIds.push(newRunId);

      // Clean up queue message
      const queueRes = await callPgmqRpc("read", {
        queue_name: "ai-generation",
        sleep_seconds: 30,
        n: 10,
      });
      const msgs = (queueRes.data as Array<{ msg_id: number; message: { run_id: string } }>) || [];
      const msg = msgs.find((m) => m.message?.run_id === newRunId);
      if (msg) {
        await callPgmqRpc("archive", {
          queue_name: "ai-generation",
          message_id: msg.msg_id,
        });
      }
    });

    await test("Failed lifecycle transition: queued -> running -> failed with completed_at set", async () => {
      // Find the active run from previous step
      const { data: activeRun, error: fetchErr } = await adminClient
        .from("task_runs")
        .select("id")
        .eq("project_id", project.id)
        .eq("status", "queued")
        .single();
      assert.strictEqual(fetchErr, null);
      const runId = activeRun.id;

      // Update to running then failed
      const now = new Date().toISOString();
      await adminClient
        .from("task_runs")
        .update({
          status: "running",
          attempt_count: 3,
          started_at: now,
        })
        .eq("id", runId);

      const failedAt = new Date().toISOString();
      const { error: failErr } = await adminClient
        .from("task_runs")
        .update({
          status: "failed",
          completed_at: failedAt,
          error_message: "Permanent validation failure",
          updated_at: failedAt,
        })
        .eq("id", runId);
      assert.strictEqual(failErr, null, `Failed update failed: ${failErr?.message}`);

      // Verify row state
      const { data: failedRow } = await adminClient
        .from("task_runs")
        .select("*")
        .eq("id", runId)
        .single();
      assert.strictEqual(failedRow?.status, "failed");
      assert.strictEqual(failedRow?.error_message, "Permanent validation failure");
      assert.ok(failedRow?.completed_at != null);
    });

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    console.log("\n\x1b[90m[Cleaning up test artifacts...]\x1b[0m");

    for (const runId of cleanupTaskRunIds) {
      await adminClient.from("task_runs").delete().eq("id", runId);
    }
    for (const projId of cleanupProjectIds) {
      await adminClient.from("projects").delete().eq("id", projId);
    }
    for (const userId of cleanupUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
    console.log("\x1b[90mCleanup finished.\x1b[0m");
  }

  // Summary
  console.log("\n--------------------------------------------------");
  console.log(
    `Test Results: ${ctx.passed} Passed, ${ctx.failed} Failed (Total: ${ctx.passed + ctx.failed})`
  );
  console.log("--------------------------------------------------\n");

  if (ctx.failed > 0) {
    console.error("\x1b[31mFailures:\x1b[0m");
    for (const failure of ctx.errors) {
      console.error(`- \x1b[1m${failure.title}\x1b[0m:`, failure.error);
    }
    process.exit(1);
  } else {
    console.log("\x1b[32mAll database and queue integration tests passed successfully!\x1b[0m\n");
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error("Fatal error during test run:", err);
  process.exit(1);
});
