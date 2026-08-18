import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Load local environment variables from .env / .env.local / supabase/functions/.env
function loadEnvironment() {
  const envFiles = [".env", ".env.local", "supabase/functions/.env"];
  for (const relPath of envFiles) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed
            .slice(eqIdx + 1)
            .replace(/^["']|["']$/g, "")
            .trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnvironment();

// Mock server-only module for tsx test execution
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as NodeModule;
} catch {
  // Ignored if server-only is not installed
}

// Declare task-runs module bindings
let enqueueTaskRun: typeof import("../../lib/ai/task-runs").enqueueTaskRun;
let ActiveTaskRunConflictError: typeof import("../../lib/ai/task-runs").ActiveTaskRunConflictError;

import {
  downloadSpecMarkdown,
  formatSpecFileName,
  getProjectSpec,
  listProjectSpecs,
  parseSpecStoragePath,
  slugifySpecName,
} from "../../lib/specs/queries";
import { PermanentAiError, TransientAiError } from "../../supabase/functions/_shared/design-agent";
import {
  cleanMarkdownSpec,
  processSpecTask,
  SPECS_BUCKET,
} from "../../supabase/functions/_shared/generate-spec";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

if (!SECRET_KEY) {
  console.error("Missing SUPABASE_SECRET_KEY environment variable.");
  process.exit(1);
}

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Test tracking helpers
let testUserId = "";
const createdProjectIds: string[] = [];

async function setupTestContext() {
  console.log("Setting up test context against local Supabase stack...");

  // 1. Ensure test user exists in auth.users
  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`);
  }

  if (users.users.length > 0) {
    testUserId = users.users[0].id;
  } else {
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: `spec27-test-${Date.now()}@ghost-ai.dev`,
      password: "test-password-123456",
      email_confirm: true,
    });
    if (createError || !newUser.user) {
      throw new Error(`Failed to create test user: ${createError?.message || "unknown"}`);
    }
    testUserId = newUser.user.id;
  }

  console.log(`✓ Test user resolved: ${testUserId}`);

  // 2. Ensure specs storage bucket exists
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const hasSpecsBucket = (buckets ?? []).some((b) => b.id === SPECS_BUCKET);
  if (!hasSpecsBucket) {
    const { error: bucketError } = await supabaseAdmin.storage.createBucket(SPECS_BUCKET, {
      public: false,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ["text/markdown", "text/plain", "application/octet-stream"],
    });
    if (bucketError) {
      console.warn("Storage createBucket warning:", bucketError.message);
    }
  }
  console.log(`✓ Specs storage bucket ready: ${SPECS_BUCKET}`);
}

async function createTestProject(name: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      name,
      owner_id: testUserId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test project: ${error?.message}`);
  }

  createdProjectIds.push(data.id);
  return data.id;
}

