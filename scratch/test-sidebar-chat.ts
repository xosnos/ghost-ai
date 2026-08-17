import {
  parseAiChatMessage,
  isAiChatMessage,
  getSenderDisplayName,
  isAiStatusMessage,
  type AiChatMessage,
} from "../types/tasks";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log("=== Testing Feature 25: Sidebar Chat Validation & Deduplication ===");

// 1. Valid user chat message with object sender
const validUserMessage = {
  id: "msg-00000000-0000-0000-0000-000000000001",
  sender: {
    id: "user-123",
    name: "Alex Designer",
    avatarUrl: "https://example.com/avatar.png",
  },
  role: "user",
  content: "Can we add a Redis caching layer?",
  timestamp: "2026-08-17T03:30:00.000Z",
};

assert(isAiChatMessage(validUserMessage), "isAiChatMessage returns true for valid user message");
const parsedUser = parseAiChatMessage(validUserMessage);
assert(parsedUser !== null, "parseAiChatMessage parses valid user message");
assert(parsedUser?.id === validUserMessage.id, "parsed message id matches");
assert(typeof parsedUser?.sender === "object" && parsedUser.sender.name === "Alex Designer", "parsed sender matches");
assert(getSenderDisplayName(parsedUser!.sender) === "Alex Designer", "getSenderDisplayName extracts name from object");
assert(parsedUser?.role === "user", "parsed role is user");
assert(parsedUser?.content === validUserMessage.content, "parsed content matches");

// 2. Valid message with string sender and optional runId
const validAiMessage = {
  id: "msg-00000000-0000-0000-0000-000000000002",
  sender: "Ghost AI",
  role: "assistant",
  content: "Added Redis cache cluster with 2 replica nodes.",
  timestamp: "2026-08-17T03:30:05.000Z",
  runId: "run-999",
};

assert(isAiChatMessage(validAiMessage), "isAiChatMessage returns true for valid assistant message");
const parsedAi = parseAiChatMessage(validAiMessage);
assert(parsedAi !== null, "parseAiChatMessage parses assistant message");
assert(getSenderDisplayName(parsedAi!.sender) === "Ghost AI", "getSenderDisplayName extracts string sender");
assert(parsedAi?.runId === "run-999", "parsed runId matches");

// 3. System message
const validSystemMessage = {
  id: "msg-00000000-0000-0000-0000-000000000003",
  sender: "System",
  role: "system",
  content: "Alex joined the room",
  timestamp: "2026-08-17T03:29:00.000Z",
};
assert(isAiChatMessage(validSystemMessage), "isAiChatMessage returns true for system message");

// 4. Invalid chat messages (must be rejected)
assert(parseAiChatMessage(null) === null, "Rejects null");
assert(parseAiChatMessage(undefined) === null, "Rejects undefined");
assert(parseAiChatMessage("hello") === null, "Rejects string");
assert(parseAiChatMessage({}) === null, "Rejects empty object");
assert(parseAiChatMessage({ ...validUserMessage, id: "" }) === null, "Rejects empty id");
assert(parseAiChatMessage({ ...validUserMessage, content: "" }) === null, "Rejects empty content");
assert(parseAiChatMessage({ ...validUserMessage, role: "admin" }) === null, "Rejects invalid role");
assert(parseAiChatMessage({ ...validUserMessage, sender: { id: "" } }) === null, "Rejects invalid sender object");

// 5. Message ID Deduplication Logic test
const seenIds = new Set<string>();
const messages: AiChatMessage[] = [];

function handleIncoming(raw: unknown) {
  const parsed = parseAiChatMessage(raw);
  if (!parsed) return false;
  if (seenIds.has(parsed.id)) return false;
  seenIds.add(parsed.id);
  messages.push(parsed);
  return true;
}

assert(handleIncoming(validUserMessage) === true, "First arrival of validUserMessage accepted");
assert(messages.length === 1, "Messages length is 1");
assert(handleIncoming(validUserMessage) === false, "Duplicate arrival of validUserMessage ignored");
assert(messages.length === 1, "Messages length remains 1 after duplicate");

assert(handleIncoming(validAiMessage) === true, "Arrival of distinct validAiMessage accepted");
assert(messages.length === 2, "Messages length is now 2");

// 6. Strict Separation: ai-chat message must NOT be accepted as ai-status message and vice-versa
assert(!isAiStatusMessage(validUserMessage), "Chat message is NOT a valid status message");
assert(!isAiChatMessage({
  runId: "00000000-0000-0000-0000-000000000001",
  projectId: "00000000-0000-0000-0000-000000000002",
  kind: "design",
  status: "running",
  step: "generating",
  message: "Generating canvas nodes",
  timestamp: "2026-08-17T00:00:00.000Z",
}), "Status message is NOT a valid chat message");

console.log("\n🎉 All Feature 25 Sidebar Chat assertions passed successfully!");
