import React, { useCallback, useMemo, useRef, useState } from "react";
import type { Node } from "reactflow";
import WorkflowCanvas, { DEFAULT_WORKFLOW, type WorkflowState } from "./components/WorkflowCanvas";
import NodePalette, { type NodeAddOptions, type PaletteNodeType } from "./components/NodePalette";
import NodeInspector from "./components/NodeInspector";
import ChatPanel from "./components/ChatPanel";
import { createMockAgent } from "./agui/mockAgent";
import { createHttpAgent } from "./agui/httpAgent";

function nextId(prefix = "n") {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

const DEFAULT_AGENT_CONFIG = {
  model: "gpt-4o-mini",
  memory: "conversation-buffer",
  guardrail: "",
  endpoint: "",
  apiKey: "",
  tools: [
    { name: "web-search", description: "Search docs or the web" },
    { name: "http-request", description: "Call downstream APIs" },
  ],
};

function defaultConfigForType(type: string) {
  if (type === "ai-agent") {
    return { ...DEFAULT_AGENT_CONFIG, tools: [...DEFAULT_AGENT_CONFIG.tools] };
  }
  return {};
}

export default function App() {
  const [wf, setWf] = useState<WorkflowState>(DEFAULT_WORKFLOW);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [showJson, setShowJson] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(true);

  const selectedNode = useMemo<Node | null>(() => {
    if (!selectedNodeId) return null;
    return wf.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [wf.nodes, selectedNodeId]);

  const activeAgentConfig = useMemo(() => {
    const aiNode = wf.nodes.find((n) => (n.data as any)?.type === "ai-agent");
    const aiConfig = (aiNode?.data as any)?.config ?? {};

    // If a model node is connected to the AI agent via the "model" handle, prefer its config for model/endpoint/key/guardrail.
    const modelEdge = aiNode
      ? wf.edges.find((e) => e.source === aiNode.id && e.sourceHandle === "model")
      : null;
    const modelNode = modelEdge ? wf.nodes.find((n) => n.id === modelEdge.target) : null;
    const modelConfig = (modelNode?.data as any)?.config ?? {};

    const tools = Array.isArray(aiConfig.tools) ? aiConfig.tools : [];
    return {
      model: modelConfig.model ?? aiConfig.model ?? "gpt-4o-mini",
      memory: aiConfig.memory ?? "conversation-buffer",
      guardrail: modelConfig.guardrail ?? aiConfig.guardrail ?? "",
      endpoint: modelConfig.endpoint ?? aiConfig.endpoint ?? "",
      apiKey: modelConfig.apiKey ?? aiConfig.apiKey ?? "",
      tools,
    };
  }, [wf.nodes, wf.edges]);

  const agent = useMemo(() => {
    const endpoint = String(activeAgentConfig.endpoint ?? "").trim();
    const apiKey = String(activeAgentConfig.apiKey ?? "").trim();
    if (endpoint) {
      return createHttpAgent(endpoint, apiKey);
    }
    return createMockAgent();
  }, [activeAgentConfig.endpoint, activeAgentConfig.apiKey]);

  const chatInputPayload = useMemo(
    () => ({
      workflow: wf,
      agentConfig: activeAgentConfig,
    }),
    [wf, activeAgentConfig]
  );

  const chatFocusRef = useRef<HTMLTextAreaElement>(null);

  const addNode = useCallback(
    (t: PaletteNodeType, options?: NodeAddOptions) => {
      const id = nextId();
      const nodeType = t.type === "ai-agent" ? "aiAgent" : "default";
      const config = defaultConfigForType(t.type);
      setWf((prev) => {
        const sourceNode =
          options?.connectFrom?.nodeId ? prev.nodes.find((n) => n.id === options.connectFrom?.nodeId) : null;
        const x =
          options?.position?.x ??
          (sourceNode ? sourceNode.position.x + 180 : 120 + prev.nodes.length * 40);
        const y =
          options?.position?.y ??
          (sourceNode ? sourceNode.position.y : 220 + (prev.nodes.length % 6) * 60);
        const nodes = prev.nodes.map((n) => ({ ...n, selected: false }));

        const newNodes = [
          ...nodes,
          {
            id,
            type: nodeType,
            position: { x, y },
            data: { label: t.label, type: t.type, config },
            selected: true,
          },
        ];

        const newEdge =
          options?.connectFrom?.nodeId && options?.connectFrom?.handleId
            ? {
                id: nextId("e"),
                source: options.connectFrom.nodeId,
                sourceHandle: options.connectFrom.handleId,
                target: id,
              }
            : null;

        return {
          ...prev,
          nodes: newNodes,
          edges: newEdge ? [...prev.edges, newEdge] : prev.edges,
        };
      });
      setSelectedNodeId(id);
    },
    []
  );

  const reset = useCallback(() => {
    setWf(DEFAULT_WORKFLOW);
    setSelectedNodeId(null);
  }, []);

  const deleteNode = useCallback((id: string) => {
    setWf((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== id),
      edges: prev.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    setSelectedNodeId((prev) => (prev === id ? null : prev));
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    deleteNode(selectedNodeId);
  }, [deleteNode, selectedNodeId]);

  const handleSelectNode = useCallback((n: Node | null, openInspector?: boolean) => {
    const id = n?.id ?? null;
    setSelectedNodeId(id);
    if (openInspector === true) {
      setShowInspector(true);
    } else if (openInspector === false || !id) {
      setShowInspector(false);
    }
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected]);

  const updateNodeById = useCallback((id: string, patch: Partial<Node>) => {
    setWf((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }, []);

  const updateSelected = useCallback(
    (patch: Partial<Node>) => {
      if (!selectedNodeId) return;
      updateNodeById(selectedNodeId, patch);
    },
    [selectedNodeId, updateNodeById]
  );

  const status = "on";
  const statusText =
    activeAgentConfig.endpoint && String(activeAgentConfig.endpoint).trim()
      ? `HTTP: ${activeAgentConfig.endpoint}`
      : "Mock agent (local)";

  function handleToolCall(_args: { name: string; args: Record<string, unknown> }) {
    // Workflow actions are handled in chat only; no graph mutations here.
  }

  const closeInspector = useCallback(() => {
    setShowInspector(false);
    setSelectedNodeId(null);
    setWf((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => ({ ...n, selected: false })),
    }));
  }, []);

  return (
    <div
      className="app"
      style={{
        gridTemplateColumns: `${showPalette ? "320px" : "32px"} 1fr ${showChatPanel ? "420px" : "32px"}`,
      }}
    >
      <NodePalette
        collapsed={!showPalette}
        onToggle={() => setShowPalette((v) => !v)}
        onAdd={(t) => addNode(t)}
        onClear={reset}
      />

      <WorkflowCanvas
        state={wf}
        onChange={setWf}
            onSelectNode={handleSelectNode}
            onRemoveNode={deleteNode}
            onAddNode={addNode}
            onViewJson={() => setShowJson(true)}
            onDeploy={() => {
              try {
                const blob = new Blob([JSON.stringify(wf, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "workflow.json";
                a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error("Deploy download failed", err);
              }
            }}
      />

      <div className="panel" style={{ padding: 0, overflow: "visible" }}>
        <div className="panelHeader" style={{ display: showChatPanel ? undefined : "none" }}>
          <div className="panelTitle">Chat arena</div>
          <span className="small muted">Chat reads model/endpoint/key from the AI Agent node.</span>
        </div>

        <div
          className="panelBody"
          style={{ display: showChatPanel ? "flex" : "none", flexDirection: "column", gap: 12, minHeight: 0 }}
        >
          <ChatPanel
            agent={agent}
            status={status as any}
            statusText={statusText}
            onToolCall={handleToolCall as any}
            inputPayload={chatInputPayload}
            focusHotkeyRef={chatFocusRef}
          />
        </div>

        <button
          className="collapseBtn edgeToggleRight"
          onClick={() => setShowChatPanel((v) => !v)}
          title={showChatPanel ? "Collapse panel" : "Open panel"}
        >
          {showChatPanel ? ">" : "<"}
        </button>
      </div>

      {showInspector && selectedNode ? (
        <div className="jsonModal" onClick={closeInspector}>
          <div
            className="jsonModalCard"
            style={{ maxWidth: 600 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 650 }}>Node Details</div>
              <button className="btn btnSmall" onClick={closeInspector}>
                Close
              </button>
            </div>
            <NodeInspector
              selected={selectedNode}
              state={wf}
              onUpdate={updateSelected}
              onUpdateNode={updateNodeById}
              onClose={closeInspector}
            />
          </div>
        </div>
      ) : null}

      {showJson ? (
        <div className="jsonModal" onClick={() => setShowJson(false)}>
          <div
            className="jsonModalCard"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 650 }}>Workflow JSON</div>
              <button className="btn btnSmall" onClick={() => setShowJson(false)}>
                Close
              </button>
            </div>
            <pre className="jsonViewer">{JSON.stringify(wf, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
