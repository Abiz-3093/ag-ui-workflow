import React, { useEffect, useRef, useState } from "react";
import { uuid } from "../agui/uuid";
import type { AgentLike, AgentRunHandlers, ChatMessage } from "../agui/types";

export default function ChatPanel(props: {
  agent: AgentLike;
  status: "on" | "off" | "err";
  statusText: string;
  onToolCall: AgentRunHandlers["onToolCallEvent"];
  inputPayload?: Record<string, unknown>;
  focusHotkeyRef?: React.RefObject<HTMLInputElement>;
  headerExtras?: React.ReactNode;
  unstyled?: boolean;
  onLog?: (line: string) => void;
  onRunStart?: () => void;
  onRunComplete?: () => void;
  onRunError?: (err: Error) => void;
}) {
  const [draft, setDraft] = useState("");
  const [, force] = useState(0);

  const logRef = useRef<HTMLDivElement>(null);
  const composerRef = props.focusHotkeyRef ?? useRef<HTMLInputElement>(null);

  const messages = props.agent.messages;

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composerRef]);

  async function send() {
    const text = draft.trim();
    if (!text) return;

    props.onRunStart?.();

    const userMsg: ChatMessage = { id: uuid(), role: "user", content: text };
    messages.push(userMsg);
    props.onLog?.(`User: ${text}`);
    setDraft("");
    force((x) => x + 1);

    const handlers: AgentRunHandlers = {
      onTextMessageStartEvent: () => force((x) => x + 1),
      onTextMessageContentEvent: () => force((x) => x + 1),
      onTextMessageEndEvent: () => force((x) => x + 1),
      onToolCallEvent: props.onToolCall,
    };

    try {
      await props.agent.runAgent(props.inputPayload ?? {}, handlers);
      props.onLog?.("Agent run completed.");
      props.onRunComplete?.();
    } catch (err) {
      const msg: ChatMessage = {
        id: uuid(),
        role: "assistant",
        content: `Agent error: ${String((err as Error)?.message ?? err)}`,
      };
      messages.push(msg);
      props.onLog?.(`Agent error: ${String((err as Error)?.message ?? err)}`);
      props.onRunError?.(err as Error);
      force((x) => x + 1);
    }
  }

  const content = (
    <>
      <div className="panelHeader">
        <div className="panelTitle">
          Chat
          <span
            className={
              "statusDot " +
              (props.status === "on" ? "on" : props.status === "err" ? "err" : "")
            }
          />
          <span className="small muted">{props.statusText}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {props.headerExtras}
          <span className="badge">AG-UI-ish</span>
        </div>
      </div>

      <div className="panelBody chat">
        <div ref={logRef} className="chatLog">
          {messages.length === 0 ? (
            <div className="muted small">
              Start by typing a message. Example: <span className="kbd">Add an HTTP node</span>
            </div>
          ) : null}

          {messages.map((m) => (
            <div
              key={m.id}
              className={"bubble " + (m.role === "user" ? "bubbleUser" : "bubbleAssistant")}
            >
              {m.content}
            </div>
          ))}
        </div>

        <div className="chatComposer">
          <input
            ref={composerRef}
            className="input"
            placeholder="Message the agent (Ctrl/Cmd+K to focus)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="btn btnPrimary" onClick={() => void send()}>
            Send
          </button>
        </div>
        <div className="small muted">
          Press <span className="kbd">Enter</span> to send.
        </div>
      </div>
    </>
  );

  if (props.unstyled) {
    return <div className="chatSection">{content}</div>;
  }

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      {content}
    </div>
  );
}
