# AG-UI Workflow Studio (React)

A small **n8n-like workflow editor** (nodes + edges) with:
- **Node Panel** (left) to add nodes
- **Workflow Canvas** (center) using `reactflow`
- **Node Details** inspector (right)
- **Chat** panel (right) that streams agent responses in an **AG-UI-style event** shape

## Run

```bash
npm install
npm run dev
```

## AG-UI integration notes

This demo includes:
- `src/agui/mockAgent.ts` — local mock agent that emits `onTextMessageStartEvent` → `onTextMessageContentEvent` → `onTextMessageEndEvent`
- `src/agui/sseAgent.ts` — optional SSE connector stub you can adapt to your AG-UI server

AG-UI is an event-based protocol for agent ↔ UI interaction. See the AG-UI docs for the event flow concepts and client patterns.

## Keyboard

- **Delete / Backspace**: delete selected node
- **Ctrl/⌘ + K**: focus chat input
