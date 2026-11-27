// Written exercises: answer checking and grammar drill generation.

import { SUFFIXES, inflect, type Step } from "./suffix";
import { conjugate, PERSONS, PERSON_EN, TENSE_LABEL, VERBS, type Person, type Tense } from "./verbs";

// ---------- checking typed answers ----------

export type Verdict = "right" | "almost" | "wrong";

export function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[’`]/g, "'")
    .replace(/[.,!?;:"()…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Folding the letters people type without a Turkish keyboard.
const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
export const fold = (s: string) => [...s].map((c) => FOLD[c] ?? c).join("");

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Accepts any of the alternatives in "A / B". */
export function check(given: string, expected: string, opts: { strictLetters?: boolean } = {}): Verdict {
  const g = normalize(given);
  if (!g) return "wrong";
  const options = [expected, ...expected.split(" / ")].map(normalize);
  if (options.includes(g)) return "right";
  if (opts.strictLetters) return "wrong";
  for (const o of options) {
    if (fold(o) === fold(g)) return "almost";
    if (o.length > 6 && lev(fold(o), fold(g)) <= 1) return "almost";
  }
  return "wrong";
}

// ---------- grammar drills ----------

export interface Exercise {
  key: string; // stats bucket, e.g. "case:dative" or "verb:past"
  label: string; // short tag shown on the card
  base: string; // the word to change
  cue: string; // English meaning of the target form
  answer: string;
  steps: Step[];
}

export interface DrillStats {
  [key: string]: { right: number; wrong: number };
}

const NOUNS: [string, string][] = [
  ["ev", "house"], ["anne", "mother"], ["baba", "father"], ["kitap", "book"], ["araba", "car"],
  ["çocuk", "child"], ["okul", "school"], ["masa", "table"], ["kapı", "door"], ["çay", "tea"],
  ["kahve", "coffee"], ["ekmek", "bread"], ["oda", "room"], ["mutfak", "kitchen"], ["bahçe", "garden"],
  ["kardeş", "sibling"], ["arkadaş", "friend"], ["köpek", "dog"], ["kedi", "cat"], ["tabak", "plate"],
  ["bardak", "glass"], ["aile", "family"], ["hediye", "gift"], ["telefon", "phone"], ["pencere", "window"],
  ["teyze", "aunt"], ["dede", "grandpa"], ["köy", "village"], ["deniz", "sea"], ["park", "park"],
  ["İstanbul", "Istanbul"], ["Ankara", "Ankara"], ["Almanya", "Germany"], ["Türkiye", "Turkey"],
];

const CASE_CUE: Record<string, (en: string, proper: boolean) => string> = {
  plural: (en) => (en.endsWith("y") && !/[aeiou]y$/.test(en) ? en.slice(0, -1) + "ies" : en.endsWith("s") || en.endsWith("ch") ? en + "es" : en + "s"),
  locative: (en, p) => `in / at ${p ? "" : "the "}${en}`,
  ablative: (en, p) => `from ${p ? "" : "the "}${en}`,
  dative: (en, p) => `to ${p ? "" : "the "}${en}`,
  accusative: (en, p) => `${p ? "" : "the "}${en} (as object)`,
  genitive: (en, p) => `${p ? "" : "the "}${en}'s`,
  my: (en) => `my ${en}`,
  with: (en, p) => `with ${p ? "" : "the "}${en}`,
};

export const CASE_KEYS = Object.keys(CASE_CUE);
export const TENSES: Tense[] = ["present", "negative", "past", "future"];

const CASE_LABEL: Record<string, string> = {
  plural: "plural", locative: "in / at", ablative: "from", dative: "to", accusative: "the (object)",
  genitive: "of / 's", my: "my", with: "with",
};

const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

function caseExercise(key: string): Exercise {
  const def = SUFFIXES.find((s) => s.key === key)!;
  let [tr, en] = pick(NOUNS);
  const proper = tr[0] !== tr[0].toLocaleLowerCase("tr");
  if (proper && key === "my") [tr, en] = ["ev", "house"]; // "my Istanbul" is odd
  const r = inflect(tr, def)!;
  return { key: "case:" + key, label: CASE_LABEL[key], base: tr, cue: CASE_CUE[key](en, proper && key !== "my"), answer: r.form, steps: r.steps };
}

function verbExercise(tense: Tense): Exercise {
  const v = pick(VERBS);
  const p = Math.floor(Math.random() * 6) as Person;
  const pron = PERSON_EN[p];
  const en =
    tense === "present" ? `${pron} ${p === 0 ? "am" : p === 2 ? "is" : "are"} …ing`
    : tense === "negative" ? `${pron} ${p === 0 ? "am" : p === 2 ? "is" : "are"} not …ing`
    : tense === "past" ? `${pron} (did, past)`
    : `${pron} will …`;
  return {
    key: "verb:" + tense,
    label: TENSE_LABEL[tense],
    base: `${PERSONS[p]} + ${v.inf}`,
    cue: `${en} (${v.en})`,
    answer: conjugate(v.inf, tense, p),
    steps: [],
  };
}

export type DrillKind = "cases" | "verbs" | "mixed";

/** Weighted towards the forms you get wrong most. */
export function nextExercise(kind: DrillKind, stats: DrillStats): Exercise {
  const keys = [
    ...(kind !== "verbs" ? CASE_KEYS.map((k) => "case:" + k) : []),
    ...(kind !== "cases" ? TENSES.map((t) => "verb:" + t) : []),
  ];
  const weights = keys.map((k) => {
    const s = stats[k] ?? { right: 0, wrong: 0 };
    return 1 + (3 * (s.wrong + 1)) / (s.right + s.wrong + 2);
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  let key = keys[0];
  for (let i = 0; i < keys.length; i++) {
    r -= weights[i];
    if (r <= 0) { key = keys[i]; break; }
  }
  const [type, which] = key.split(":");
  return type === "case" ? caseExercise(which) : verbExercise(which as Tense);
}

/** Short summary of drill accuracy for dreaming. */
export function drillSummary(stats: DrillStats): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, s] of Object.entries(stats)) out[k] = `${s.right} right, ${s.wrong} wrong`;
  return out;
}
