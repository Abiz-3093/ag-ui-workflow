import { uuid } from "./uuid";
import type { AgentLike, AgentRunHandlers, ChatMessage } from "./types";

/**
 * Mock agent that behaves like an AG-UI streaming client:
 * - reads latest user message
 * - emits start ƒ+' deltas ƒ+' end
 * - occasionally emits a "tool call" event to demonstrate interactive UI hooks.
 */
export function createMockAgent(): AgentLike {
  const messages: ChatMessage[] = [];

  async function runAgent(_input: Record<string, unknown>, handlers?: AgentRunHandlers) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userText = lastUser?.content ?? "";

    // Make a playful, workflow-aware reply
    const plan = "I can help you design the workflow - tell me what you want to automate.";
    const response = [
      "ƒo. Connected (mock AG-UI agent).",
      "",
      `You said: "${userText}"`,
      plan,
      "",
      "Try: ƒ?oAdd an HTTP Request node then connect it to a Transform node.ƒ??",
    ].join("\n");

    const assistantMsg: ChatMessage = { id: uuid(), role: "assistant", content: "" };
    messages.push(assistantMsg);

    handlers?.onTextMessageStartEvent?.();

    // Stream the response in chunks
    const chunks = chunkText(response, 18);
    for (const c of chunks) {
      await sleep(40);
      assistantMsg.content += c;
      handlers?.onTextMessageContentEvent?.({ event: { delta: c } });
    }

    handlers?.onTextMessageEndEvent?.();
  }

  return { messages, runAgent };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunkText(text: string, size: number) {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

function guessNodeLabel(userText: string) {
  if (/http|request|fetch/i.test(userText)) return "HTTP Request";
  if (/transform|map|json/i.test(userText)) return "Transform";
  if (/email|smtp/i.test(userText)) return "Send Email";
  return "New Node";
}

function guessNodeType(userText: string) {
  if (/http|request|fetch/i.test(userText)) return "http";
  if (/transform|map|json/i.test(userText)) return "transform";
  if (/email|smtp/i.test(userText)) return "email";
  return "generic";
}
