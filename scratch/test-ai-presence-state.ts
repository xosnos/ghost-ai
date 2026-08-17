import {
  parseAiStatusMessage,
  isAiStatusMessage,
} from "../types/tasks";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log("=== Testing Feature 24: AI Presence & Task Status Validation ===");

// 1. Valid full payload
const validFullPayload = {
  runId: "00000000-0000-0000-0000-000000000001",
  projectId: "00000000-0000-0000-0000-000000000002",
  kind: "design",
  status: "running",
  step: "generating",
  message: "Generating canvas nodes",
  text: "Designing microservices architecture...",
  progress: 50,
  timestamp: "2026-08-17T00:00:00.000Z",
};

assert(isAiStatusMessage(validFullPayload), "isAiStatusMessage returns true for valid full payload");
const parsedFull = parseAiStatusMessage(validFullPayload);
assert(parsedFull !== null, "parseAiStatusMessage returns non-null");
assert(parsedFull?.runId === validFullPayload.runId, "parsed runId matches");
assert(parsedFull?.projectId === validFullPayload.projectId, "parsed projectId matches");
assert(parsedFull?.kind === "design", "parsed kind matches");
assert(parsedFull?.status === "running", "parsed status matches");
assert(parsedFull?.step === "generating", "parsed step matches");
assert(parsedFull?.text === validFullPayload.text, "parsed text matches");
assert(parsedFull?.progress === 50, "parsed progress matches");

// 2. Valid payload with optional fields omitted
const validMinimalPayload = {
  runId: "00000000-0000-0000-0000-000000000003",
  projectId: "00000000-0000-0000-0000-000000000004",
  kind: "spec",
  status: "queued",
  step: "start",
  message: "Queued spec generation task",
};

assert(isAiStatusMessage(validMinimalPayload), "isAiStatusMessage returns true for valid minimal payload");
const parsedMinimal = parseAiStatusMessage(validMinimalPayload);
assert(parsedMinimal !== null, "parsedMinimal is non-null");
assert(parsedMinimal?.text === undefined, "optional text is undefined");
assert(parsedMinimal?.progress === undefined, "optional progress is undefined");
assert(typeof parsedMinimal?.timestamp === "string", "timestamp default is string");

// 3. Invalid payloads (must be rejected)
assert(parseAiStatusMessage(null) === null, "Rejects null");
assert(parseAiStatusMessage(undefined) === null, "Rejects undefined");
assert(parseAiStatusMessage("string") === null, "Rejects raw string");
assert(parseAiStatusMessage({}) === null, "Rejects empty object");
assert(parseAiStatusMessage({ ...validFullPayload, runId: "" }) === null, "Rejects empty runId");
assert(parseAiStatusMessage({ ...validFullPayload, projectId: "" }) === null, "Rejects empty projectId");
assert(parseAiStatusMessage({ ...validFullPayload, kind: "unknown" }) === null, "Rejects invalid kind");
assert(parseAiStatusMessage({ ...validFullPayload, status: "unknown_status" }) === null, "Rejects invalid status");
assert(parseAiStatusMessage({ ...validFullPayload, step: "unknown_step" }) === null, "Rejects invalid step");
assert(parseAiStatusMessage({ ...validFullPayload, message: 123 }) === null, "Rejects non-string message");

console.log("\n🎉 All Feature 24 status validation assertions passed successfully!");
