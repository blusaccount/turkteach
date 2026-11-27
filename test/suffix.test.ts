import { describe, expect, it } from "vitest";
import { inflect, SUFFIXES } from "../src/suffix";

const form = (w: string, key: string) => inflect(w, SUFFIXES.find((s) => s.key === key)!)!.form;

describe("suffix helper", () => {
  const cases: Array<[string, string, string]> = [
    ["ev", "plural", "evler"], ["ev", "locative", "evde"], ["ev", "ablative", "evden"],
    ["ev", "dative", "eve"], ["ev", "accusative", "evi"], ["ev", "genitive", "evin"], ["ev", "my", "evim"],
    ["kitap", "plural", "kitaplar"], ["kitap", "locative", "kitapta"], ["kitap", "ablative", "kitaptan"],
    ["kitap", "dative", "kitaba"], ["kitap", "accusative", "kitabı"], ["kitap", "my", "kitabım"],
    ["araba", "locative", "arabada"], ["araba", "dative", "arabaya"], ["araba", "accusative", "arabayı"],
    ["araba", "genitive", "arabanın"], ["araba", "my", "arabam"], ["araba", "with", "arabayla"],
    ["çocuk", "dative", "çocuğa"], ["çocuk", "locative", "çocukta"], ["renk", "accusative", "rengi"],
    ["anne", "dative", "anneye"], ["anne", "genitive", "annenin"], ["anne", "my", "annem"],
    ["okul", "accusative", "okulu"], ["göz", "accusative", "gözü"], ["süt", "genitive", "sütün"],
    ["İstanbul", "locative", "İstanbul'da"], ["İstanbul", "dative", "İstanbul'a"],
    ["Türkiye", "locative", "Türkiye'de"], ["ağaç", "accusative", "ağacı"], ["top", "accusative", "topu"],
    ["çay", "question", "çay mı"], ["güzel", "question", "güzel mi"], ["kız", "plural", "kızlar"],
  ];
  it.each(cases)("%s + %s = %s", (w, key, expected) => {
    expect(form(w, key)).toBe(expected);
  });

  it("rejects empty or multi-word input", () => {
    expect(inflect("", SUFFIXES[0])).toBeNull();
    expect(inflect("iki kelime", SUFFIXES[0])).toBeNull();
  });
});
