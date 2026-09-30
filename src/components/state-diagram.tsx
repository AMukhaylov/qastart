import {
  applyNodeChanges,
  BaseEdge,
  Background,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  StateDiagramState,
  StateDiagramTransition,
  stateDiagramStates,
  stateDiagramTransitions,
  stringList,
  stringValue,
} from "@/lib/interactive-lesson";
import {
  autoLayoutStateDiagram,
  diagramPosition,
  resolveStateDiagramStates,
  stateDiagramViewport,
  type StateDiagramEdgeType,
} from "@/lib/state-diagram";

type StateNodeData = {
  label: string;
  initial: boolean;
  final: boolean;
  editable: boolean;
};
type DiagramNode = Node<StateNodeData, "stateDiagram">;
type DiagramEdge = Edge<{ label?: string; edgeType: StateDiagramEdgeType }, "stateDiagramEdge">;

const nodeTypes = { stateDiagram: StateDiagramNode };
const edgeTypes = { stateDiagramEdge: StateDiagramEdge };

function positionForDelta(dx: number, dy: number, source: boolean): string {
  if (Math.abs(dx) >= Math.abs(dy))
    return source ? (dx >= 0 ? "right" : "left") : dx >= 0 ? "left" : "right";
  return source ? (dy >= 0 ? "bottom" : "top") : dy >= 0 ? "top" : "bottom";
}

function handlePosition(handle: string | null | undefined, source: boolean) {
  if (handle === "top") return Position.Top;
  if (handle === "bottom") return Position.Bottom;
  if (handle === "left") return Position.Left;
  if (handle === "right") return Position.Right;
  return source ? Position.Right : Position.Left;
}

function StateDiagramNode({ data }: NodeProps<DiagramNode>) {
  return (
    <div
      className={`relative min-w-44 rounded-xl border-2 bg-white px-4 py-3 text-center text-sm font-bold shadow-sm ${
        data.initial
          ? "border-primary bg-primary-soft text-primary"
          : data.final
            ? "border-emerald-400 bg-emerald-50 text-emerald-800"
            : "border-slate-200 text-slate-800"
      }`}
      title={data.editable ? "Перетащите состояние или выберите его" : data.label}
    >
      {(["top", "right", "bottom", "left"] as const).map((handle) => (
        <Handle
          key={handle}
          id={handle}
          type="source"
          position={handlePosition(handle, true)}
          // Keep read-only handles in the layout. React Flow measures handles
          // to calculate edge endpoints; display:none makes those endpoints
          // unavailable, so the edges disappear in student/preview mode.
          className={
            data.editable
              ? "!h-2 !w-2 !border-primary !bg-primary"
              : "!h-2 !w-2 !border-primary !bg-primary !opacity-0 !pointer-events-none"
          }
        />
      ))}
      {(["top", "right", "bottom", "left"] as const).map((handle) => (
        <Handle
          key={`target-${handle}`}
          id={`target-${handle}`}
          type="target"
          position={handlePosition(handle, false)}
          className={
            data.editable
              ? "!h-2 !w-2 !border-primary !bg-primary"
              : "!h-2 !w-2 !border-primary !bg-primary !opacity-0 !pointer-events-none"
          }
        />
      ))}
      <span>{data.label}</span>
      {data.initial && <span className="ml-2 text-[10px] font-semibold uppercase">Старт</span>}
      {data.final && <span className="ml-2 text-[10px] font-semibold uppercase">Финиш</span>}
    </div>
  );
}

function StateDiagramEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  data,
}: EdgeProps<DiagramEdge>) {
  const isLoop = source === target;
  let path = "";
  let labelX = (sourceX + targetX) / 2;
  let labelY = (sourceY + targetY) / 2;
  if (isLoop) {
    path = `M ${sourceX} ${sourceY} C ${sourceX + 90} ${sourceY - 100}, ${targetX + 90} ${targetY + 100}, ${targetX} ${targetY}`;
    labelX = sourceX + 68;
    labelY = sourceY - 54;
  } else if (data?.edgeType === "straight") {
    path = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  } else if (data?.edgeType === "bezier") {
    [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
  } else {
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 14,
      offset: 24,
    });
  }
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd="url(#state-diagram-arrow)"
        style={{ stroke: "#64748b", strokeWidth: 1.8 }}
      />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-slate-700 shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 6}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function buildNodes(content: Record<string, unknown>, editable: boolean): DiagramNode[] {
  const states = resolveStateDiagramStates(
    stateDiagramStates(content),
    stateDiagramTransitions(content),
  );
  const initial = stringValue(content, "initialState");
  const finals = new Set(stringList(content, "finalStates"));
  return states.map((state) => ({
    id: state.id,
    type: "stateDiagram",
    position: state.position ?? diagramPosition(0),
    data: {
      label: state.label,
      initial: state.id === initial,
      final: finals.has(state.id),
      editable,
    },
    draggable: editable,
    selectable: editable,
  }));
}

