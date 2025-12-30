import React, { useCallback, useMemo, useRef, useState } from "react";
import type { Node } from "reactflow";
import WorkflowCanvas, { DEFAULT_WORKFLOW, type NodeRunStatus, type WorkflowState } from "./components/WorkflowCanvas";
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

const MOCK_PROJECTS: { id: string; name: string; workflow: WorkflowState; savedAt: number }[] = [
  {
    id: "proj-demo-1",
    name: "Sample Agent Flow",
    workflow: DEFAULT_WORKFLOW,
    savedAt: Date.now() - 1000 * 60 * 60 * 4,
  },
  {
    id: "proj-demo-2",
    name: "Webhook to Transform",
    workflow: {
      nodes: [
        {
          id: "t1",
          type: "default",
          position: { x: 120, y: 140 },
          data: { label: "Webhook Trigger", type: "webhook-trigger", config: { path: "/demo" } },
        },
        {
          id: "a1",
          type: "aiAgent",
          position: { x: 420, y: 140 },
          data: {
            label: "AI Agent",
            type: "ai-agent",
            config: {
              model: "gpt-4o",
              memory: "conversation-buffer",
              endpoint: "",
              apiKey: "",
              guardrail: "",
              tools: [{ name: "http-request", description: "Call downstream APIs" }],
            },
          },
        },
        {
          id: "x1",
          type: "default",
          position: { x: 720, y: 140 },
          data: { label: "Transform", type: "transform", config: { mapping: {} } },
        },
      ],
      edges: [
        { id: "e-t1-a1", source: "t1", target: "a1" },
        { id: "e-a1-x1", source: "a1", target: "x1" },
      ],
    },
    savedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

function defaultConfigForType(t: PaletteNodeType) {
  const defaults = (t.defaults?.config ?? {}) as Record<string, unknown>;
  if (t.type === "ai-agent") {
    return { ...DEFAULT_AGENT_CONFIG, tools: DEFAULT_AGENT_CONFIG.tools.map((tool) => ({ ...tool })) };
  }
  if (t.type === "model") {
    return {
      model: (defaults as any).model ?? "gpt-4o-mini",
      guardrail: (defaults as any).guardrail ?? "",
      endpoint: (defaults as any).endpoint ?? "",
      apiKey: (defaults as any).apiKey ?? "",
    };
  }
  if (t.type === "memory") {
    return { memory: (defaults as any).memory ?? "conversation-buffer" };
  }
  if (t.type === "tool") {
    const tools = Array.isArray((defaults as any).tools)
      ? (defaults as any).tools.map((tool: any) => ({ ...tool }))
      : [];
    return { tools };
  }
  if (t.type === "mcp-tool") {
    return {
      server: (defaults as any).server ?? "",
      tool: (defaults as any).tool ?? "",
      params: (defaults as any).params ?? "{}",
    };
  }
  return { ...defaults };
}

export default function App() {
  const [wf, setWf] = useState<WorkflowState>(DEFAULT_WORKFLOW);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatHeight, setChatHeight] = useState(360);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [pendingAttach, setPendingAttach] = useState<{
    connectFrom: { nodeId: string; handleId: string };
    kind: "model" | "memory" | "tool";
  } | null>(null);
  const [view, setView] = useState<"workflow" | "projects">("workflow");
  const [projects, setProjects] = useState<
    { id: string; name: string; workflow: WorkflowState; savedAt: number }[]
  >([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [runHighlights, setRunHighlights] = useState<Record<string, NodeRunStatus>>({});

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

  const chatFocusRef = useRef<HTMLInputElement>(null);

  const computeChatPathNodeIds = useCallback(() => {
    const ids = new Set<string>();

    // choose triggers by type
    const triggerCandidates = wf.nodes.filter((n) => {
      const t = String((n.data as any)?.type ?? n.type ?? "");
      return t.toLowerCase().includes("trigger");
    });
    const triggers = triggerCandidates.length
      ? triggerCandidates
      : (() => {
          // fallback: roots
          const targets = new Set(wf.edges.map((e) => e.target));
          const roots = wf.nodes.filter((n) => !targets.has(n.id));
          return roots.length ? roots : wf.nodes.slice(0, 1);
        })();

    triggers.forEach((n) => ids.add(n.id));

    // follow edges from triggers to ai-agent nodes
    const aiAgents: string[] = [];
    triggers.forEach((t) => {
      wf.edges
        .filter((e) => e.source === t.id)
        .forEach((e) => {
          const target = wf.nodes.find((n) => n.id === e.target);
          const tType = String((target?.data as any)?.type ?? target?.type ?? "");
          if (target && tType === "ai-agent") {
            aiAgents.push(target.id);
            ids.add(target.id);
          }
        });
    });

    // from each ai-agent, find model child (sourceHandle === "model")
    aiAgents.forEach((agentId) => {
      const modelEdge = wf.edges.find((e) => e.source === agentId && e.sourceHandle === "model");
      if (!modelEdge) return;
      const modelNode = wf.nodes.find((n) => n.id === modelEdge.target);
      if (modelNode) ids.add(modelNode.id);
    });

    return Array.from(ids);
  }, [wf.nodes, wf.edges]);

  const setRunStatusForPath = useCallback(
    (status: NodeRunStatus, autoClearMs?: number) => {
      const ids = computeChatPathNodeIds();
      if (!ids.length) return;
      setRunHighlights((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          next[id] = status;
        });
        return next;
      });

      if (autoClearMs) {
        window.setTimeout(() => {
          setRunHighlights((prev) => {
            const next = { ...prev };
            ids.forEach((id) => {
              if (next[id] === status) {
                delete next[id];
              }
            });
            return next;
          });
        }, autoClearMs);
      }
    },
    [computeChatPathNodeIds]
  );
  // Backward-compat alias to avoid stale HMR references.
  const setTriggerRunStatus = setRunStatusForPath;

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("savedWorkflows");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setProjects(parsed);
        }
      } else {
        setProjects(MOCK_PROJECTS);
      }
    } catch (err) {
      console.warn("Failed to load saved workflows", err);
      setProjects(MOCK_PROJECTS);
    }
  }, []);

  React.useEffect(() => {
    setRunHighlights((prev) => {
      const allowed = new Set(wf.nodes.map((n) => n.id));
      let changed = false;
      const next: Record<string, NodeRunStatus> = {};
      for (const [id, status] of Object.entries(prev)) {
        if (allowed.has(id)) {
          next[id] = status;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [wf.nodes]);

  const persistProjects = useCallback((next: typeof projects) => {
    setProjects(next);
    try {
      localStorage.setItem("savedWorkflows", JSON.stringify(next));
    } catch (err) {
      console.warn("Failed to persist workflows", err);
    }
  }, []);

  const saveCurrentProject = useCallback(() => {
    const name = newProjectName.trim() || `Workflow ${projects.length + 1}`;
    const entry = { id: nextId("proj"), name, workflow: wf, savedAt: Date.now() };
    const next = [entry, ...projects];
    persistProjects(next);
    setNewProjectName("");
    setView("projects");
  }, [newProjectName, projects, wf, persistProjects]);

  const loadProject = useCallback(
    (id: string) => {
      const match = projects.find((p) => p.id === id);
      if (!match) return;
      setWf(match.workflow);
      setSelectedNodeId(null);
      setRunHighlights({});
      setView("workflow");
    },
    [projects]
  );

  const handleImportFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setImportError(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result ?? ""));
          if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).nodes)) {
            throw new Error("Invalid workflow file (missing nodes)");
          }
          setWf(parsed as WorkflowState);
          setSelectedNodeId(null);
          setRunHighlights({});
          setView("workflow");
          setShowImport(false);
        } catch (err: any) {
          setImportError(err?.message ?? "Failed to import workflow");
        }
      };
      reader.onerror = () => setImportError("Could not read file");
      reader.readAsText(file);
    },
    []
  );

  const addNode = useCallback(
    (t: PaletteNodeType, options?: NodeAddOptions) => {
      setView("workflow");
      const id = nextId();
      const nodeType = t.type === "ai-agent" ? "aiAgent" : t.type === "tool" ? "aiTool" : "default";
      const config = defaultConfigForType(t);
      const connectFrom = options?.connectFrom ?? pendingAttach?.connectFrom ?? null;
      setWf((prev) => {
        const sourceNode = connectFrom?.nodeId ? prev.nodes.find((n) => n.id === connectFrom.nodeId) : null;
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
          connectFrom?.nodeId && connectFrom?.handleId
            ? {
                id: nextId("e"),
                source: connectFrom.nodeId,
                sourceHandle: connectFrom.handleId,
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
      if (pendingAttach) {
        setPendingAttach(null);
      }
    },
    [pendingAttach]
  );

  const reset = useCallback(() => {
    setWf(DEFAULT_WORKFLOW);
    setSelectedNodeId(null);
    setPendingAttach(null);
    setPaletteSearch("");
    setRunHighlights({});
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

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => [...prev.slice(-99), line]);
  }, []);

  const handleRunStart = useCallback(() => setRunStatusForPath("running"), [setRunStatusForPath]);
  const handleRunComplete = useCallback(() => setRunStatusForPath("success", 1400), [setRunStatusForPath]);
  const handleRunError = useCallback(() => setRunStatusForPath("error", 1800), [setRunStatusForPath]);

  const chatResizeState = useRef<{ startY: number; startHeight: number } | null>(null);
  const onChatResizeMove = useCallback((e: MouseEvent) => {
    if (!chatResizeState.current) return;
    const delta = chatResizeState.current.startY - e.clientY;
    const next = chatResizeState.current.startHeight + delta;
    const minH = 220;
    const maxH = Math.max(minH, Math.min(window.innerHeight * 0.8, next));
    setChatHeight(maxH);
  }, []);

  const endChatResize = useCallback(() => {
    chatResizeState.current = null;
    setIsResizingChat(false);
    window.removeEventListener("mousemove", onChatResizeMove);
    window.removeEventListener("mouseup", endChatResize);
  }, [onChatResizeMove]);

  const beginChatResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      chatResizeState.current = { startY: e.clientY, startHeight: chatHeight };
      setIsResizingChat(true);
      window.addEventListener("mousemove", onChatResizeMove);
      window.addEventListener("mouseup", endChatResize);
    },
    [chatHeight, onChatResizeMove, endChatResize]
  );

  React.useEffect(
    () => () => {
      window.removeEventListener("mousemove", onChatResizeMove);
      window.removeEventListener("mouseup", endChatResize);
    },
    [onChatResizeMove, endChatResize]
  );

  return (
    <div
      className="app"
      style={{
        gridTemplateColumns: `${showPalette ? "320px" : "32px"} 1fr`,
        gridTemplateRows: "1fr",
      }}
    >
      <NodePalette
        collapsed={!showPalette}
        onToggle={() => {
          setView("workflow");
          setShowPalette((v) => !v);
        }}
        onAdd={(t) => addNode(t)}
        onClear={reset}
        searchTerm={paletteSearch}
        onSearchChange={setPaletteSearch}
        pendingKind={pendingAttach?.kind}
        onOpenProjects={() => {
          setView("projects");
          setShowPalette(false);
        }}
        onOpenImport={() => {
          setShowImport(true);
          setShowPalette(false);
          setView("workflow");
        }}
      />

      <div className="workspace">
        {view === "projects" ? (
          <div className="panel" style={{ margin: "12px 8px", height: "100%" }}>
            <div className="panelHeader">
              <div className="panelTitle">Projects</div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btnSmall" onClick={() => setView("workflow")}>
                  Back to workflow
                </button>
                <button className="btn btnPrimary btnSmall" onClick={saveCurrentProject}>
                  Save current
                </button>
              </div>
            </div>
            <div className="panelBody" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <input
                  className="input"
                  placeholder="Name this workflow"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
                <span className="small muted">Saved locally (mock data)</span>
              </div>
              <div className="col" style={{ gap: 8, maxHeight: 480, overflow: "auto" }}>
                {projects.length === 0 ? (
                  <div className="small muted">No saved projects yet.</div>
                ) : (
                  projects.map((p) => (
                    <button
                      key={p.id}
                      className="btn"
                      onClick={() => loadProject(p.id)}
                      style={{ textAlign: "left" }}
                    >
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 650 }}>{p.name}</div>
                          <div className="small muted">
                            Saved {new Date(p.savedAt).toLocaleString()}
                          </div>
                        </div>
                        <span className="kbd">Open</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="workflowStage">
            <div className="canvasWrap">
              <WorkflowCanvas
                state={wf}
                onChange={setWf}
                onSelectNode={handleSelectNode}
                onRemoveNode={deleteNode}
                onAddNode={addNode}
                onStartAttach={({ kind, sourceId, handleId }) => {
                  setShowPalette(true);
                  setPaletteSearch(kind);
                  setPendingAttach({ kind, connectFrom: { nodeId: sourceId, handleId } });
                }}
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
                runHighlights={runHighlights}
              />

              {!showChatPanel ? (
                <button
                  className="chatFab"
                  onClick={() => {
                    setChatExpanded(false);
                    setShowChatPanel(true);
                  }}
                  title="Open chat"
                >
                  Chat
                </button>
              ) : null}
            </div>

            <div
              className={`chatDock ${showChatPanel ? "open" : "closed"} ${chatExpanded ? "expanded" : ""} ${isResizingChat ? "resizing" : ""}`}
              style={{ height: showChatPanel ? `${chatHeight}px` : 0 }}
            >
              {showChatPanel ? (
                <div className="chatResizeHandle" onMouseDown={beginChatResize} title="Drag to resize">
                  <div className="chatResizeGrip" />
                </div>
              ) : null}
              {showChatPanel ? (
                <div className="panel chatDockPanel">
                  <div className="panelHeader">
                    <div className="panelTitle">Assistant Console</div>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        className="btn btnSmall"
                        onClick={() => {
                          setChatExpanded(false);
                          setShowChatPanel(false);
                        }}
                        title="Collapse"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                  <div className="panelBody chatDockContent">
                    <div className="chatColumn">
                      <ChatPanel
                        agent={agent}
                        status={status as any}
                        statusText={statusText}
                        onToolCall={handleToolCall as any}
                        inputPayload={chatInputPayload}
                        focusHotkeyRef={chatFocusRef}
                        onLog={appendLog}
                        onRunStart={handleRunStart}
                        onRunComplete={handleRunComplete}
                        onRunError={handleRunError}
                        unstyled
                      />
                    </div>
                    <div className="logColumn">
                      <div className="sectionHeader">
                        <div className="panelTitle" style={{ margin: 0 }}>Logs</div>
                        <button className="btn btnSmall" onClick={() => setLogs([])}>
                          Clear
                        </button>
                      </div>
                      <div className="logListWrap">
                        {logs.length === 0 ? (
                          <div className="small muted">Logs will appear here.</div>
                        ) : (
                          <div className="logList">
                            {logs.map((l, idx) => (
                              <div key={idx} className="logLine">
                                {l}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
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

      {showImport ? (
        <div className="jsonModal" onClick={() => setShowImport(false)}>
          <div
            className="jsonModalCard"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 650 }}>Import workflow</div>
              <button className="btn btnSmall" onClick={() => setShowImport(false)}>
                Close
              </button>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <input
                type="file"
                accept="application/json"
                onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
              />
              <div className="small muted">Upload a workflow JSON file exported from this app.</div>
              {importError ? <div className="small" style={{ color: "var(--danger)" }}>{importError}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
