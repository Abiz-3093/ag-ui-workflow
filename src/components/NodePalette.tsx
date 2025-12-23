import React from "react";

export type PaletteNodeType = {
  type: string;
  label: string;
  description: string;
};

export type NodeAddOptions = {
  position?: { x: number; y: number };
  connectFrom?: { nodeId: string; handleId?: string };
};

const DEFAULT_TYPES: PaletteNodeType[] = [
  { type: "ai-agent", label: "AI Agent", description: "LLM with model/memory/tools" },
  { type: "trigger", label: "Trigger", description: "Start the workflow" },
  { type: "http", label: "HTTP Request", description: "Call an API" },
  { type: "transform", label: "Transform", description: "Map/shape data" },
  { type: "if", label: "If / Branch", description: "Conditional logic" },
  { type: "delay", label: "Delay", description: "Wait for a duration" },
  { type: "email", label: "Send Email", description: "Notify someone" },
];

export default function NodePalette(props: {
  collapsed?: boolean;
  onToggle?: () => void;
  onAdd: (t: PaletteNodeType, options?: NodeAddOptions) => void;
  onClear: () => void;
}) {
  const [types, setTypes] = React.useState<PaletteNodeType[]>(DEFAULT_TYPES);
  const [newLabel, setNewLabel] = React.useState("");
  const [newType, setNewType] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");

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

  function removeType(idx: number) {
    setTypes((prev) => prev.filter((_, i) => i !== idx));
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

      <div className="panelBody" style={{ display: props.collapsed ? "none" : undefined }}>
        <div className="small muted">
          Drag & drop is possible, but for this demo click to add. Tip: select a node to edit its details.
        </div>

        <div className="hr" />

        <div className="col">
          {types.map((t, idx) => (
            <button
              key={t.type}
              className="btn"
              onClick={() => props.onAdd(t)}
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
          ))}
        </div>

        <div className="hr" />

        <div className="col">
          <div style={{ fontWeight: 650 }}>Add palette card</div>
          <input
            className="input"
            placeholder="Label (e.g. AI Agent)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <input
            className="input"
            placeholder="Type id (optional, e.g. ai-agent-2)"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          />
          <input
            className="input"
            placeholder="Description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <button className="btn btnPrimary" onClick={addCustom}>
            Add card
          </button>
        </div>

        <div className="small muted">
          Keyboard:
          <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <span className="pill">
              <span className="kbd">Del</span> delete selected
            </span>
            <span className="pill">
              <span className="kbd">Ctrl</span>+<span className="kbd">K</span> focus chat
            </span>
          </div>
        </div>
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
