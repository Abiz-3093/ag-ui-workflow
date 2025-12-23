/**
 * Minimal AG-UI-ish event handler surface for the demo UI.
 *
 * AG-UI is an event-based protocol for agent ↔ UI communication. In the official docs,
 * a client handles "text message start/content/end" events to stream an assistant response.
 * (See docs.ag-ui.com quickstart "Build clients".)
 */
export type TextMessageDeltaEvent = { delta: string };

export type AgentRunHandlers = {
  onTextMessageStartEvent?: () => void;
  onTextMessageContentEvent?: (args: { event: TextMessageDeltaEvent }) => void;
  onTextMessageEndEvent?: () => void;

  // Demo-only: tool-like events that mutate the workflow editor.
  onToolCallEvent?: (args: { name: string; args: Record<string, unknown> }) => void;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type AgentLike = {
  messages: ChatMessage[];
  runAgent: (input: Record<string, unknown>, handlers?: AgentRunHandlers) => Promise<void>;
};

export type AgentConnectionState =
  | { kind: "mock" }
  | { kind: "sse"; url: string }
  | { kind: "http"; url: string; apiKey?: string }
  | { kind: "disconnected" };
