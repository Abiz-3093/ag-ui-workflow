import React from "react";
import type { Node } from "reactflow";
import type { WorkflowState } from "./WorkflowCanvas";

export default function NodeInspector(props: {
  selected: Node | null;
  state: WorkflowState;
  onUpdate: (patch: Partial<Node>) => void;
  onUpdateNode: (id: string, patch: Partial<Node>) => void;
  onClose?: () => void;
}) {
  const node = props.selected;

  if (!node) {
    return (
      <div className="panel" style={{ flex: 1 }}>
        <div className="panelHeader">
          <div className="panelTitle">Node Details</div>
          <span className="badge">Inspector</span>
        </div>
        <div className="panelBody">
          <div className="muted">Select a node to see and edit its details.</div>
        </div>
      </div>
    );
  }

  const label = String((node.data as any)?.label ?? "");
  const type = String((node.data as any)?.type ?? node.type ?? "");
  const data = (node.data as any) ?? {};
  const config = data.config ?? {};

  const agentConfig = {
    model: config.model ?? "gpt-4o-mini",
    memory: config.memory ?? "conversation-buffer",
    tools: Array.isArray(config.tools) ? config.tools : [],
  };

  function updateConfig(patch: Record<string, unknown>) {
    props.onUpdate({ data: { ...data, config: { ...config, ...patch } } });
  }

  function updateOtherNode(id: string, patch: Partial<Node>) {
    props.onUpdateNode(id, patch);
  }

  const downstreamEdges = props.state.edges.filter((e) => e.source === node.id);
  const childForHandle = (handle: string) =>
    downstreamEdges
      .filter((e) => e.sourceHandle === handle)
      .map((e) => props.state.nodes.find((n) => n.id === e.target))
      .filter(Boolean) as Node[];

  const modelNodes = childForHandle("model");
  const memoryNodes = childForHandle("memory");
  const toolNodes = childForHandle("tool");

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panelHeader">
        <div className="panelTitle">
          Node Details <span className="badge">{node.id}</span>
        </div>
        <span className="badge">Inspector</span>
      </div>

      <div className="panelBody">
        <div className="col">
          <label className="small muted">Label</label>
          <input
            className="input"
            value={label}
            onChange={(e) => props.onUpdate({ data: { ...(node.data as any), label: e.target.value } })}
          />

          <label className="small muted">Type</label>
          <input
            className="input"
            value={type}
            onChange={(e) =>
              props.onUpdate({ data: { ...(node.data as any), type: e.target.value } })
            }
          />

          {type === "ai-agent" ? (
            <div className="col" style={{ padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,.04)" }}>
              <div style={{ fontWeight: 650 }}>AI Agent Details</div>

              <div className="col" style={{ gap: 6 }}>
                <div className="row" style={{ alignItems: "center" }}>
                  <label className="small muted" style={{ width: 80 }}>Model</label>
                  <div className="pill">
                    {modelNodes.length ? (modelNodes[0].data as any)?.label ?? modelNodes[0].id : "None"}
                  </div>
                </div>

                <div className="row" style={{ alignItems: "center" }}>
                  <label className="small muted" style={{ width: 80 }}>Memory</label>
                  <div className="pill">
                    {memoryNodes.length ? (memoryNodes[0].data as any)?.label ?? memoryNodes[0].id : "None"}
                  </div>
                </div>

                <label className="small muted">Tools</label>
                <div className="col" style={{ gap: 6 }}>
                  {toolNodes.length === 0 ? (
                    <div className="small muted">No tools attached yet. Use the "+" on the AI Agent node to add.</div>
                  ) : (
                    toolNodes.map((toolNode) => {
                      const tData = (toolNode.data as any) ?? {};
                      const toolConfig = Array.isArray(tData.config?.tools) ? tData.config.tools : [];
                      return (
                        <div
                          key={toolNode.id}
                          className="row"
                          style={{ justifyContent: "space-between", border: "1px solid var(--border)", padding: "6px 8px", borderRadius: 10 }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{tData.label ?? toolNode.id}</div>
                            <div className="small muted">{toolConfig.length ? `${toolConfig.length} tool${toolConfig.length > 1 ? "s" : ""}` : "No tools configured"}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {type === "model" ? (
            <ModelEditor node={node} onUpdate={props.onUpdate} />
          ) : null}

          {type === "memory" ? (
            <MemoryEditor node={node} onUpdate={props.onUpdate} />
          ) : null}

          {type === "tool" ? (
            <ToolEditor node={node} onUpdateNode={updateOtherNode} />
          ) : null}

        </div>
      </div>
    </div>
  );
}

function ModelEditor(props: { node: Node; onUpdate: (patch: Partial<Node>) => void }) {
  const data = (props.node.data as any) ?? {};
  const config = data.config ?? {};
  const model = config.model ?? "gpt-4o-mini";
  const guardrail = config.guardrail ?? "";
  const endpoint = config.endpoint ?? "";
  const apiKey = config.apiKey ?? "";
  return (
    <div className="col" style={{ padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,.04)" }}>
      <div style={{ fontWeight: 650 }}>Model Settings</div>
      <label className="small muted">Model</label>
      <select
        className="select"
        value={model}
        onChange={(e) => props.onUpdate({ data: { ...data, config: { ...config, model: e.target.value } } })}
      >
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4.1-mini">gpt-4.1-mini</option>
        <option value="claude-3-opus">claude-3-opus</option>
        <option value="llama-3-70b">llama-3-70b</option>
      </select>
      <label className="small muted">Guardrail</label>
      <input
        className="input"
        placeholder="Guardrail id or policy (optional)"
        value={guardrail}
        onChange={(e) =>
          props.onUpdate({
            data: { ...data, config: { ...config, guardrail: e.target.value } },
          })
        }
      />
      <label className="small muted">Endpoint</label>
      <input
        className="input"
        placeholder="https://api.yourmodel.com/v1/responses"
        value={endpoint}
        onChange={(e) =>
          props.onUpdate({
            data: { ...data, config: { ...config, endpoint: e.target.value } },
          })
        }
      />
      <label className="small muted">API Key</label>
      <input
        className="input"
        type="password"
        placeholder="API key (stored locally in this demo)"
        value={apiKey}
        onChange={(e) =>
          props.onUpdate({
            data: { ...data, config: { ...config, apiKey: e.target.value } },
          })
        }
      />
    </div>
  );
}

function MemoryEditor(props: { node: Node; onUpdate: (patch: Partial<Node>) => void }) {
  const data = (props.node.data as any) ?? {};
  const config = data.config ?? {};
  const memory = config.memory ?? "conversation-buffer";
  return (
    <div className="col" style={{ padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,.04)" }}>
      <div style={{ fontWeight: 650 }}>Memory Settings</div>
      <label className="small muted">Memory</label>
      <select
        className="select"
        value={memory}
        onChange={(e) => props.onUpdate({ data: { ...data, config: { ...config, memory: e.target.value } } })}
      >
        <option value="conversation-buffer">Conversation buffer</option>
        <option value="vector-store">Vector store</option>
        <option value="none">Stateless</option>
      </select>
    </div>
  );
}

function ToolEditor(props: { node: Node; onUpdateNode: (id: string, patch: Partial<Node>) => void }) {
  const data = (props.node.data as any) ?? {};
  const config = data.config ?? {};
  const tools = Array.isArray(config.tools) ? config.tools : [];
  const [toolDraft, setToolDraft] = React.useState("");
  const [toolKind, setToolKind] = React.useState("action");

  const updateTools = (nextTools: any[]) => {
    props.onUpdateNode(props.node.id, { data: { ...data, config: { ...config, tools: nextTools } } });
  };

  return (
    <div className="col" style={{ padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,.04)" }}>
      <div style={{ fontWeight: 650 }}>Tools</div>
      <div className="col" style={{ gap: 6 }}>
        {tools.length === 0 ? (
          <div className="small muted">No tools yet.</div>
        ) : (
          tools.map((t: any, i: number) => (
            <div
              key={i}
              className="row"
              style={{ justifyContent: "space-between", border: "1px solid var(--border)", padding: "6px 8px", borderRadius: 10 }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{t.name ?? "tool"}</div>
                <div className="small muted">{t.kind ?? t.description ?? "custom tool"}</div>
              </div>
              <button
                className="btn btnSmall"
                onClick={() => updateTools(tools.filter((_t: any, idx: number) => idx !== i))}
                title="Remove tool"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Tool name (e.g. web-search)"
          value={toolDraft}
          onChange={(e) => setToolDraft(e.target.value)}
        />
        <select
          className="select"
          style={{ width: 140 }}
          value={toolKind}
          onChange={(e) => setToolKind(e.target.value)}
        >
          <option value="action">Action</option>
          <option value="retrieval">Retrieval</option>
          <option value="memory">Memory</option>
        </select>
        <button
          className="btn btnPrimary btnSmall"
          onClick={() => {
            const name = toolDraft.trim();
            if (!name) return;
            updateTools([...tools, { name, kind: toolKind }]);
            setToolDraft("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
