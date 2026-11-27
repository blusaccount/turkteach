// Verb conjugation for the drills: present continuous (-iyor), its negative, past (-di)
// and future (-ecek), for all six persons. Regular rules plus the handful of everyday
// irregular stems (gitmek, etmek, yemek, demek).

const VOWELS = "aeıioöuü";
const FRONT = "eiöü";
const HARD = "fstkçşhp";

export type Tense = "present" | "negative" | "past" | "future";
export type Person = 0 | 1 | 2 | 3 | 4 | 5;
export const PERSONS = ["ben", "sen", "o", "biz", "siz", "onlar"] as const;
export const PERSON_EN = ["I", "you", "he/she", "we", "you (formal/plural)", "they"] as const;
export const TENSE_LABEL: Record<Tense, string> = {
  present: "present (-iyor)",
  negative: "not, present (-miyor)",
  past: "past (-di)",
  future: "future (-ecek)",
};

export interface Verb {
  inf: string;
  en: string; // "to come"
}

export const VERBS: Verb[] = [
  { inf: "gelmek", en: "come" },
  { inf: "gitmek", en: "go" },
  { inf: "yemek", en: "eat" },
  { inf: "içmek", en: "drink" },
  { inf: "yapmak", en: "do / make" },
  { inf: "konuşmak", en: "speak" },
  { inf: "anlamak", en: "understand" },
  { inf: "sevmek", en: "love / like" },
  { inf: "istemek", en: "want" },
  { inf: "bilmek", en: "know" },
  { inf: "görmek", en: "see" },
  { inf: "oturmak", en: "sit / live" },
  { inf: "çalışmak", en: "work" },
  { inf: "yaşamak", en: "live" },
  { inf: "okumak", en: "read" },
  { inf: "beklemek", en: "wait" },
  { inf: "söylemek", en: "say" },
  { inf: "başlamak", en: "start" },
  { inf: "almak", en: "take / buy" },
  { inf: "vermek", en: "give" },
  { inf: "uyumak", en: "sleep" },
  { inf: "öğrenmek", en: "learn" },
  { inf: "pişirmek", en: "cook" },
  { inf: "aramak", en: "call / look for" },
  { inf: "yardım etmek", en: "help" },
  { inf: "demek", en: "say / mean" },
  { inf: "düşünmek", en: "think" },
  { inf: "gülmek", en: "laugh" },
  { inf: "hazırlamak", en: "prepare" },
  { inf: "tanışmak", en: "meet (get to know)" },
];

const four = (v: string) => ({ a: "ı", ı: "ı", e: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü" })[v]!;
const two = (v: string) => (FRONT.includes(v) ? "e" : "a");
const lastVowel = (s: string) => [...s].reverse().find((c) => VOWELS.includes(c)) ?? "e";

/** Splits "yardım etmek" into prefix "yardım " and the verb "etmek". */
function split(inf: string): { pre: string; stem: string } {
  const i = inf.lastIndexOf(" ");
  const pre = i >= 0 ? inf.slice(0, i + 1) : "";
  const verb = inf.slice(i + 1);
  return { pre, stem: verb.replace(/m[ae]k$/, "") };
}

// Stems whose final t softens to d before a vowel.
const SOFT_T = new Set(["git", "et", "tat"]);

export function conjugate(inf: string, tense: Tense, person: Person): string {
  const { pre, stem } = split(inf);
  return pre + conj(stem, tense, person);
}

function conj(stem: string, tense: Tense, p: Person): string {
  if (tense === "present" || tense === "negative") {
    let base: string;
    if (tense === "negative") base = stem + "m" + four(lastVowel(stem));
    else if (stem === "ye") base = "yi";
    else if (stem === "de") base = "di";
    else if (VOWELS.includes(stem.at(-1)!)) {
      const cut = stem.slice(0, -1);
      base = cut + four(lastVowel(cut));
    } else {
      const s = SOFT_T.has(stem) ? stem.slice(0, -1) + "d" : stem;
      base = s + four(lastVowel(stem));
    }
    return base + "yor" + ["um", "sun", "", "uz", "sunuz", "lar"][p];
  }

  if (tense === "past") {
    const v = four(lastVowel(stem));
    const d = HARD.includes(stem.at(-1)!) ? "t" : "d";
    const ends = ["m", "n", "", "k", "n" + v + "z", "l" + two(lastVowel(stem)) + "r"];
    return stem + d + v + ends[p];
  }

  // future
  let s = stem;
  if (stem === "ye") s = "yi";
  else if (stem === "de") s = "di";
  else if (SOFT_T.has(stem)) s = stem.slice(0, -1) + "d";
  const a = two(lastVowel(s));
  const buf = VOWELS.includes(s.at(-1)!) ? "y" : "";
  const fut = s + buf + a + "c" + a; // gelece / yapaca
  const i = four(a);
  const ends = ["ğ" + i + "m", "ks" + i + "n", "k", "ğ" + i + "z", "ks" + i + "n" + i + "z", "kl" + a + "r"];
  return fut + ends[p];
}
