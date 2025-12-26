import React, { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { NodeAddOptions, PaletteNodeType } from "./NodePalette";

export type WorkflowState = {
  nodes: Node[];
  edges: Edge[];
};

export const DEFAULT_WORKFLOW: WorkflowState = {
  nodes: [
    {
      id: "1",
      type: "default",
      position: { x: 120, y: 120 },
      data: { label: "Trigger", type: "trigger", config: { schedule: "manual" } },
    },
    {
      id: "3",
      type: "aiAgent",
      position: { x: 420, y: 120 },
      data: {
        label: "AI Agent",
        type: "ai-agent",
        config: {
          model: "gpt-4o-mini",
          memory: "conversation-buffer",
          endpoint: "",
          apiKey: "",
          guardrail: "",
          tools: [
            { name: "web-search", description: "Search docs or the web" },
            { name: "http-request", description: "Call downstream APIs" },
          ],
        },
      },
    },
    {
      id: "2",
      type: "default",
      position: { x: 720, y: 120 },
      data: { label: "Transform", type: "transform", config: { mapping: {} } },
    },
  ],
  edges: [
    { id: "e1-3", source: "1", target: "3" },
    { id: "e3-2", source: "3", target: "2" },
  ],
};

export default function WorkflowCanvas(props: {
  state: WorkflowState;
  onChange: (next: WorkflowState) => void;
  onSelectNode: (node: Node | null, openInspector?: boolean) => void;
  onRemoveNode?: (id: string) => void;
  onAddNode?: (t: PaletteNodeType, options?: NodeAddOptions) => void;
  onStartAttach?: (args: { kind: "model" | "memory" | "tool"; sourceId: string; handleId: string }) => void;
  onViewJson?: () => void;
  onDeploy?: () => void;
}) {
  const handleRemove = useCallback((id: string) => props.onRemoveNode?.(id), [props.onRemoveNode]);
  const handleAdd = useCallback(
    (t: PaletteNodeType, options?: NodeAddOptions) => props.onAddNode?.(t, options),
    [props.onAddNode]
  );

  const onConnect = useCallback(
    (params: Edge | Connection) =>
      props.onChange({
        nodes: props.state.nodes,
        edges: addEdge({ ...params, animated: true }, props.state.edges),
      }),
    [props]
  );

  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) =>
      props.onChange({
        nodes: applyNodeChanges(changes, props.state.nodes),
        edges: props.state.edges,
      }),
    [props]
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) =>
      props.onChange({
        nodes: props.state.nodes,
        edges: applyEdgeChanges(changes, props.state.edges),
      }),
    [props]
  );

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const nodeTypes = useMemo(
    () => ({
      aiAgent: (p: NodeProps) => (
        <AiAgentNode
          {...p}
          onRemove={handleRemove}
          onAddNode={handleAdd}
          onStartAttach={props.onStartAttach}
        />
      ),
      aiTool: (p: NodeProps) => (
        <AiToolNode
          {...p}
          onRemove={handleRemove}
          onAddNode={handleAdd}
          onStartAttach={props.onStartAttach}
        />
      ),
      default: (p: NodeProps) => (
        <CardNode
          {...p}
          onRemove={handleRemove}
          onAddNode={handleAdd}
        />
      ),
    }),
    [handleRemove, handleAdd]
  );

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <div className="panelHeader">
        <div className="panelTitle">
          🧠 Workflow Canvas <span className="badge">React Flow</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="small muted">Click nodes to edit. Drag to rearrange.</span>
          {props.onViewJson ? (
            <button className="btn btnSmall" onClick={props.onViewJson} title="View workflow JSON">
              View JSON
            </button>
          ) : null}
          {props.onDeploy ? (
            <button className="btn btnPrimary btnSmall" onClick={props.onDeploy} title="Download workflow JSON">
              Deploy
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={props.state.nodes}
          edges={props.state.edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={({ nodes: selectedNodes }) =>
            props.onSelectNode(selectedNodes && selectedNodes.length > 0 ? selectedNodes[0] : null)
          }
          onNodeDoubleClick={(_, n) => props.onSelectNode(n, true)}
          onPaneClick={() => props.onSelectNode(null, false)}
          proOptions={proOptions}
          nodeTypes={nodeTypes}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

type NodeWithActions = NodeProps & {
  selected?: boolean;
  onRemove?: (id: string) => void;
  onAddNode?: (t: PaletteNodeType, options?: NodeAddOptions) => void;
  onStartAttach?: (args: { kind: "model" | "memory" | "tool"; sourceId: string; handleId: string }) => void;
};

function AiAgentNode(props: NodeWithActions) {
  const label = (props.data as any)?.label ?? "AI Agent";
  const addByKind = (kind: "model" | "memory" | "tool") => {
    if (props.onStartAttach) {
      props.onStartAttach({ kind, sourceId: props.id, handleId: kind });
      return;
    }
    props.onAddNode?.(
      {
        type: kind,
        label: kind === "model" ? "Chat Model" : kind === "memory" ? "Memory" : "Tool",
        description: `Auto-added ${kind}`,
      },
      {
        connectFrom: { nodeId: props.id, handleId: kind },
      }
    );
  };
  return (
    <div className={`aiAgentNode ${props.selected ? "aiAgentNodeSelected" : ""}`}>
      <Handle id="in" type="target" position={Position.Left} className="aiAgentHandle" />
      <div className="aiAgentBody">
        <div className="aiAgentIcon">🤖</div>
        <div className="aiAgentTitle">{label}</div>
        {props.onRemove ? (
          <button
            className="nodeDeleteBtn"
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove?.(props.id);
            }}
            title="Remove node"
          >
            ×
          </button>
        ) : null}
      </div>
      <Handle id="out" type="source" position={Position.Right} className="aiAgentHandle" />

      <div className="aiAgentPorts">
        <Port label="Chat Model" handleId="model" required onAdd={() => addByKind("model")} />
        <Port label="Memory" handleId="memory" onAdd={() => addByKind("memory")} />
        <Port label="Tool" handleId="tool" onAdd={() => addByKind("tool")} />
      </div>
    </div>
  );
}

function AiToolNode(props: NodeWithActions) {
  const label = (props.data as any)?.label ?? "AI Agent Tool";
  const addByKind = (kind: "model" | "memory" | "tool") => {
    if (props.onStartAttach) {
      props.onStartAttach({ kind, sourceId: props.id, handleId: kind });
      return;
    }
    props.onAddNode?.(
      {
        type: kind,
        label: kind === "model" ? "Chat Model" : kind === "memory" ? "Memory" : "Tool",
        description: `Auto-added ${kind}`,
      },
      {
        connectFrom: { nodeId: props.id, handleId: kind },
      }
    );
  };
  return (
    <div className={`aiAgentNode ${props.selected ? "aiAgentNodeSelected" : ""}`}>
      <Handle id="in" type="target" position={Position.Left} className="aiAgentHandle" />
      <div className="aiAgentBody">
        <div className="aiAgentIcon">⚙</div>
        <div className="aiAgentTitle">{label}</div>
        {props.onRemove ? (
          <button
            className="nodeDeleteBtn"
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove?.(props.id);
            }}
            title="Remove node"
          >
            A-
          </button>
        ) : null}
      </div>
      <Handle id="out" type="source" position={Position.Right} className="aiAgentHandle" />

      <div className="aiAgentPorts">
        <Port label="Chat Model" handleId="model" required onAdd={() => addByKind("model")} />
        <Port label="Memory" handleId="memory" onAdd={() => addByKind("memory")} />
        <Port label="Tool" handleId="tool" onAdd={() => addByKind("tool")} />
      </div>
    </div>
  );
}

