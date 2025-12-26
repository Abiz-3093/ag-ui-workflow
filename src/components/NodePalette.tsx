import React from "react";
import { NODE_BASE, type NodeTemplate } from "../nodes/nodeBase";

export type PaletteNodeType = NodeTemplate;

export type NodeAddOptions = {
  position?: { x: number; y: number };
  connectFrom?: { nodeId: string; handleId?: string };
};

type GroupId = "model" | "memory" | "tool" | "ai" | "workflow";

const MODEL_LIBRARY: PaletteNodeType[] = [
  {
    type: "model",
    label: "gpt-4o",
    description: "OpenAI flagship chat model",
    category: "Models",
    defaults: { config: { model: "gpt-4o" } },
  },
  {
    type: "model",
    label: "gpt-4o-mini",
    description: "Fast & cost-efficient OpenAI model",
    category: "Models",
    defaults: { config: { model: "gpt-4o-mini" } },
  },
  {
    type: "model",
    label: "gpt-4.1-mini",
    description: "OpenAI balanced model",
    category: "Models",
    defaults: { config: { model: "gpt-4.1-mini" } },
  },
  {
    type: "model",
    label: "claude-3-opus",
    description: "Anthropic Opus",
    category: "Models",
    defaults: { config: { model: "claude-3-opus" } },
  },
  {
    type: "model",
    label: "llama-3-70b",
    description: "Meta Llama 3 70B",
    category: "Models",
    defaults: { config: { model: "llama-3-70b" } },
  },
];

const MEMORY_LIBRARY: PaletteNodeType[] = [
  {
    type: "memory",
    label: "Conversation Buffer",
    description: "Store and replay recent turns",
    category: "Memory",
    defaults: { config: { memory: "conversation-buffer" } },
  },
  {
    type: "memory",
    label: "Vector Store",
    description: "Embed and recall documents",
    category: "Memory",
    defaults: { config: { memory: "vector-store" } },
  },
  {
    type: "memory",
    label: "Stateless",
    description: "No persisted context",
    category: "Memory",
    defaults: { config: { memory: "none" } },
  },
];

const TOOL_LIBRARY: PaletteNodeType[] = [
  {
    type: "tool",
    label: "Web Search",
    description: "Search docs or the web",
    category: "Tools",
    defaults: { config: { tools: [{ name: "web-search", kind: "retrieval" }] } },
  },
  {
    type: "tool",
    label: "HTTP Request",
    description: "Call downstream APIs",
    category: "Tools",
    defaults: { config: { tools: [{ name: "http-request", kind: "action" }] } },
  },
  {
    type: "tool",
    label: "Custom Tool",
    description: "Bring your own action",
    category: "Tools",
    defaults: { config: { tools: [] } },
  },
];

const GROUPS: { id: GroupId; label: string; description: string; matcher: (t: PaletteNodeType) => boolean }[] = [
  {
    id: "model",
    label: "Model",
    description: "Chat/completion models",
    matcher: (t) => t.type === "model",
  },
  {
    id: "memory",
    label: "Memory",
    description: "Pick how conversations are stored",
    matcher: (t) => t.type === "memory",
  },
  {
    id: "tool",
    label: "Tool",
    description: "Add agent tools (actions/retrieval)",
    matcher: (t) => t.type === "tool" || t.type === "mcp-tool",
  },
  {
    id: "ai",
    label: "AI Agent",
    description: "Full agent with model/memory/tool ports",
    matcher: (t) => t.type === "ai-agent",
  },
  {
    id: "workflow",
    label: "Workflow",
    description: "Triggers, HTTP, logic, files",
    matcher: (t) => !["model", "memory", "tool", "mcp-tool", "ai-agent"].includes(t.type),
  },
];

