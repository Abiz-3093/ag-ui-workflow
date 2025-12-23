import { uuid } from "./uuid";
import type { AgentLike, AgentRunHandlers, ChatMessage } from "./types";

/**
 * Optional: connect to a real AG-UI compatible server via Server-Sent Events (SSE).
 *
 * This is intentionally lightweight so it can be adapted to your backend.
 * Expected backend behavior:
 * - POST { messages } to `${url}/run`
 * - server streams newline-delimited JSON events from `${url}/stream?runId=...`
 *
 * If you already have an AG-UI server, replace the wire format below with your server's schema.
 */
export function createSseAgent(baseUrl: string): AgentLike {
  const messages: ChatMessage[] = [];

  async function runAgent(_input: Record<string, unknown>, handlers?: AgentRunHandlers) {
    const runId = uuid();

    // Persist the message list on the server
    const res = await fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, messages }),
    });

    if (!res.ok) throw new Error(`run failed: ${res.status} ${res.statusText}`);

    // Create an assistant placeholder in the local transcript
    const assistantMsg: ChatMessage = { id: uuid(), role: "assistant", content: "" };
    messages.push(assistantMsg);

    // Stream events via SSE
    handlers?.onTextMessageStartEvent?.();
    const sse = new EventSource(`${baseUrl}/stream?runId=${encodeURIComponent(runId)}`);

    await new Promise<void>((resolve, reject) => {
      sse.addEventListener("message", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          // Expecting a minimal schema:
          // { type: "text_delta", delta: "..." } | { type: "tool", name, args } | { type: "done" }
          if (data.type === "text_delta") {
            const delta = String(data.delta ?? "");
            assistantMsg.content += delta;
            handlers?.onTextMessageContentEvent?.({ event: { delta } });
          } else if (data.type === "tool") {
            handlers?.onToolCallEvent?.({ name: String(data.name), args: data.args ?? {} });
          } else if (data.type === "done") {
            sse.close();
            handlers?.onTextMessageEndEvent?.();
            resolve();
          }
        } catch (err) {
          sse.close();
          reject(err);
        }
      });

      sse.addEventListener("error", () => {
        sse.close();
        reject(new Error("SSE connection failed"));
      });
    });
  }

  return { messages, runAgent };
}
