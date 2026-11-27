import { describe, expect, it } from "vitest";
import { newCard, queue, schedule } from "../src/srs";

const DAY = 86_400_000;
const base = () => newCard({ id: "a", tr: "Merhaba", en: "Hello", topic: "x", source: "starter" }, 0);

describe("scheduler", () => {
  it("grows intervals with good answers", () => {
    let c = base();
    c = schedule(c, 2, 0);
    expect(c.interval).toBe(1);
    c = schedule(c, 2, 0);
    expect(c.interval).toBe(3);
    c = schedule(c, 2, 0);
    expect(c.interval).toBe(8); // 3 * 2.5 rounded
    expect(c.due).toBe(8 * DAY);
  });

  it("resets on a miss and lowers ease", () => {
    let c = schedule(schedule(base(), 2, 0), 2, 0);
    c = schedule(c, 0, 0);
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeCloseTo(2.3);
    expect(c.due).toBe(10 * 60_000);
  });

  it("queues due cards first and limits new ones", () => {
    const due = { ...base(), id: "d", due: 5, reps: 1 };
    const fresh = Array.from({ length: 20 }, (_, i) => ({ ...base(), id: "n" + i }));
    const q = queue([...fresh, due], 10, 5);
    expect(q[0].id).toBe("d");
    expect(q).toHaveLength(6);
  });

  it("puts dream cards ahead of starter cards", () => {
    const starter = base();
    const dream = { ...base(), id: "dr", source: "dream" as const, added: 99 };
    expect(queue([starter, dream], 10, 1)[0].id).toBe("dr");
  });
});

import { applyChanges } from "../src/ai";
describe("dream memory changes", () => {
  const mem = [
    { id: "a", kind: "weak" as const, text: "dative after vowels", evidence: [], seen: 2, updated: 0 },
    { id: "b", kind: "focus" as const, text: "old focus", evidence: [], seen: 1, updated: 0 },
  ];
  it("adds, updates and removes, keeping one focus", () => {
    const out = applyChanges(mem, [
      { op: "update", id: "a", kind: "weak", text: "dative -ya/-ye after vowels", why: "", evidence: ["anneye"], count: 3 },
      { op: "add", kind: "focus", text: "siz forms with elders", why: "", evidence: [], count: 2 },
    ], 10);
    expect(out.find((m) => m.id === "a")!.seen).toBe(5);
    expect(out.filter((m) => m.kind === "focus")).toHaveLength(1);
    expect(out.find((m) => m.kind === "focus")!.text).toBe("siz forms with elders");
    expect(applyChanges(out, [{ op: "remove", id: "a", kind: "weak", text: "", why: "", evidence: [], count: 0 }]).some((m) => m.id === "a")).toBe(false);
  });
});
