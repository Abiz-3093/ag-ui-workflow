import { uuid } from "./uuid";
import type { AgentLike, AgentRunHandlers, ChatMessage } from "./types";

/**
 * Simple HTTP agent that POSTs to a provided endpoint and streams the text response.
 * Expects the server to return a streaming/text body (SSE/text/plain/NDJSON all work; we just append raw chunks).
 */
export function createHttpAgent(baseUrl: string, apiKey?: string): AgentLike {
  const messages: ChatMessage[] = [];

  async function runAgent(input: Record<string, unknown>, handlers?: AgentRunHandlers) {
    const runMessages = [...messages];
    const agentConfig = (input as any)?.agentConfig ?? {};
    const model = agentConfig.model ?? "gpt-4o-mini";
    const guardrail = agentConfig.guardrail ?? "";
    const workflow = (input as any)?.workflow;

    const assistantMsg: ChatMessage = { id: uuid(), role: "assistant", content: "" };
    messages.push(assistantMsg);
    handlers?.onTextMessageStartEvent?.();

    const requestBody: Record<string, unknown> = {
      model,
      input: formatMessages(runMessages),
      metadata: buildMetadata(workflow, agentConfig),
    };

    if (guardrail) {
      // OpenAI Responses API guardrail hint; ignored by servers that don't support it.
      (requestBody as any).guardrails = { type: "preset", name: guardrail };
    }

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`request failed: ${res.status} ${res.statusText} ${text || ""}`.trim());
    }
    if (!res.body) throw new Error("no response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let raw = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      raw += chunk;
    }

    const text = extractText(raw);
    assistantMsg.content = text;
    if (text) {
      handlers?.onTextMessageContentEvent?.({ event: { delta: text } });
    }

    handlers?.onTextMessageEndEvent?.();
  }

  return { messages, runAgent };
}

function formatMessages(msgs: ChatMessage[]) {
  if (!msgs.length) return "";
  return msgs.map((m) => `${m.role}: ${m.content}`).join("\n\n");
}

function buildMetadata(workflow: unknown, agentConfig: Record<string, unknown>) {
  const meta: Record<string, string> = {};

  // Build a compact workflow summary; drop apiKey and trim to 512 chars.
  if (workflow && typeof workflow === "object") {
    try {
      const wf = workflow as any;
      const nodes = Array.isArray(wf.nodes)
        ? wf.nodes.map((n: any) => ({
            id: n?.id,
            label: n?.data?.label,
            type: n?.data?.type,
            config: pruneConfig(n?.data?.config),
          }))
        : [];
      const edges = Array.isArray(wf.edges)
        ? wf.edges.map((e: any) => ({
            source: e?.source,
            target: e?.target,
            handle: e?.sourceHandle,
          }))
        : [];
      const summary = JSON.stringify({ nodes, edges });
      meta.workflow = summary.slice(0, 512);
    } catch {
      // ignore if serialization fails
    }
  }

  // Add a compact agentConfig summary (without apiKey); trim to 512 chars.
  try {
    const prunedAgent = pruneConfig(agentConfig);
    const summary = JSON.stringify(prunedAgent);
    if (summary) meta.agentConfig = summary.slice(0, 512);
  } catch {
    // ignore
  }

  return meta;
}

function pruneConfig(cfg: any) {
  if (!cfg || typeof cfg !== "object") return {};
  const out: Record<string, unknown> = {};
  const model = cfg.model ?? cfg?.modelId;
  const guardrail = cfg.guardrail;
  const memory = cfg.memory;
  const endpoint = cfg.endpoint;
  const tools = Array.isArray(cfg.tools) ? cfg.tools : [];

  if (model) out.model = model;
  if (guardrail) out.guardrail = guardrail;
  if (endpoint) out.endpoint = endpoint;
  if (memory && memory !== "conversation-buffer") out.memory = memory;
  if (tools.length) out.tools = tools;

  // copy other non-empty props except apiKey
  for (const [k, v] of Object.entries(cfg)) {
    if (k === "apiKey") continue;
    if (out[k] !== undefined) continue;
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }

  return out;
}

function extractText(raw: string) {
  const trimmed = raw?.trim();
  if (!trimmed) return "";

  // Try parsing the whole payload first (single JSON object response)
  try {
    const parsed = JSON.parse(trimmed);
    const fromParsed = extractTextFromResponse(parsed);
    if (fromParsed) return fromParsed;
  } catch {
    // fall through to NDJSON parsing
  }

  // Try to parse NDJSON and keep the last parsable object.
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  let lastObj: any = null;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      lastObj = parsed;
    } catch {
      // ignore parse errors
    }
  }

  if (lastObj) {
    const fromLast = extractTextFromResponse(lastObj);
    if (fromLast) return fromLast;
  }

  // If not JSON or parsing failed, return the raw text (first 4000 chars to stay safe).
  return trimmed.slice(0, 4000);
}

function extractTextFromResponse(obj: any) {
  if (!obj || typeof obj !== "object") return "";

  // Direct output_text field (array or string)
  if (Array.isArray(obj.output_text)) {
    const joined = obj.output_text.map((t: any) => String(t ?? "")).join("");
    if (joined.trim()) return joined;
  }
  if (typeof obj.output_text === "string" && obj.output_text.trim()) return obj.output_text;

  // OpenAI Responses API style: output is an array of messages with content blocks.
  if (Array.isArray(obj.output)) {
    const texts: string[] = [];
    for (const item of obj.output) {
      const blocks = item?.content;
      if (Array.isArray(blocks)) {
        for (const block of blocks) {
          const txt =
            block?.text?.value ||
            block?.text ||
            block?.value ||
            (block?.type === "output_text" ? block?.text : "");
          if (txt) texts.push(String(txt));
        }
      }
    }
    if (texts.length) return texts.join("\n\n");
  }

  // Generic message content array path
  const contentBlocks = obj.output?.[0]?.content;
  if (Array.isArray(contentBlocks)) {
    const textParts = contentBlocks
      .map((c: any) => c?.text?.value || c?.text || c?.value || "")
      .filter(Boolean);
    if (textParts.length) return textParts.join("");
  }

  return "";
}
