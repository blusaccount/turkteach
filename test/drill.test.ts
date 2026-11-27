import { describe, expect, it } from "vitest";
import { check, nextExercise } from "../src/drill";

describe("answer checking", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(check("  merhaba ", "Merhaba!")).toBe("right");
    expect(check("Teşekkür ederim", "Teşekkür ederim.")).toBe("right");
  });
  it("accepts either side of a slash", () => {
    expect(check("baba", "anne / baba")).toBe("right");
  });
  it("calls missing Turkish letters almost", () => {
    expect(check("tesekkur ederim", "Teşekkür ederim.")).toBe("almost");
    expect(check("tesekur ederim", "Teşekkür ederim.")).toBe("almost");
  });
  it("is strict on letters for grammar drills", () => {
    expect(check("kitabi", "kitabı", { strictLetters: true })).toBe("wrong");
    expect(check("kitabı", "kitabı", { strictLetters: true })).toBe("right");
  });
  it("rejects wrong answers", () => {
    expect(check("hoşça kal", "Merhaba!")).toBe("wrong");
    expect(check("", "Merhaba!")).toBe("wrong");
  });
});

describe("drills", () => {
  it("produces exercises with answers for every kind", () => {
    for (const kind of ["cases", "verbs", "mixed"] as const) {
      for (let i = 0; i < 50; i++) {
        const e = nextExercise(kind, {});
        expect(e.answer.length).toBeGreaterThan(1);
        expect(e.cue).toBeTruthy();
        if (kind === "cases") expect(e.key.startsWith("case:")).toBe(true);
        if (kind === "verbs") expect(e.key.startsWith("verb:")).toBe(true);
      }
    }
  });
  it("favours forms you get wrong", () => {
    const stats = { "verb:past": { right: 0, wrong: 30 }, "verb:present": { right: 30, wrong: 0 }, "verb:future": { right: 30, wrong: 0 }, "verb:negative": { right: 30, wrong: 0 } };
    let past = 0;
    for (let i = 0; i < 400; i++) if (nextExercise("verbs", stats).key === "verb:past") past++;
    expect(past).toBeGreaterThan(130);
  });
});
