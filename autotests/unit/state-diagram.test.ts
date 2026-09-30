import test from "node:test";
import assert from "node:assert/strict";
import { autoLayoutStateDiagram, resolveStateDiagramStates } from "../../src/lib/state-diagram.ts";
import type {
  StateDiagramState,
  StateDiagramTransition,
} from "../../src/lib/interactive-lesson.ts";

const states: StateDiagramState[] = Array.from({ length: 8 }, (_, index) => ({
  id: `s${index + 1}`,
  label: `Состояние ${index + 1}`,
}));
const transitions: StateDiagramTransition[] = [
  { id: "s1-s2", from: "s1", to: "s2", label: "вперёд" },
  { id: "s1-s3", from: "s1", to: "s3", label: "ветка" },
  { id: "s2-s4", from: "s2", to: "s4", label: "готово" },
  { id: "s3-s4", from: "s3", to: "s4", label: "готово" },
  { id: "s4-s1", from: "s4", to: "s1", label: "назад" },
  { id: "s4-s4", from: "s4", to: "s4", label: "повторить" },
  { id: "s5-s6", from: "s5", to: "s6", label: "длинный путь" },
  { id: "s1-s2-second", from: "s1", to: "s2", label: "автоматически" },
];

test("state diagram layout fills missing coordinates without changing graph edges", () => {
  const laidOut = resolveStateDiagramStates(states, transitions);
  assert.equal(laidOut.length, 8);
  assert.ok(
    laidOut.every(
      (state) => Number.isFinite(state.position?.x) && Number.isFinite(state.position?.y),
    ),
  );
  assert.equal(
    transitions.filter((transition) => transition.from === "s1" && transition.to === "s2").length,
    2,
  );
  assert.equal(
    transitions.find((transition) => transition.from === transition.to)?.label,
    "повторить",
  );
});

test("manual coordinates survive auto-layout helper only when requested", () => {
  const manuallyPlaced = states.map((state, index) => ({
    ...state,
    position: { x: 100 + index * 17, y: 400 - index * 11 },
  }));
  assert.deepEqual(
    autoLayoutStateDiagram(manuallyPlaced, transitions).map((state) => state.position),
    autoLayoutStateDiagram(states, transitions).map((state) => state.position),
  );
  assert.deepEqual(
    resolveStateDiagramStates(manuallyPlaced, transitions).map((state) => state.position),
    manuallyPlaced.map((state) => state.position),
  );
});
