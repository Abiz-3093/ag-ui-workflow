import React, { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import type { NodeAddOptions, PaletteNodeType } from "./NodePalette";
import { iconForType } from "../iconMap";

export type WorkflowState = {
  nodes: Node[];
  edges: Edge[];
};

export type NodeRunStatus = "running" | "success" | "error";

export const DEFAULT_WORKFLOW: WorkflowState = {
  nodes: [
    {
      id: "1",
      type: "default",
      position: { x: 120, y: 120 },
      data: { label: "Chat Trigger", type: "chat-trigger", config: { schedule: "manual" } },
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

type WorkflowCanvasProps = {
  state: WorkflowState;
  onChange: (next: WorkflowState) => void;
  onSelectNode: (node: Node | null, openInspector?: boolean) => void;
  onRemoveNode?: (id: string) => void;
  onAddNode?: (t: PaletteNodeType, options?: NodeAddOptions) => void;
  onStartAttach?: (args: { kind: "model" | "memory" | "tool"; sourceId: string; handleId: string }) => void;
  onViewJson?: () => void;
  onDeploy?: () => void;
  runHighlights?: Record<string, NodeRunStatus>;
  onSaveWorkflow?: () => void;
  onSelectionChange?: (nodes: Node[]) => void;
  workflowName?: string;
  onWorkflowNameChange?: (name: string) => void;
  isExistingWorkflow?: boolean;
  onOpenPalette?: () => void;
  onClosePalette?: () => void;
  onDropAdd?: (t: PaletteNodeType, options?: NodeAddOptions) => void;
};

function WorkflowCanvasInner(props: WorkflowCanvasProps) {
  const stateRef = React.useRef<WorkflowState>(props.state);
  React.useEffect(() => {
    stateRef.current = props.state;
  }, [props.state]);

  const runHighlightsRef = React.useRef<Record<string, NodeRunStatus>>({});
  React.useEffect(() => {
    runHighlightsRef.current = props.runHighlights ?? {};
  }, [props.runHighlights]);
  const startAttachRef = React.useRef(props.onStartAttach);
  React.useEffect(() => {
    startAttachRef.current = props.onStartAttach;
  }, [props.onStartAttach]);

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
  const snapGrid = useMemo(() => [16, 16] as [number, number], []);

  const handleDeleteEdge = useCallback(
    (id: string) =>
      props.onChange({
        nodes: stateRef.current.nodes,
        edges: stateRef.current.edges.filter((e) => e.id !== id),
      }),
    [props.onChange]
  );

  const nodesWithStatus = useMemo(
    () =>
      props.state.nodes.map((n) => ({
        ...n,
        data: { ...(n.data as any), runStatus: props.runHighlights?.[n.id] },
      })),
    [props.state.nodes, props.runHighlights]
  );

  const nodeTypes = useMemo(
    () => ({
      aiAgent: (p: NodeProps) => (
        <AiAgentNode
          {...p}
          onRemove={handleRemove}
          onAddNode={handleAdd}
          onStartAttach={startAttachRef.current ?? undefined}
          runStatus={runHighlightsRef.current[p.id]}
        />
      ),
      aiTool: (p: NodeProps) => (
        <AiToolNode
          {...p}
          onRemove={handleRemove}
          onAddNode={handleAdd}
          onStartAttach={startAttachRef.current ?? undefined}
          runStatus={runHighlightsRef.current[p.id]}
        />
      ),
      default: (p: NodeProps) => (
        <CardNode
          {...p}
          onRemove={handleRemove}
          onAddNode={handleAdd}
          runStatus={runHighlightsRef.current[p.id]}
        />
      ),
    }),
    [handleRemove, handleAdd]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      reconnectable: true as const,
      updatable: true as const,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      deletable: (p: EdgeProps) => <DeletableEdge {...p} onDelete={handleDeleteEdge} />,
    }),
    [handleDeleteEdge]
  );

  const reactFlowInstance = useReactFlow();
  const flowWrapper = React.useRef<HTMLDivElement | null>(null);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/reactflow-node");
      if (!raw) return;
      try {
        const template = JSON.parse(raw) as PaletteNodeType;
        const bounds = flowWrapper.current?.getBoundingClientRect();
        const position = reactFlowInstance.project({
          x: event.clientX - (bounds?.left ?? 0),
          y: event.clientY - (bounds?.top ?? 0),
        });
        props.onDropAdd?.(template, { position });
      } catch (err) {
        console.warn("Failed to drop node", err);
      }
    },
    [props, reactFlowInstance]
  );

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <div className="panelHeader">
        <div className="panelTitle">
          {props.workflowName ? <span>{props.workflowName}</span> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {props.onSaveWorkflow ? (
            <button
              className="btn btnPrimary btnSmall"
              onClick={props.onSaveWorkflow}
              title="Save workflow"
            >
              Save
            </button>
          ) : null}
          {props.onDeploy ? (
            <button className="btn btnPrimary btnSmall" onClick={props.onDeploy} title="Download workflow JSON">
              Deploy
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }} ref={flowWrapper}>
        <div className="canvasFabGroup">
          {props.onOpenPalette ? (
            <button className="canvasAddBtn" onClick={props.onOpenPalette} title="Add node">
              <i className="fa-solid fa-plus" aria-hidden="true" />
            </button>
          ) : null}
          {props.onViewJson ? (
            <button className="canvasAddBtn" onClick={props.onViewJson} title="View workflow JSON">
              <i className="fa-regular fa-eye" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <ReactFlow
          nodes={nodesWithStatus}
          edges={props.state.edges.map((e) => ({ ...e, type: e.type ?? "deletable" }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          selectionOnDrag
          panOnDrag
          snapToGrid
          snapGrid={snapGrid}
          onSelectionChange={({ nodes: selectedNodes }) =>
            {
              props.onSelectionChange?.(selectedNodes);
              props.onSelectNode(selectedNodes && selectedNodes.length > 0 ? selectedNodes[0] : null);
            }
          }
          onNodeDoubleClick={(_, n) => props.onSelectNode(n, true)}
          onPaneClick={() => {
            props.onSelectNode(null, false);
            props.onClosePalette?.();
          }}
          proOptions={proOptions}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

type NodeWithActions = NodeProps & {
  selected?: boolean;
  onRemove?: (id: string) => void;
  onAddNode?: (t: PaletteNodeType, options?: NodeAddOptions) => void;
  onStartAttach?: (args: { kind: "model" | "memory" | "tool"; sourceId: string; handleId: string }) => void;
  runStatus?: NodeRunStatus;
};

function AiAgentNode(props: NodeWithActions) {
  const label = (props.data as any)?.label ?? "AI Agent";
  const icon = iconForType((props.data as any)?.type ?? props.type);
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
  const runStatus = (props.runStatus ?? (props.data as any)?.runStatus) as NodeRunStatus | undefined;
  const runClass = runStatus ? ` nodeRun-${runStatus}` : "";
  return (
    <div className={`aiAgentNode ${props.selected ? "aiAgentNodeSelected" : ""}${runClass}`}>
      <Handle id="in" type="target" position={Position.Left} className="aiAgentHandle" />
      <div className="aiAgentBody">
        <div className="aiAgentIcon" aria-hidden="true">{iconForType((props.data as any)?.type ?? props.type)}</div>
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
  const icon = iconForType((props.data as any)?.type ?? props.type);
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
  const runStatus = (props.runStatus ?? (props.data as any)?.runStatus) as NodeRunStatus | undefined;
  const runClass = runStatus ? ` nodeRun-${runStatus}` : "";
  return (
    <div className={`aiAgentNode ${props.selected ? "aiAgentNodeSelected" : ""}${runClass}`}>
      <Handle id="in" type="target" position={Position.Left} className="aiAgentHandle" />
      <div className="aiAgentBody">
        <div className="aiAgentIcon" aria-hidden="true">{iconForType((props.data as any)?.type ?? props.type)}</div>
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
  const icon = iconForType(type);
  const runStatus = (props.runStatus ?? (props.data as any)?.runStatus) as NodeRunStatus | undefined;
  const runClass = runStatus ? ` nodeRun-${runStatus}` : "";

  return (
    <div className={`nodeCard ${props.selected ? "nodeCardSelected" : ""}${runClass}`}>
      {isTrigger ? null : <Handle id="in" type="target" position={Position.Top} className="aiAgentHandle" />}
      <div className="nodeCardHeader">
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <span aria-hidden="true">{icon}</span>
          <div className="nodeCardTitle">{label}</div>
        </div>
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

function DeletableEdge(props: EdgeProps & { onDelete: (id: string) => void }) {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const [hovered, setHovered] = React.useState(false);
  return (
    <>
      <BaseEdge path={edgePath} {...props} className="edgeDeletable" />
      <path
        className="edgeHoverLayer"
        d={edgePath}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete(props.id);
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            opacity: hovered ? 1 : 0,
            transition: "opacity .12s ease",
          }}
          className="edgeDeleteWrapper"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            className="edgeDeleteBtn"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete(props.id);
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}


