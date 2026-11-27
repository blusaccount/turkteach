// Vowel harmony and common suffixes, with the reasoning shown step by step.
// Covers the regular rules; loanwords (saat → saati) and some one-syllable words
// (dört → dördü, ok → oku) are exceptions the helper flags but cannot predict.

const VOWELS = "aeıioöuü";
const FRONT = "eiöü";
const HARD = "fstkçşhp"; // "fıstıkçı şahap"

export interface Step {
  label: string;
  detail: string;
}

export interface SuffixResult {
  key: string;
  meaning: string;
  example: string;
  form: string;
  suffix: string;
  steps: Step[];
}

export interface SuffixDef {
  key: string;
  meaning: string;
  example: string; // English pattern, e.g. "in the house"
  build: (w: WordInfo) => { suffix: string; steps: Step[]; soften?: boolean };
}

export interface WordInfo {
  word: string;
  lower: string;
  lastVowel: string;
  endsInVowel: boolean;
  endsHard: boolean;
  syllables: number;
  proper: boolean;
}

const lc = (s: string) => s.toLocaleLowerCase("tr");

export function analyze(raw: string): WordInfo | null {
  const word = raw.trim();
  if (!word || /\s/.test(word)) return null;
  const lower = lc(word);
  const vowels = [...lower].filter((ch) => VOWELS.includes(ch));
  if (vowels.length === 0) return null;
  const last = lower[lower.length - 1];
  return {
    word,
    lower,
    lastVowel: vowels[vowels.length - 1],
    endsInVowel: VOWELS.includes(last),
    endsHard: HARD.includes(last),
    syllables: vowels.length,
    proper: word[0] !== lower[0],
  };
}

const two = (v: string) => (FRONT.includes(v) ? "e" : "a");
const four = (v: string) => ({ a: "ı", ı: "ı", e: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü" })[v]!;

function harmony2(w: WordInfo): Step {
  const front = FRONT.includes(w.lastVowel);
  return {
    label: "2-way harmony",
    detail: `Last vowel is "${w.lastVowel}" (${front ? "front" : "back"}), so the suffix takes "${two(w.lastVowel)}".`,
  };
}

function harmony4(w: WordInfo): Step {
  return {
    label: "4-way harmony",
    detail: `Last vowel is "${w.lastVowel}", so the suffix takes "${four(w.lastVowel)}" (a/ı→ı, e/i→i, o/u→u, ö/ü→ü).`,
  };
}

const hardStep = (w: WordInfo, d: string, t: string): Step =>
  w.endsHard
    ? { label: "Consonant hardening", detail: `The word ends in a hard consonant (f s t k ç ş h p), so "${d}" becomes "${t}".` }
    : { label: "No hardening", detail: `The word doesn't end in f s t k ç ş h p, so the suffix keeps "${d}".` };

const buffer = (w: WordInfo, b: string): Step =>
  w.endsInVowel
    ? { label: "Buffer letter", detail: `The word ends in a vowel, so "${b}" goes in between to keep two vowels apart.` }
    : { label: "No buffer", detail: "The word ends in a consonant, so the suffix attaches directly." };

export const SUFFIXES: SuffixDef[] = [
  {
    key: "plural",
    meaning: "plural",
    example: "houses",
    build: (w) => ({ suffix: "l" + two(w.lastVowel) + "r", steps: [harmony2(w)] }),
  },
  {
    key: "locative",
    meaning: "in / at / on",
    example: "at home",
    build: (w) => {
      const d = w.endsHard ? "t" : "d";
      return { suffix: d + two(w.lastVowel), steps: [harmony2(w), hardStep(w, "d", "t")] };
    },
  },
  {
    key: "ablative",
    meaning: "from",
    example: "from home",
    build: (w) => {
      const d = w.endsHard ? "t" : "d";
      return { suffix: d + two(w.lastVowel) + "n", steps: [harmony2(w), hardStep(w, "d", "t")] };
    },
  },
  {
    key: "dative",
    meaning: "to / towards",
    example: "to the house",
    build: (w) => ({
      suffix: (w.endsInVowel ? "y" : "") + two(w.lastVowel),
      steps: [harmony2(w), buffer(w, "y")],
      soften: true,
    }),
  },
  {
    key: "accusative",
    meaning: "the (definite object)",
    example: "I see the house",
    build: (w) => ({
      suffix: (w.endsInVowel ? "y" : "") + four(w.lastVowel),
      steps: [harmony4(w), buffer(w, "y")],
      soften: true,
    }),
  },
  {
    key: "genitive",
    meaning: "of / 's",
    example: "the house's door",
    build: (w) => ({
      suffix: (w.endsInVowel ? "n" : "") + four(w.lastVowel) + "n",
      steps: [harmony4(w), buffer(w, "n")],
      soften: true,
    }),
  },
  {
    key: "my",
    meaning: "my",
    example: "my house",
    build: (w) => ({
      suffix: (w.endsInVowel ? "" : four(w.lastVowel)) + "m",
      steps: [
        harmony4(w),
        w.endsInVowel
          ? { label: "Short form", detail: 'After a vowel, "my" is just "-m".' }
          : { label: "Linking vowel", detail: "After a consonant, a harmony vowel links the -m." },
      ],
      soften: !w.endsInVowel,
    }),
  },
  {
    key: "with",
    meaning: "with / by",
    example: "with the family",
    build: (w) => ({
      suffix: (w.endsInVowel ? "y" : "") + "l" + two(w.lastVowel),
      steps: [harmony2(w), buffer(w, "y")],
    }),
  },
  {
    key: "question",
    meaning: "yes/no question (separate word)",
    example: "a house?",
    build: (w) => ({
      suffix: " m" + four(w.lastVowel),
      steps: [harmony4(w), { label: "Written apart", detail: "The question particle is written as its own word but still follows harmony." }],
    }),
  },
];

const SOFT: Record<string, string> = { p: "b", ç: "c", k: "ğ" };

/** Apply a suffix to a word. */
export function inflect(raw: string, def: SuffixDef): SuffixResult | null {
  const w = analyze(raw);
  if (!w) return null;
  const { suffix, steps, soften } = def.build(w);
  let stem = w.word;
  const last = w.lower[w.lower.length - 1];

  const nk = last === "k" && w.lower[w.lower.length - 2] === "n";
  if (soften && VOWELS.includes(suffix[0]) && !w.proper && (w.syllables > 1 || nk) && SOFT[last]) {
    const soft = nk ? "g" : SOFT[last];
    stem = w.word.slice(0, -1) + soft;
    steps.push({
      label: "Softening",
      detail: `Before a vowel, a final "${last}" usually softens to "${soft}" in words of more than one syllable ("nk" becomes "ng"). Some words (often loanwords) don't follow this.`,
    });
  } else if (soften && VOWELS.includes(suffix[0]) && w.syllables === 1 && SOFT[last]) {
    steps.push({
      label: "One syllable",
      detail: `Most one-syllable words keep their final "${last}" (top → topu), but a few soften (dört → dördü).`,
    });
  }

  const sep = w.proper && !suffix.startsWith(" ") ? "'" : "";
  if (sep) steps.push({ label: "Proper noun", detail: "Names of people and places take an apostrophe before the suffix." });

  return {
    key: def.key,
    meaning: def.meaning,
    example: def.example,
    form: stem + sep + suffix,
    suffix: suffix.trim(),
    steps,
  };
}

export function inflectAll(raw: string): SuffixResult[] {
  return SUFFIXES.map((d) => inflect(raw, d)).filter((r): r is SuffixResult => r !== null);
}
