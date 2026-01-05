import React from "react";
import { NODE_BASE, type NodeTemplate } from "../nodes/nodeBase";
import { iconForType } from "../iconMap";

export type PaletteNodeType = NodeTemplate;

export type NodeAddOptions = {
  position?: { x: number; y: number };
  connectFrom?: { nodeId: string; handleId?: string };
};

type GroupId = string;

const MODEL_LIBRARY: PaletteNodeType[] = [
  {
    type: "model",
    label: "LLM Model",
    description: "Chat/completion model",
    category: "Models",
    defaults: { config: { model: "gpt-4o-mini" } },
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

const SPECIAL_GROUPS: {
  id: GroupId;
  label: string;
  description: string;
  icon: string;
  matcher: (t: PaletteNodeType) => boolean;
}[] = [
  {
    id: "model",
    label: "Model",
    description: "Chat/completion models",
    icon: "fa-solid fa-microchip",
    matcher: (t) => t.type === "model",
  },
  {
    id: "memory",
    label: "Memory",
    description: "Pick how conversations are stored",
    icon: "fa-solid fa-database",
    matcher: (t) => t.type === "memory",
  },
  {
    id: "tool",
    label: "Tool",
    description: "Add agent tools (actions/retrieval)",
    icon: "fa-solid fa-screwdriver-wrench",
    matcher: (t) => t.type === "tool" || t.type === "mcp-tool",
  },
  {
    id: "ai",
    label: "AI Agent",
    description: "Full agent with model/memory/tool ports",
    icon: "fa-solid fa-robot",
    matcher: (t) => t.type === "ai-agent",
  },
];

const isSpecialType = (t: PaletteNodeType) =>
  ["model", "memory", "tool", "mcp-tool", "ai-agent"].includes(t.type);

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
  hideCollapseToggle?: boolean;
}) {
  const [types, setTypes] = React.useState<PaletteNodeType[]>(() => [
    ...NODE_BASE.filter((t) => t.type !== "model"),
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
  const [activeFilter, setActiveFilter] = React.useState<"all" | "trigger" | "ai" | "model" | "memory" | "tool">(
    "all"
  );

  const categoryGroups = React.useMemo(() => {
    const map = new Map<
      string,
      { id: GroupId; label: string; description: string; matcher: (t: PaletteNodeType) => boolean; icon?: string }
    >();
    const iconForCategory = (label: string) => {
      const key = label.toLowerCase();
      if (/model/.test(key)) return "fa-solid fa-microchip";
      if (/miscellaneous/.test(key)) return "fa-solid fa-ellipsis";
      if (/trigger/.test(key)) return "fa-solid fa-bolt";
      if (/ai/.test(key)) return "fa-solid fa-brain";
      if (/integration/.test(key)) return "fa-solid fa-plug";
      if (/core/.test(key)) return "fa-solid fa-layer-group";
      if (/analytics/.test(key)) return "fa-regular fa-chart-bar";
      if (/communication|comunication/.test(key)) return "fa-solid fa-globe";
      if (/data/.test(key)) return "fa-solid fa-table";
      if (/file/.test(key)) return "fa-solid fa-file-lines";
      if (/logic/.test(key)) return "fa-solid fa-diagram-project";
      return "fa-solid fa-layer-group";
    };

    types
      .filter((t) => !isSpecialType(t))
      .forEach((t) => {
        const label = t.category || "General";
        const id = `cat:${label.toLowerCase().replace(/\s+/g, "-")}`;
        if (map.has(id)) return;
        map.set(id, {
          id,
          label,
          description: `${label} nodes`,
          matcher: (n) => !isSpecialType(n) && (n.category || "General") === label,
          icon: iconForCategory(label),
        });
      });

    // Merge multiple Miscellaneous entries into one
    const miscIds = Array.from(map.keys()).filter((key) => key.includes("miscellaneous"));
    if (miscIds.length > 1) {
      miscIds.forEach((id) => map.delete(id));
      map.set("cat:miscellaneous", {
        id: "cat:miscellaneous",
        label: "Miscellaneous",
        description: "Miscellaneous nodes",
        matcher: (n) => !isSpecialType(n) && /miscellaneous/i.test(n.category || "Miscellaneous"),
        icon: "fa-solid fa-ellipsis",
      });
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [types]);

  const allGroups = React.useMemo(() => [...SPECIAL_GROUPS, ...categoryGroups], [categoryGroups]);

  React.useEffect(() => {
    if (props.pendingKind) {
      const hasGroup = allGroups.some((g) => g.id === props.pendingKind);
      setShowPicker(true);
      if (hasGroup) {
        setActiveGroup(props.pendingKind);
      }
      setSearch(props.pendingKind);
    }
  }, [props.pendingKind, setSearch, allGroups]);

  const matchesFilter = React.useCallback(
    (t: PaletteNodeType) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "trigger") return /trigger/i.test(t.type) || /trigger/i.test(t.label);
      if (activeFilter === "ai") return t.type === "ai-agent";
      if (activeFilter === "model") return t.type === "model";
      if (activeFilter === "memory") return t.type === "memory";
      if (activeFilter === "tool") return t.type === "tool" || t.type === "mcp-tool";
      return true;
    },
    [activeFilter]
  );

  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allGroups.filter((g) => `${g.label} ${g.description}`.toLowerCase().includes(q));
  }, [search, allGroups]);

  const searchMatches = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return types.filter(
      (t) => matchesFilter(t) && `${t.label} ${t.description} ${t.type}`.toLowerCase().includes(q)
    );
  }, [search, types, matchesFilter]);

  const filteredTypes = React.useMemo(() => {
    if (!activeGroup) return [];
    const matcher = allGroups.find((g) => g.id === activeGroup)?.matcher;
    const q = search.trim().toLowerCase();
    const base = matcher ? types.filter(matcher) : [];
    if (!q) return base;
    return base.filter(
      (t) => matchesFilter(t) && `${t.label} ${t.description} ${t.type}`.toLowerCase().includes(q)
    );
  }, [activeGroup, search, types, allGroups, matchesFilter]);

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

  const handleAdd = (t: PaletteNodeType) => {
    props.onAdd(t);
    setShowPicker(true);
    setActiveGroup(null);
    setSearch("");
  };

  const handleDragStart = (e: React.DragEvent, t: PaletteNodeType) => {
    e.dataTransfer.setData("application/reactflow-node", JSON.stringify(t));
    e.dataTransfer.effectAllowed = "move";
  };

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: "rgba(91,117,248,.18)", padding: "0 2px" }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="panel" style={{ position: "relative", overflow: "visible" }}>
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

        {showPicker ? (
          <div className="col" style={{ gap: 12 }}>
            <div style={{ fontWeight: 650 }}>What happens next?</div>

            <input
              className="input"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {activeGroup ? (
              <div className="col" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <button className="btn btnSmall" onClick={() => setActiveGroup(null)}>
                    Back
                  </button>
                  <div style={{ fontWeight: 650 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {(() => {
                        const grp = allGroups.find((g) => g.id === activeGroup);
                        if (!grp) return null;
                        return grp.icon ? <i className={grp.icon} aria-hidden="true" /> : null;
                      })()}
                      {allGroups.find((g) => g.id === activeGroup)?.label} options
                    </span>
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
                      onClick={() => handleAdd(t)}
                      style={{ textAlign: "left" }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t)}
                    >
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="row" style={{ alignItems: "center", gap: 10 }}>
                          {t.icon ? (
                            <img src={t.icon} alt="" style={{ height: 20, width: 20, objectFit: "contain" }} />
                          ) : (
                            <span aria-hidden="true">{iconForType(t.type)}</span>
                          )}
                          <div>
                            <div style={{ fontWeight: 650, display: "flex", alignItems: "center", gap: 6 }}>
                              {highlight(t.label, search)}
                              {/trigger/i.test(t.type) ? (
                                <span className="badge" style={{ padding: "2px 6px" }}>
                                  Trigger
                                </span>
                              ) : null}
                            </div>
                            <div className="small muted">
                              {highlight(t.description ?? "", search)}
                              {t.docUrl ? (
                                <>
                                  {" · "}
                                  <a href={t.docUrl} target="_blank" rel="noreferrer" className="small muted">
                                    Docs
                                  </a>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="row" style={{ alignItems: "center", gap: 6 }}>
                          <span className="kbd">+</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : search.trim() ? (
              <div className="col" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 650 }}>Search results</div>
                  <span className="small muted">
                    {searchMatches.length} match{searchMatches.length === 1 ? "" : "es"}
                  </span>
                </div>
                {searchMatches.length === 0 ? (
                  <div className="small muted">No nodes match that search.</div>
                ) : (
                  searchMatches.map((t, idx) => (
                    <button
                      key={`${t.type}-${t.label}-${idx}`}
                      className="btn"
                      onClick={() => handleAdd(t)}
                      style={{ textAlign: "left" }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t)}
                    >
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="row" style={{ alignItems: "center", gap: 10 }}>
                          {t.icon ? (
                            <img src={t.icon} alt="" style={{ height: 20, width: 20, objectFit: "contain" }} />
                          ) : (
                            <span aria-hidden="true">{iconForType(t.type)}</span>
                          )}
                          <div>
                            <div style={{ fontWeight: 650, display: "flex", alignItems: "center", gap: 6 }}>
                              {highlight(t.label, search)}
                              {/trigger/i.test(t.type) ? (
                                <span className="badge" style={{ padding: "2px 6px" }}>
                                  Trigger
                                </span>
                              ) : null}
                            </div>
                            <div className="small muted">
                              {highlight(t.description ?? "", search)}
                              {t.docUrl ? (
                                <>
                                  {" · "}
                                  <a href={t.docUrl} target="_blank" rel="noreferrer" className="small muted">
                                    Docs
                                  </a>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="row" style={{ alignItems: "center", gap: 6 }}>
                          <span className="kbd">+</span>
                        </div>
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
                      onClick={() => {
                        setActiveGroup(g.id);
                        setSearch("");
                      }}
                      style={{ textAlign: "left", display: "flex", alignItems: "flex-start", gap: 8 }}
                    >
                      {g.icon ? <i className={g.icon} aria-hidden="true" style={{ marginTop: 2 }} /> : null}
                      <div>
                        <div style={{ fontWeight: 650 }}>{g.label}</div>
                        <div className="small muted">{g.description}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}

        <div className="hr" />
      </div>
      {props.hideCollapseToggle ? null : (
        <button
          className="collapseBtn edgeToggle"
          onClick={props.onToggle}
          title={props.collapsed ? "Open panel" : "Collapse panel"}
        >
          {props.collapsed ? ">" : "<"}
        </button>
      )}
    </div>
  );
}