function Port(props: { label: string; handleId: string; required?: boolean; onAdd?: () => void }) {
  return (
    <div className="aiAgentPort">
      <Handle
        id={props.handleId}
        type="source"
        position={Position.Bottom}
        className="aiAgentPortHandle"
      />
      <div className="aiAgentPortLabel">
        {props.label}
        {props.required ? <span className="aiAgentReq">*</span> : null}
      </div>
      <button
        className="aiAgentPortAdd"
        onClick={(e) => {
          e.stopPropagation();
          props.onAdd?.();
        }}
        title={`Add ${props.label}`}
      >
        +
      </button>
    </div>
  );
}

function CardNode(props: NodeWithActions) {
  const data = (props.data as any) ?? {};
  const label = data.label ?? props.id;
  const type = data.type ?? props.type;
  const isTrigger = type === "trigger" || type === "webhook-trigger" || type === "cron";

  return (
    <div className={`nodeCard ${props.selected ? "nodeCardSelected" : ""}`}>
      {isTrigger ? null : <Handle id="in" type="target" position={Position.Top} className="aiAgentHandle" />}
      <div className="nodeCardHeader">
        <div className="nodeCardTitle">{label}</div>
        {props.onRemove ? (
          <button
            className="nodeDeleteBtn"
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove?.(props.id);
            }}
            title="Remove node"
          >
            ×
          </button>
        ) : null}
      </div>
      <Handle id="out" type="source" position={Position.Bottom} className="aiAgentHandle" />
    </div>
  );
}
