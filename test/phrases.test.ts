import { it, expect } from "vitest";
import { PHRASES } from "../src/phrases";
it("unique", () => { const ids = PHRASES.map(p=>p.id); const d = ids.filter((x,i)=>ids.indexOf(x)!==i); expect(d).toEqual([]); });
