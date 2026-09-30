import type {
  StateDiagramState,
  StateDiagramTransition,
  StateDiagramPosition,
  StateDiagramViewport,
} from "./interactive-lesson";

export type StateDiagramEdgeType = "auto" | "straight" | "bezier" | "smoothstep";

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 64;

export function isStateDiagramPosition(value: unknown): value is StateDiagramPosition {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as Record<string, unknown>).x) &&
    Number.isFinite((value as Record<string, unknown>).y)
  );
}

export function autoLayoutStateDiagram(
  states: StateDiagramState[],
  transitions: StateDiagramTransition[],
): StateDiagramState[] {
  if (states.length === 0) return [];
  const index = new Map(states.map((state, stateIndex) => [state.id, stateIndex]));
  const layers = states.map(() => 0);
  // Use forward edges for a deterministic layered layout. Back edges and cycles stay
  // visible without causing an infinite layout loop and can then be positioned manually.
  for (let pass = 0; pass < states.length; pass += 1) {
    let changed = false;
    for (const transition of transitions) {
      const from = index.get(transition.from);
      const to = index.get(transition.to);
      if (from === undefined || to === undefined || from >= to) continue;
      const next = Math.max(layers[to], layers[from] + 1);
      if (next !== layers[to]) {
        layers[to] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const rowsByLayer = new Map<number, number>();
  return states.map((state, stateIndex) => {
    const layer = layers[stateIndex];
    const row = rowsByLayer.get(layer) ?? 0;
    rowsByLayer.set(layer, row + 1);
    return {
      ...state,
      position: {
        x: 70 + layer * 260,
        y: 70 + row * 130,
      },
    };
  });
}

export function resolveStateDiagramStates(
  states: StateDiagramState[],
  transitions: StateDiagramTransition[],
): StateDiagramState[] {
  const layout = autoLayoutStateDiagram(states, transitions);
  return states.map((state, index) => ({
    ...state,
    position: isStateDiagramPosition(state.position) ? state.position : layout[index].position,
  }));
}

export function stateDiagramViewport(value: unknown): StateDiagramViewport | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    !Number.isFinite(candidate.x) ||
    !Number.isFinite(candidate.y) ||
    !Number.isFinite(candidate.zoom) ||
    Number(candidate.zoom) <= 0
  )
    return undefined;
  return { x: Number(candidate.x), y: Number(candidate.y), zoom: Number(candidate.zoom) };
}

export function diagramPosition(index: number): StateDiagramPosition {
  return { x: 70 + index * (DEFAULT_NODE_WIDTH + 80), y: 70 };
}

export const stateDiagramNodeSize = { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