export default function NodePalette(props: {
  collapsed?: boolean;
  onToggle?: () => void;
  onAdd: (t: PaletteNodeType, options?: NodeAddOptions) => void;
  onClear: () => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  pendingKind?: "model" | "memory" | "tool";
  onOpenProjects?: () => void;
  onOpenImport?: () => void;
}) {
  const [types, setTypes] = React.useState<PaletteNodeType[]>(() => [
    ...NODE_BASE,
    ...MODEL_LIBRARY,
    ...MEMORY_LIBRARY,
    ...TOOL_LIBRARY,
  ]);
  const [localSearch, setLocalSearch] = React.useState("");
  const search = props.searchTerm ?? localSearch;
  const setSearch = props.onSearchChange ?? setLocalSearch;
  const [newLabel, setNewLabel] = React.useState("");
  const [newType, setNewType] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [showPicker, setShowPicker] = React.useState(true);
  const [activeGroup, setActiveGroup] = React.useState<GroupId | null>(null);

  React.useEffect(() => {
    if (props.pendingKind) {
      setShowPicker(true);
      setActiveGroup(props.pendingKind);
      setSearch(props.pendingKind);
    }
  }, [props.pendingKind, setSearch]);

  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return GROUPS.filter((g) => `${g.label} ${g.description}`.toLowerCase().includes(q));
  }, [search]);

  const filteredTypes = React.useMemo(() => {
    if (!activeGroup) return [];
    const matcher = GROUPS.find((g) => g.id === activeGroup)?.matcher;
    const q = search.trim().toLowerCase();
    const base = matcher ? types.filter(matcher) : [];
    if (!q) return base;
    return base.filter((t) => `${t.label} ${t.description} ${t.type}`.toLowerCase().includes(q));
  }, [activeGroup, search, types]);

  function addCustom() {
    const label = newLabel.trim();
    const type = (newType || label || "custom").trim().toLowerCase().replace(/\s+/g, "-");
    const description = newDesc.trim() || "Custom node";
    if (!label) return;
    setTypes((prev) => [...prev, { type, label, description }]);
    setNewLabel("");
    setNewType("");
    setNewDesc("");
  }

  return (
    <div className="panel" style={{ position: "relative", overflow: "visible" }}>
      <div className="panelHeader" style={{ display: props.collapsed ? "none" : undefined }}>
        <div className="panelTitle">
          <img
            src="../public/assets/fevicon.png"
            alt="Deepview"
            style={{ height: 32, width: "auto", display: "block" }}
          />
        </div>
        <button className="btn btnSmall btnDanger" onClick={props.onClear} title="Reset graph">
          Reset
        </button>
      </div>

      {props.collapsed ? (
        <button
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
            background: "transparent",
            border: "none",
            color: "var(--text)",
            fontSize: 18,
            cursor: "pointer",
            padding: 4,
            lineHeight: 1,
          }}
          onClick={() => {
            setShowPicker(true);
            props.onToggle?.();
          }}
          title="Add node"
        >
          +
        </button>
      ) : null}
      {props.collapsed ? (
        <button
          style={{
            position: "absolute",
            top: 40,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
            background: "transparent",
            border: "none",
            color: "var(--text)",
            fontSize: 18,
            cursor: "pointer",
            padding: 4,
            lineHeight: 1,
          }}
          onClick={() => props.onOpenProjects?.()}
          title="Projects"
        >
          📁
        </button>
      ) : null}
      {props.collapsed ? (
        <button
          style={{
            position: "absolute",
            top: 72,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
            background: "transparent",
            border: "none",
            color: "var(--text)",
            fontSize: 18,
            cursor: "pointer",
            padding: 4,
            lineHeight: 1,
          }}
          onClick={() => props.onOpenImport?.()}
          title="Import workflow"
        >
          ⬆
        </button>
      ) : null}

      <div className="panelBody" style={{ display: props.collapsed ? "none" : undefined }}>
        <div className="small muted">
          Drag & drop is possible, but for this demo click to add. Tip: select a node to edit its details.
        </div>

        <div className="hr" />

        {showPicker ? (
          <div className="col" style={{ gap: 12 }}>
            <div style={{ fontWeight: 650 }}>What are you looking for?</div>
            <input
              className="input"
              placeholder="Search groups or nodes (e.g. model, memory, tool)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {activeGroup ? (
              <div className="col" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <button className="btn btnSmall" onClick={() => setActiveGroup(null)}>
                    ← Back
                  </button>
                  <div style={{ fontWeight: 650 }}>
                    {GROUPS.find((g) => g.id === activeGroup)?.label} options
                  </div>
                  <span className="small muted">
                    {filteredTypes.length} option{filteredTypes.length === 1 ? "" : "s"}
                  </span>
                </div>
                {filteredTypes.length === 0 ? (
                  <div className="small muted">No nodes in this group.</div>
                ) : (
                  filteredTypes.map((t, idx) => (
                    <button
                      key={`${t.type}-${t.label}-${idx}`}
                      className="btn"
                      onClick={() => {
                        props.onAdd(t);
                        setShowPicker(true);
                        setActiveGroup(null);
                        setSearch("");
                      }}
                      style={{ textAlign: "left" }}
                    >
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 650 }}>{t.label}</div>
                          <div className="small muted">{t.description}</div>
                        </div>
                        <span className="kbd">+</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="col" style={{ gap: 6 }}>
                {filteredGroups.length === 0 ? (
                  <div className="small muted">No matching groups.</div>
                ) : (
                  filteredGroups.map((g) => (
                    <button
                      key={g.id}
                      className="btn"
                      onClick={() => setActiveGroup(g.id)}
                      style={{ textAlign: "left" }}
                    >
                      <div style={{ fontWeight: 650 }}>{g.label}</div>
                      <div className="small muted">{g.description}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}

        <div className="hr" />
      </div>
      <button
        className="collapseBtn edgeToggle"
        onClick={props.onToggle}
        title={props.collapsed ? "Open panel" : "Collapse panel"}
      >
        {props.collapsed ? ">" : "<"}
      </button>
    </div>
  );
}
