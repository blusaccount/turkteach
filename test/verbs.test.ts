import { describe, expect, it } from "vitest";
import { conjugate, type Person, type Tense } from "../src/verbs";

const all = (inf: string, t: Tense) => [0, 1, 2, 3, 4, 5].map((p) => conjugate(inf, t, p as Person));

describe("verbs", () => {
  it("present continuous", () => {
    expect(all("gelmek", "present")).toEqual(["geliyorum", "geliyorsun", "geliyor", "geliyoruz", "geliyorsunuz", "geliyorlar"]);
    expect(conjugate("yapmak", "present", 0)).toBe("yapıyorum");
    expect(conjugate("görmek", "present", 2)).toBe("görüyor");
    expect(conjugate("oturmak", "present", 0)).toBe("oturuyorum");
    expect(conjugate("başlamak", "present", 2)).toBe("başlıyor");
    expect(conjugate("beklemek", "present", 0)).toBe("bekliyorum");
    expect(conjugate("söylemek", "present", 2)).toBe("söylüyor");
    expect(conjugate("okumak", "present", 2)).toBe("okuyor");
    expect(conjugate("gitmek", "present", 0)).toBe("gidiyorum");
    expect(conjugate("yemek", "present", 3)).toBe("yiyoruz");
    expect(conjugate("demek", "present", 2)).toBe("diyor");
    expect(conjugate("yardım etmek", "present", 0)).toBe("yardım ediyorum");
  });
  it("negative present", () => {
    expect(conjugate("gelmek", "negative", 0)).toBe("gelmiyorum");
    expect(conjugate("anlamak", "negative", 0)).toBe("anlamıyorum");
    expect(conjugate("okumak", "negative", 2)).toBe("okumuyor");
    expect(conjugate("görmek", "negative", 1)).toBe("görmüyorsun");
  });
  it("past", () => {
    expect(all("gelmek", "past")).toEqual(["geldim", "geldin", "geldi", "geldik", "geldiniz", "geldiler"]);
    expect(all("yapmak", "past")).toEqual(["yaptım", "yaptın", "yaptı", "yaptık", "yaptınız", "yaptılar"]);
    expect(conjugate("gitmek", "past", 0)).toBe("gittim");
    expect(conjugate("okumak", "past", 3)).toBe("okuduk");
    expect(conjugate("görmek", "past", 4)).toBe("gördünüz");
    expect(conjugate("içmek", "past", 0)).toBe("içtim");
  });
  it("future", () => {
    expect(all("gelmek", "future")).toEqual(["geleceğim", "geleceksin", "gelecek", "geleceğiz", "geleceksiniz", "gelecekler"]);
    expect(all("yapmak", "future")).toEqual(["yapacağım", "yapacaksın", "yapacak", "yapacağız", "yapacaksınız", "yapacaklar"]);
    expect(conjugate("gitmek", "future", 0)).toBe("gideceğim");
    expect(conjugate("okumak", "future", 0)).toBe("okuyacağım");
    expect(conjugate("yemek", "future", 0)).toBe("yiyeceğim");
    expect(conjugate("beklemek", "future", 2)).toBe("bekleyecek");
  });
});