function buildEdges(
  content: Record<string, unknown>,
  nodes: DiagramNode[],
  editable: boolean,
): DiagramEdge[] {
  const positions = new Map(nodes.map((node) => [node.id, node.position]));
  const pairCount = new Map<string, number>();
  return stateDiagramTransitions(content).flatMap((transition, index) => {
    const sourcePosition = positions.get(transition.from);
    const targetPosition = positions.get(transition.to);
    if (!sourcePosition || !targetPosition) return [];
    const pair = `${transition.from}:${transition.to}`;
    const parallelIndex = pairCount.get(pair) ?? 0;
    pairCount.set(pair, parallelIndex + 1);
    const dx = targetPosition.x - sourcePosition.x;
    const dy = targetPosition.y - sourcePosition.y;
    const defaultSource = transition.sourceHandle ?? positionForDelta(dx, dy, true);
    const defaultTarget = transition.targetHandle ?? positionForDelta(dx, dy, false);
    const sourceHandle =
      parallelIndex % 2 === 0 ? defaultSource : defaultSource === "right" ? "bottom" : "right";
    const targetHandle =
      parallelIndex % 2 === 0 ? defaultTarget : defaultTarget === "left" ? "top" : "left";
    return [
      {
        id: transition.id ?? `transition-${index}`,
        type: "stateDiagramEdge",
        source: transition.from,
        target: transition.to,
        sourceHandle,
        targetHandle: `target-${targetHandle}`,
        animated: false,
        selectable: editable,
        data: { label: transition.label, edgeType: transition.edgeType ?? "auto" },
      },
    ];
  });
}

function ArrowMarker() {
  return (
    <svg className="absolute h-0 w-0">
      <defs>
        <marker
          id="state-diagram-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
        </marker>
      </defs>
    </svg>
  );
}

export function StateDiagramCanvas({
  content,
  editable = false,
  onSelectState,
  onSelectTransition,
  onNodesPositionChange,
  onConnect,
  onViewportChange,
}: {
  content: Record<string, unknown>;
  editable?: boolean;
  onSelectState?: (id: string) => void;
  onSelectTransition?: (id: string) => void;
  onNodesPositionChange?: (positions: Record<string, { x: number; y: number }>) => void;
  onConnect?: (connection: Connection) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}) {
  const nodes = useMemo(() => buildNodes(content, editable), [content, editable]);
  const edges = useMemo(() => buildEdges(content, nodes, editable), [content, nodes, editable]);
  const viewport = stateDiagramViewport(content.viewport);
  return (
    <div className="relative h-[520px] min-h-[360px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <ArrowMarker />
      <ReactFlowProvider>
        <StateDiagramFlow
          nodes={nodes}
          edges={edges}
          editable={editable}
          viewport={viewport}
          onSelectState={onSelectState}
          onSelectTransition={onSelectTransition}
          onNodesPositionChange={onNodesPositionChange}
          onConnect={onConnect}
          onViewportChange={onViewportChange}
        />
      </ReactFlowProvider>
    </div>
  );
}