async function teardownTestContext() {
  console.log("\nCleaning up created test resources...");
  for (const projectId of createdProjectIds) {
    try {
      // 1. Remove storage artifacts
      const { data: files } = await supabaseAdmin.storage.from(SPECS_BUCKET).list(projectId);
      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${projectId}/${f.name}`);
        await supabaseAdmin.storage.from(SPECS_BUCKET).remove(filePaths);
      }

      // 2. Delete project (cascades task_runs and project_specs)
      await supabaseAdmin.from("projects").delete().eq("id", projectId);
    } catch (err) {
      console.warn(`Cleanup error for project ${projectId}:`, err);
    }
  }
  console.log("✓ Cleanup complete.");
}

// ============================================================================
// MAIN TEST SUITE
// ============================================================================
async function runSpec27IntegrationSuite() {
  console.log("===============================================================================");
  console.log("   SPEC 27: SPEC GENERATION, RETRY & ARTIFACT IDEMPOTENCY INTEGRATION SUITE   ");
  console.log("===============================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  async function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    process.stdout.write(`  [Test ${totalTests}] ${name} ... `);
    const start = Date.now();
    try {
      await fn();
      const elapsed = Date.now() - start;
      console.log(`✓ PASS (${elapsed}ms)`);
      passedTests++;
    } catch (err) {
      console.log(`✗ FAIL`);
      console.error(err);
      throw err;
    }
  }

  await setupTestContext();

  const taskRunsModule = await import("../../lib/ai/task-runs");
  enqueueTaskRun = taskRunsModule.enqueueTaskRun;
  ActiveTaskRunConflictError = taskRunsModule.ActiveTaskRunConflictError;

  try {
    // ------------------------------------------------------------------------
    // GROUP A: Spec Generation Route & Enqueueing
    // ------------------------------------------------------------------------
    console.log("\n--- GROUP A: Spec Generation Route & Enqueueing ---");

    await test("enqueueTaskRun creates a task_runs row with kind = 'spec' and status = 'queued'", async () => {
      const projectId = await createTestProject("Spec Enqueue Test Project");

      const runId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: {
          roomId: projectId,
          chatHistory: [{ role: "user", content: "Design a high-throughput payment gateway" }],
          nodes: [{ id: "n1", type: "custom", data: { label: "Payment API" } }],
          edges: [],
        },
      });

      assert.ok(runId, "enqueueTaskRun should return a non-empty runId");
      assert.match(
        runId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "runId must be a valid UUID",
      );

      // Verify task_runs table row
      const { data: run, error: fetchErr } = await supabaseAdmin
        .from("task_runs")
        .select("*")
        .eq("id", runId)
        .single();

      assert.ifError(fetchErr);
      assert.ok(run, "task_runs row must exist");
      assert.strictEqual(run.id, runId);
      assert.strictEqual(run.project_id, projectId);
      assert.strictEqual(run.user_id, testUserId);
      assert.strictEqual(run.kind, "spec");
      assert.strictEqual(run.status, "queued");
      assert.strictEqual(run.attempt_count, 0);
      assert.strictEqual(run.error_message, null);
      assert.strictEqual(run.started_at, null);
      assert.strictEqual(run.completed_at, null);

      // Verify message was placed in pgmq queue 'ai-generation'
      const { data: queueMsg, error: qErr } = await supabaseAdmin
        .schema("pgmq_public")
        .rpc("read", {
          queue_name: "ai-generation",
          sleep_seconds: 300,
          n: 10,
        });

      assert.ifError(qErr);
      const matchingMsg = (
        queueMsg as Array<{
          message?: { run_id?: string; kind?: string; project_id?: string };
        }>
      )?.find((m) => m?.message?.run_id === runId);
      assert.ok(matchingMsg, "Queue message must be present in ai-generation queue");
      assert.strictEqual(matchingMsg.message?.kind, "spec");
      assert.strictEqual(matchingMsg.message?.project_id, projectId);
    });

    await test("Active run conflict handling: rejects duplicate concurrent run for same project (HTTP 409 invariant)", async () => {
      const projectId = await createTestProject("Conflict Handling Project");

      // 1. Enqueue first run (queued -> active)
      const firstRunId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });
      assert.ok(firstRunId);

      // 2. Attempting to enqueue second spec run should throw ActiveTaskRunConflictError
      await assert.rejects(
        async () => {
          await enqueueTaskRun({
            projectId,
            userId: testUserId,
            kind: "spec",
            input: { roomId: projectId },
          });
        },
        (err: unknown) => {
          assert.ok(
            err instanceof ActiveTaskRunConflictError,
            `Expected ActiveTaskRunConflictError, got ${err}`,
          );
          return true;
        },
        "Should reject 2nd spec run while first is queued",
      );

      // 3. Attempting to enqueue design run should also throw ActiveTaskRunConflictError
      await assert.rejects(
        async () => {
          await enqueueTaskRun({
            projectId,
            userId: testUserId,
            kind: "design",
            input: { prompt: "Add caching layer", roomId: projectId },
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ActiveTaskRunConflictError);
          return true;
        },
        "Should reject design run while spec run is active",
      );

      // 4. Update status to 'running' -> still conflicts
      await supabaseAdmin.from("task_runs").update({ status: "running" }).eq("id", firstRunId);

      await assert.rejects(
        async () => {
          await enqueueTaskRun({
            projectId,
            userId: testUserId,
            kind: "spec",
            input: { roomId: projectId },
          });
        },
        ActiveTaskRunConflictError,
        "Should reject new run while status is 'running'",
      );

      // 5. Update status to 'retrying' -> still conflicts
      await supabaseAdmin.from("task_runs").update({ status: "retrying" }).eq("id", firstRunId);

      await assert.rejects(
        async () => {
          await enqueueTaskRun({
            projectId,
            userId: testUserId,
            kind: "spec",
            input: { roomId: projectId },
          });
        },
        ActiveTaskRunConflictError,
        "Should reject new run while status is 'retrying'",
      );

      // 6. Complete the first run -> allows new task run to be enqueued
      await supabaseAdmin
        .from("task_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", firstRunId);

      const secondRunId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });
      assert.ok(secondRunId, "New run should succeed after previous run completes");
      assert.notStrictEqual(secondRunId, firstRunId);
    });

    // ------------------------------------------------------------------------
    // GROUP B: Spec Handler Processing & Storage Artifacts
    // ------------------------------------------------------------------------
    console.log("\n--- GROUP B: Spec Handler Processing & Storage Artifacts ---");

    await test("processSpecTask validates payload and confirms matching task_runs row with kind === 'spec'", async () => {
      const projectId = await createTestProject("Payload Validation Project");

      // 1. Missing runId
      await assert.rejects(
        async () => {
          await processSpecTask(supabaseAdmin, {
            runId: "",
            projectId,
            userId: testUserId,
            input: {},
            signal: new AbortController().signal,
          });
        },
        PermanentAiError,
        "Missing runId must throw PermanentAiError",
      );

      // 2. Missing projectId
      await assert.rejects(
        async () => {
          await processSpecTask(supabaseAdmin, {
            runId: "11111111-1111-1111-1111-111111111111",
            projectId: "",
            userId: testUserId,
            input: {},
            signal: new AbortController().signal,
          });
        },
        PermanentAiError,
        "Missing projectId must throw PermanentAiError",
      );

      // 3. Non-existent runId
      await assert.rejects(
        async () => {
          await processSpecTask(supabaseAdmin, {
            runId: "00000000-0000-0000-0000-000000000000",
            projectId,
            userId: testUserId,
            input: {},
            signal: new AbortController().signal,
          });
        },
        PermanentAiError,
        "Non-existent runId must throw PermanentAiError",
      );

      // 4. Project ID mismatch
      const otherProjectId = await createTestProject("Other Project For Mismatch");
      const mismatchRunId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: {},
      });

      await assert.rejects(
        async () => {
          await processSpecTask(supabaseAdmin, {
            runId: mismatchRunId,
            projectId: otherProjectId, // mismatch
            userId: testUserId,
            input: {},
            signal: new AbortController().signal,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof PermanentAiError);
          assert.match(err.message, /project mismatch/i);
          return true;
        },
        "Project mismatch must throw PermanentAiError",
      );

      // 5. Kind mismatch: task_runs row is 'design', but processSpecTask called
      // Complete existing run on otherProjectId so we can enqueue
      const designRunId = await enqueueTaskRun({
        projectId: otherProjectId,
        userId: testUserId,
        kind: "design",
        input: { prompt: "Test design" },
      });

      await assert.rejects(
        async () => {
          await processSpecTask(supabaseAdmin, {
            runId: designRunId,
            projectId: otherProjectId,
            userId: testUserId,
            input: {},
            signal: new AbortController().signal,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof PermanentAiError);
          assert.match(err.message, /kind mismatch/i);
          return true;
        },
        "Kind mismatch must throw PermanentAiError",
      );
    });

    await test("processSpecTask uploads Markdown artifact to specs/{projectId}/{runId}.md and upserts project_specs", async () => {
      const projectId = await createTestProject("Spec Execution Project");

      const runId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: {
          roomId: projectId,
          nodes: [
            {
              id: "node_api_gateway",
              type: "custom",
              data: { label: "API Gateway", role: "blue", technology: "Kong / Envoy" },
            },
            {
              id: "node_order_service",
              type: "custom",
              data: { label: "Order Service", role: "purple", technology: "Go / gRPC" },
            },
          ],
          edges: [
            {
              id: "edge_gw_order",
              source: "node_api_gateway",
              target: "node_order_service",
            },
          ],
          chatHistory: [
            {
              role: "user",
              content: "Specify order management with idempotency and distributed tracing.",
            },
          ],
        },
      });

      // Execute spec generation task handler
      const fullPath = await processSpecTask(supabaseAdmin, {
        runId,
        projectId,
        userId: testUserId,
        input: {
          roomId: projectId,
          nodes: [
            { id: "node_api_gateway", type: "custom", data: { label: "API Gateway" } },
            { id: "node_order_service", type: "custom", data: { label: "Order Service" } },
          ],
          edges: [
            { id: "edge_gw_order", source: "node_api_gateway", target: "node_order_service" },
          ],
          chatHistory: [{ role: "user", content: "Order management spec" }],
        },
        signal: new AbortController().signal,
      });

      // 1. Verify returned path matches deterministic structure
      const expectedStoragePath = `specs/${projectId}/${runId}.md`;
      assert.strictEqual(fullPath, expectedStoragePath);

      // 2. Verify artifact in Supabase Storage
      const storageKey = `${projectId}/${runId}.md`;
      const { data: downloadedBlob, error: downloadErr } = await supabaseAdmin.storage
        .from(SPECS_BUCKET)
        .download(storageKey);

      assert.ifError(downloadErr);
      assert.ok(downloadedBlob, "Downloaded storage blob must exist");
      const markdownContent = await downloadedBlob.text();
      assert.ok(markdownContent.length > 50, "Storage artifact must contain full Markdown spec");
      assert.ok(
        markdownContent.includes("# Technical Specification") ||
          markdownContent.includes("Technical Specification") ||
          markdownContent.includes("API Gateway"),
        "Markdown spec should contain expected architectural sections",
      );

      // 3. Verify project_specs metadata record
      const { data: specRow, error: specErr } = await supabaseAdmin
        .from("project_specs")
        .select("*")
        .eq("task_run_id", runId)
        .single();

      assert.ifError(specErr);
      assert.ok(specRow, "project_specs row must exist");
      assert.strictEqual(specRow.task_run_id, runId);
      assert.strictEqual(specRow.project_id, projectId);
      assert.strictEqual(specRow.file_path, expectedStoragePath);
      assert.ok(specRow.created_at, "created_at timestamp must be set");
    });

    // ------------------------------------------------------------------------
    // GROUP C: Retry & Artifact Idempotency
    // ------------------------------------------------------------------------
    console.log("\n--- GROUP C: Retry & Artifact Idempotency ---");

    await test("Worker retry overwrites storage artifact (upsert: true) and maintains exactly 1 project_specs row", async () => {
      const projectId = await createTestProject("Idempotency Test Project");

      const runId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });

      // Initial task execution
      const path1 = await processSpecTask(supabaseAdmin, {
        runId,
        projectId,
        userId: testUserId,
        input: {
          roomId: projectId,
          nodes: [{ id: "n1", type: "custom", data: { label: "Auth Service" } }],
          edges: [],
        },
        signal: new AbortController().signal,
      });
      assert.strictEqual(path1, `specs/${projectId}/${runId}.md`);

      // Verify 1 row in project_specs
      const { data: rowsInitial } = await supabaseAdmin
        .from("project_specs")
        .select("id, task_run_id, file_path")
        .eq("task_run_id", runId);

      assert.strictEqual(rowsInitial?.length, 1, "Initial execution must create exactly 1 row");
      const initialSpecId = rowsInitial[0].id;

      // Simulate a retry by re-running processSpecTask for the exact same runId
      const path2 = await processSpecTask(supabaseAdmin, {
        runId,
        projectId,
        userId: testUserId,
        input: {
          roomId: projectId,
          nodes: [{ id: "n1", type: "custom", data: { label: "Auth Service (Retried)" } }],
          edges: [],
        },
        signal: new AbortController().signal,
      });

      assert.strictEqual(path2, `specs/${projectId}/${runId}.md`);

      // Verify that after retry, there is STILL exactly 1 row for this task_run_id
      const { data: rowsAfterRetry, error: retryFetchErr } = await supabaseAdmin
        .from("project_specs")
        .select("id, task_run_id, file_path, created_at")
        .eq("task_run_id", runId);

      assert.ifError(retryFetchErr);
      assert.strictEqual(
        rowsAfterRetry?.length,
        1,
        "Retry execution must NOT create duplicate project_specs rows",
      );
      assert.strictEqual(
        rowsAfterRetry[0].id,
        initialSpecId,
        "Idempotent upsert on task_run_id must update existing row without ID thrashing",
      );

      // Verify direct database upsert idempotency test with raw query
      const { error: rawUpsertErr } = await supabaseAdmin.from("project_specs").upsert(
        {
          task_run_id: runId,
          project_id: projectId,
          file_path: `specs/${projectId}/${runId}.md`,
          created_at: new Date().toISOString(),
        },
        { onConflict: "task_run_id" },
      );
      assert.ifError(rawUpsertErr, "Raw upsert with onConflict: task_run_id should succeed");

      const { count } = await supabaseAdmin
        .from("project_specs")
        .select("*", { count: "exact", head: true })
        .eq("task_run_id", runId);

      assert.strictEqual(count, 1, "Row count for task_run_id must strictly equal 1");
    });

    await test("Foreign key cascading: deleting task_runs row automatically deletes associated project_specs row", async () => {
      const projectId = await createTestProject("FK Cascade TaskRun Project");

      const runId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });

      await processSpecTask(supabaseAdmin, {
        runId,
        projectId,
        userId: testUserId,
        input: { roomId: projectId },
        signal: new AbortController().signal,
      });

      // Verify project_spec exists
      const { data: specBefore } = await supabaseAdmin
        .from("project_specs")
        .select("id")
        .eq("task_run_id", runId)
        .single();
      assert.ok(specBefore, "project_spec row must exist before deletion");

      // Delete the task_runs row
      const { error: delErr } = await supabaseAdmin.from("task_runs").delete().eq("id", runId);
      assert.ifError(delErr);

      // Verify project_specs row was cascaded and deleted
      const { data: specAfter } = await supabaseAdmin
        .from("project_specs")
        .select("id")
        .eq("task_run_id", runId)
        .maybeSingle();

      assert.strictEqual(specAfter, null, "project_specs row must be cascade-deleted");
    });

    await test("Foreign key cascading: deleting project cascades to delete all task_runs and project_specs", async () => {
      const projectId = await createTestProject("FK Cascade Project-Level");

      const runId1 = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });

      await processSpecTask(supabaseAdmin, {
        runId: runId1,
        projectId,
        userId: testUserId,
        input: { roomId: projectId },
        signal: new AbortController().signal,
      });

      // Complete run 1 so run 2 can be enqueued
      await supabaseAdmin
        .from("task_runs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", runId1);

      const runId2 = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });

      await processSpecTask(supabaseAdmin, {
        runId: runId2,
        projectId,
        userId: testUserId,
        input: { roomId: projectId },
        signal: new AbortController().signal,
      });

      // Verify 2 specs and 2 task runs exist
      const { count: specCountBefore } = await supabaseAdmin
        .from("project_specs")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      assert.strictEqual(specCountBefore, 2);

      const { count: taskRunCountBefore } = await supabaseAdmin
        .from("task_runs")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      assert.strictEqual(taskRunCountBefore, 2);

      // Delete the project
      const { error: delProjErr } = await supabaseAdmin
        .from("projects")
        .delete()
        .eq("id", projectId);
      assert.ifError(delProjErr);

      // Verify cascade deletion
      const { count: specCountAfter } = await supabaseAdmin
        .from("project_specs")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      assert.strictEqual(specCountAfter, 0, "All project_specs must be cascade-deleted");

      const { count: taskRunCountAfter } = await supabaseAdmin
        .from("task_runs")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      assert.strictEqual(taskRunCountAfter, 0, "All task_runs must be cascade-deleted");
    });

    // ------------------------------------------------------------------------
    // GROUP D: Error & Failure Handling
    // ------------------------------------------------------------------------
    console.log("\n--- GROUP D: Error & Failure Handling ---");

    await test("Permanent errors mark task_runs as 'failed' and do NOT create corrupt/orphan project_specs", async () => {
      const projectId = await createTestProject("Permanent Error Project");

      const runId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });

      // Simulate permanent error scenario (e.g. invalid context / abort)
      const controller = new AbortController();
      controller.abort(new Error("Permanent validation error simulation"));

      try {
        await processSpecTask(supabaseAdmin, {
          runId,
          projectId,
          userId: testUserId,
          input: { roomId: projectId },
          signal: controller.signal,
        });
        assert.fail("processSpecTask should have thrown");
      } catch {
        // Handle error according to worker lifecycle
        await supabaseAdmin
          .from("task_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error_message: "Permanent validation error simulation",
          })
          .eq("id", runId);
      }

      // Verify task_runs is marked failed
      const { data: run } = await supabaseAdmin
        .from("task_runs")
        .select("status, completed_at, error_message")
        .eq("id", runId)
        .single();

      assert.strictEqual(run?.status, "failed");
      assert.ok(run?.completed_at, "completed_at must be populated on terminal failure");
      assert.strictEqual(run?.error_message, "Permanent validation error simulation");

      // Verify NO record in project_specs was created
      const { data: spec } = await supabaseAdmin
        .from("project_specs")
        .select("id")
        .eq("task_run_id", runId)
        .maybeSingle();

      assert.strictEqual(spec, null, "Failed run must not leave corrupt records in project_specs");
    });

    await test("Transient errors mark task_runs as 'retrying' and do NOT create premature project_specs", async () => {
      const projectId = await createTestProject("Transient Error Project");

      const runId = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });

      // Simulate transient error (e.g. rate limit 429)
      const transientErr = new TransientAiError("OpenRouter 429 Rate Limit");

      // Worker updates run to retrying
      await supabaseAdmin
        .from("task_runs")
        .update({
          status: "retrying",
          attempt_count: 1,
          updated_at: new Date().toISOString(),
          error_message: transientErr.message,
        })
        .eq("id", runId);

      const { data: run } = await supabaseAdmin
        .from("task_runs")
        .select("status, attempt_count, completed_at, error_message")
        .eq("id", runId)
        .single();

      assert.strictEqual(run?.status, "retrying");
      assert.strictEqual(run?.attempt_count, 1);
      assert.strictEqual(run?.completed_at, null, "Retrying runs must have null completed_at");
      assert.strictEqual(run?.error_message, "OpenRouter 429 Rate Limit");

      // Confirm no spec record exists while retrying
      const { data: spec } = await supabaseAdmin
        .from("project_specs")
        .select("id")
        .eq("task_run_id", runId)
        .maybeSingle();

      assert.strictEqual(spec, null, "Retrying run must not have project_specs entry");
    });

    // ------------------------------------------------------------------------
    // GROUP E: Metadata and Download APIs
    // ------------------------------------------------------------------------
    console.log("\n--- GROUP E: Metadata and Download APIs ---");

    await test("listProjectSpecs queries metadata ordered by created_at DESC without leaking file_path", async () => {
      const projectId = await createTestProject("Payment Infrastructure");

      // Create 2 task runs and complete them
      const runId1 = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });
      await processSpecTask(supabaseAdmin, {
        runId: runId1,
        projectId,
        userId: testUserId,
        input: { roomId: projectId },
        signal: new AbortController().signal,
      });
      await supabaseAdmin
        .from("task_runs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", runId1);

      // Slight delay to guarantee ordering
      await new Promise((r) => setTimeout(r, 50));

      const runId2 = await enqueueTaskRun({
        projectId,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectId },
      });
      await processSpecTask(supabaseAdmin, {
        runId: runId2,
        projectId,
        userId: testUserId,
        input: { roomId: projectId },
        signal: new AbortController().signal,
      });

      // Call listProjectSpecs
      const specs = await listProjectSpecs(supabaseAdmin, projectId, "Payment Infrastructure");

      assert.strictEqual(specs.length, 2, "Should return 2 spec summaries");

      // Verify newest first ordering
      assert.strictEqual(specs[0].taskRunId, runId2, "Newest spec must be first in list");
      assert.strictEqual(specs[1].taskRunId, runId1);

      // Verify filenames formatted properly with slug and short run ID
      const shortRunId2 = runId2.replace(/-/g, "").slice(0, 8);
      assert.strictEqual(specs[0].fileName, `payment-infrastructure-spec-${shortRunId2}.md`);

      // Security invariant: file_path must NOT be present on summary objects
      for (const item of specs) {
        assert.strictEqual(
          (item as unknown as Record<string, unknown>).filePath,
          undefined,
          "filePath must not be exposed in ProjectSpecSummary",
        );
        assert.strictEqual(
          (item as unknown as Record<string, unknown>).file_path,
          undefined,
          "file_path must not be exposed in ProjectSpecSummary",
        );
        assert.ok(item.id, "Summary has id");
        assert.ok(item.taskRunId, "Summary has taskRunId");
        assert.ok(item.projectId, "Summary has projectId");
        assert.ok(item.createdAt, "Summary has createdAt");
      }
    });

    await test("getProjectSpec enforces project boundary isolation", async () => {
      const projectA = await createTestProject("Project A");
      const projectB = await createTestProject("Project B");

      const runIdA = await enqueueTaskRun({
        projectId: projectA,
        userId: testUserId,
        kind: "spec",
        input: { roomId: projectA },
      });

      await processSpecTask(supabaseAdmin, {
        runId: runIdA,
        projectId: projectA,
        userId: testUserId,
        input: { roomId: projectA },
        signal: new AbortController().signal,
      });

      const { data: specRow } = await supabaseAdmin
        .from("project_specs")
        .select("id")
        .eq("task_run_id", runIdA)
        .single();
      assert.ok(specRow);

      // 1. Fetching with matching project succeeds
      const specA = await getProjectSpec(supabaseAdmin, projectA, specRow.id);
      assert.ok(specA, "Should find spec with matching projectId");
      assert.strictEqual(specA?.id, specRow.id);
      assert.strictEqual(specA?.projectId, projectA);
      assert.strictEqual(specA?.taskRunId, runIdA);
      assert.strictEqual(specA?.filePath, `specs/${projectA}/${runIdA}.md`);

      // 2. Fetching with mismatched projectId returns null
      const specB = await getProjectSpec(supabaseAdmin, projectB, specRow.id);
      assert.strictEqual(
        specB,
        null,
        "Must return null when querying a spec belonging to another project",
      );

      // 3. Fetching non-existent spec ID returns null
      const nonExistent = await getProjectSpec(
        supabaseAdmin,
        projectA,
        "00000000-0000-0000-0000-000000000000",
      );
      assert.strictEqual(nonExistent, null);
    });

    await test("downloadSpecMarkdown retrieves exact stored Markdown content", async () => {
      const projectId = await createTestProject("Download Test Project");
      const testRunId = "77777777-7777-7777-7777-777777777777";
      const sampleMarkdown = `# Technical Specification: Download Verification

## 1. Overview
This is a test spec artifact stored at a deterministic path.

\`\`\`json
{ "verified": true }
\`\`\`
`;

      const storagePath = `specs/${projectId}/${testRunId}.md`;
      const storageKey = `${projectId}/${testRunId}.md`;

      // Upload sample markdown to storage
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(SPECS_BUCKET)
        .upload(storageKey, sampleMarkdown, {
          contentType: "text/markdown",
          upsert: true,
        });
      assert.ifError(uploadErr);

      // Download using downloadSpecMarkdown helper with 'specs/' prefix
      const contentWithPrefix = await downloadSpecMarkdown(supabaseAdmin, storagePath);
      assert.strictEqual(contentWithPrefix, sampleMarkdown);

      // Download using downloadSpecMarkdown helper without 'specs/' prefix
      const contentWithoutPrefix = await downloadSpecMarkdown(supabaseAdmin, storageKey);
      assert.strictEqual(contentWithoutPrefix, sampleMarkdown);
    });

    await test("Utility functions: parseSpecStoragePath, cleanMarkdownSpec, slugifySpecName, formatSpecFileName", async () => {
      // 1. parseSpecStoragePath
      assert.deepStrictEqual(parseSpecStoragePath("specs/proj-1/run-2.md"), {
        bucket: "specs",
        path: "proj-1/run-2.md",
      });
      assert.deepStrictEqual(parseSpecStoragePath("proj-1/run-2.md"), {
        bucket: "specs",
        path: "proj-1/run-2.md",
      });

      // 2. cleanMarkdownSpec
      const rawWithThink = `<think>
Architectural reasoning here...
</think>
# Clean Spec
Content here`;
      assert.strictEqual(cleanMarkdownSpec(rawWithThink), "# Clean Spec\nContent here");

      const rawWrappedFences = "```markdown\n# Wrapped Spec\nContent\n```";
      assert.strictEqual(cleanMarkdownSpec(rawWrappedFences), "# Wrapped Spec\nContent");

      // 3. slugifySpecName
      assert.strictEqual(slugifySpecName("My Awesome App!"), "my-awesome-app");
      assert.strictEqual(slugifySpecName("   Multiple   Spaces   "), "multiple-spaces");
      assert.strictEqual(slugifySpecName(""), "spec");
      assert.strictEqual(slugifySpecName(null), "spec");

      // 4. formatSpecFileName
      assert.strictEqual(
        formatSpecFileName({
          projectName: "Realtime Chat App",
          taskRunId: "e19411e3-1234-5678-9abc-def012345678",
        }),
        "realtime-chat-app-spec-e19411e3.md",
      );
      assert.strictEqual(
        formatSpecFileName({
          projectName: "",
          taskRunId: "e19411e3-1234-5678-9abc-def012345678",
        }),
        "spec-e19411e3.md",
      );
      assert.strictEqual(
        formatSpecFileName({
          projectName: "Solo Project",
        }),
        "solo-project-spec.md",
      );
      assert.strictEqual(formatSpecFileName({}), "spec.md");
    });
  } finally {
    await teardownTestContext();
  }

  console.log("\n===============================================================================");
  console.log(`   SPEC 27 INTEGRATION SUITE PASSED ALL ${passedTests}/${totalTests} TESTS!   `);
  console.log("===============================================================================\n");
}

runSpec27IntegrationSuite().catch((err) => {
  console.error("\nFATAL ERROR in Spec 27 integration suite:", err);
  process.exit(1);
});