function StateDiagramFlow({
  nodes: sourceNodes,
  edges,
  editable,
  viewport,
  onSelectState,
  onSelectTransition,
  onNodesPositionChange,
  onConnect,
  onViewportChange,
}: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  editable: boolean;
  viewport?: { x: number; y: number; zoom: number };
  onSelectState?: (id: string) => void;
  onSelectTransition?: (id: string) => void;
  onNodesPositionChange?: (positions: Record<string, { x: number; y: number }>) => void;
  onConnect?: (connection: Connection) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}) {
  const [nodes, setNodes] = useState(sourceNodes);
  const { fitView, zoomIn, zoomOut, setViewport } = useReactFlow();
  useEffect(() => setNodes(sourceNodes), [sourceNodes]);
  useEffect(() => {
    if (viewport) setViewport(viewport, { duration: 0 });
    else fitView({ padding: 0.2, duration: 0 });
  }, [fitView, setViewport, viewport]);
  const onNodesChange = useCallback(
    (changes: NodeChange<DiagramNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );
  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: DiagramNode) => {
      if (!editable || !onNodesPositionChange) return;
      onNodesPositionChange(
        Object.fromEntries(
          nodes.map((node) => [
            node.id,
            node.id === draggedNode.id ? draggedNode.position : node.position,
          ]),
        ),
      );
    },
    [editable, nodes, onNodesPositionChange],
  );
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={(_, node) => onSelectState?.(node.id)}
      onEdgeClick={(_, edge) => onSelectTransition?.(edge.id)}
      onConnect={onConnect}
      onMoveEnd={(_, nextViewport) => onViewportChange?.(nextViewport)}
      nodesDraggable={editable}
      nodesConnectable={editable}
      elementsSelectable={editable}
      fitView={!viewport}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} color="#dbe4f0" />
      <Controls showInteractive={editable} />
      {editable && <MiniMap nodeColor="#647cff" pannable zoomable />}
      {editable && (
        <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-lg border border-border bg-white/95 p-1 shadow-sm">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => zoomOut()}
            aria-label="Уменьшить"
          >
            −
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fitView({ padding: 0.2, duration: 200 })}
            aria-label="Вписать диаграмму"
          >
            ⌖
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => zoomIn()}
            aria-label="Увеличить"
          >
            +
          </Button>
        </div>
      )}
    </ReactFlow>
  );
}

export function StateDiagramEditor({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}) {
  const states = resolveStateDiagramStates(
    stateDiagramStates(content),
    stateDiagramTransitions(content),
  );
  const transitions = stateDiagramTransitions(content);
  useEffect(() => {
    const rawStates = stateDiagramStates(content);
    const rawTransitions = stateDiagramTransitions(content);
    const hasMissingPositions = rawStates.some((state) => !state.position);
    const hasMissingIds = rawTransitions.some((transition) => !transition.id);
    if (!hasMissingPositions && !hasMissingIds) return;
    onChange({
      ...content,
      states,
      transitions: rawTransitions.map((transition, index) => ({
        ...transition,
        id: transition.id ?? `transition-${index + 1}`,
      })),
    });
  }, [content, onChange, states]);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const updateStates = (next: StateDiagramState[]) => onChange({ ...content, states: next });
  const updateTransitions = (next: StateDiagramTransition[]) =>
    onChange({ ...content, transitions: next });
  const positionChange = (positions: Record<string, { x: number; y: number }>) =>
    updateStates(
      states.map((state) => ({ ...state, position: positions[state.id] ?? state.position })),
    );
  const selectedStateData = states.find((state) => state.id === selectedState);
  const selectedTransitionData = transitions.find(
    (transition, index) => (transition.id ?? `transition-${index}`) === selectedTransition,
  );
  const addState = () => {
    const id = `state-${crypto.randomUUID()}`;
    updateStates([
      ...states,
      { id, label: `Состояние ${states.length + 1}`, position: diagramPosition(states.length) },
    ]);
    setSelectedState(id);
    setSelectedTransition(null);
  };
  const autoLayout = () => updateStates(autoLayoutStateDiagram(states, transitions));
  const handleViewportChange = (nextViewport: { x: number; y: number; zoom: number }) => {
    const currentViewport = stateDiagramViewport(content.viewport);
    if (
      currentViewport &&
      currentViewport.x === nextViewport.x &&
      currentViewport.y === nextViewport.y &&
      currentViewport.zoom === nextViewport.zoom
    )
      return;
    onChange({ ...content, viewport: nextViewport });
  };
  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const id = `transition-${crypto.randomUUID()}`;
    updateTransitions([
      ...transitions,
      {
        id,
        from: connection.source,
        to: connection.target,
        label: "",
        edgeType: "auto",
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle?.replace(/^target-/, "") ?? undefined,
      },
    ]);
    setSelectedTransition(id);
    setSelectedState(null);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-2">
        <Button type="button" size="sm" variant="soft" onClick={addState}>
          <Plus className="h-4 w-4" /> Состояние
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={autoLayout}>
          Автораскладка
        </Button>
        <span className="text-xs text-muted-foreground">
          Перетаскивайте узлы и соединяйте точки на их границах.
        </span>
      </div>
      <StateDiagramCanvas
        content={{ ...content, states }}
        editable
        onSelectState={(id) => {
          setSelectedState(id);
          setSelectedTransition(null);
        }}
        onSelectTransition={(id) => {
          setSelectedTransition(id);
          setSelectedState(null);
        }}
        onNodesPositionChange={positionChange}
        onConnect={handleConnect}
        onViewportChange={handleViewportChange}
      />
      {(selectedStateData || selectedTransitionData) && (
        <div className="rounded-xl border border-primary/20 bg-primary-soft/30 p-4">
          {selectedStateData && (
            <StateInspector
              state={selectedStateData}
              states={states}
              content={content}
              onChangeState={(next) =>
                updateStates(states.map((item) => (item.id === next.id ? next : item)))
              }
              onChangeContent={onChange}
              onDelete={() => {
                const nextIds = new Set(
                  states.filter((item) => item.id !== selectedStateData.id).map((item) => item.id),
                );
                onChange({
                  ...content,
                  states: states.filter((item) => item.id !== selectedStateData.id),
                  transitions: transitions.filter(
                    (transition) => nextIds.has(transition.from) && nextIds.has(transition.to),
                  ),
                });
                setSelectedState(null);
              }}
              onDuplicate={() => {
                const id = `state-${crypto.randomUUID()}`;
                updateStates([
                  ...states,
                  {
                    ...selectedStateData,
                    id,
                    label: `${selectedStateData.label} (копия)`,
                    position: {
                      x: (selectedStateData.position?.x ?? 0) + 40,
                      y: (selectedStateData.position?.y ?? 0) + 40,
                    },
                  },
                ]);
                setSelectedState(id);
              }}
            />
          )}
          {selectedTransitionData && (
            <TransitionInspector
              transition={selectedTransitionData}
              states={states}
              onChange={(next) =>
                updateTransitions(
                  transitions.map((item, index) =>
                    (item.id ?? `transition-${index}`) === selectedTransition ? next : item,
                  ),
                )
              }
              onDelete={() => {
                updateTransitions(
                  transitions.filter(
                    (item, index) => (item.id ?? `transition-${index}`) !== selectedTransition,
                  ),
                );
                setSelectedTransition(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StateInspector({
  state,
  content,
  onChangeState,
  onChangeContent,
  onDelete,
  onDuplicate,
}: {
  state: StateDiagramState;
  states: StateDiagramState[];
  content: Record<string, unknown>;
  onChangeState: (state: StateDiagramState) => void;
  onChangeContent: (content: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const finals = stringList(content, "finalStates");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold">Состояние</h4>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={onDuplicate}>
            <Copy className="h-4 w-4" /> Дублировать
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" /> Удалить
          </Button>
        </div>
      </div>
      <Label>
        Название
        <Input
          value={state.label}
          onChange={(event) => onChangeState({ ...state, label: event.target.value })}
        />
      </Label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={stringValue(content, "initialState") === state.id}
            onChange={(event) =>
              onChangeContent({ ...content, initialState: event.target.checked ? state.id : "" })
            }
          />{" "}
          Начальное
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={finals.includes(state.id)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...new Set([...finals, state.id])]
                : finals.filter((id) => id !== state.id);
              onChangeContent({ ...content, finalStates: next });
            }}
          />{" "}
          Конечное
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Координаты сохраняются при отпускании узла. Начальное и конечное состояние можно выбирать в
        полях блока.
      </p>
    </div>
  );
}

function TransitionInspector({
  transition,
  states,
  onChange,
  onDelete,
}: {
  transition: StateDiagramTransition;
  states: StateDiagramState[];
  onChange: (transition: StateDiagramTransition) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold">Переход</h4>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" /> Удалить
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Label>
          Из
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={transition.from}
            onChange={(event) => onChange({ ...transition, from: event.target.value })}
          >
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.label}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          В
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={transition.to}
            onChange={(event) => onChange({ ...transition, to: event.target.value })}
          >
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.label}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Событие
          <Input
            value={transition.label ?? ""}
            onChange={(event) => onChange({ ...transition, label: event.target.value })}
          />
        </Label>
      </div>
      <Label>
        Тип линии
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={transition.edgeType ?? "auto"}
          onChange={(event) =>
            onChange({ ...transition, edgeType: event.target.value as StateDiagramEdgeType })
          }
        >
          <option value="auto">Автоматически</option>
          <option value="straight">Прямая</option>
          <option value="bezier">Плавная</option>
          <option value="smoothstep">Угловая</option>
        </select>
      </Label>
    </div>
  );
}
