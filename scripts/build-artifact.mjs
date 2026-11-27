// Turns the Vite build into one self-contained page for publishing as a claude.ai artifact:
// CSS and JS are inlined, and the document skeleton is dropped (the artifact host adds its own).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
let html = readFileSync(join(dist, "index.html"), "utf8");

html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/g, (_, p) =>
  `<style>\n${readFileSync(join(dist, p), "utf8")}\n</style>`,
);
let script = "";
html = html.replace(/<script type="module" crossorigin src="\.?\/?(assets\/[^"]+\.js)"><\/script>/g, (_, p) => {
  script = readFileSync(join(dist, p), "utf8").replace(/<\/script/gi, "<\\/script");
  return "";
});
if (!script) throw new Error("No bundled script found in dist/index.html");

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>/i, "")
  .replace(/<meta name="viewport"[^>]*>/i, "")
  .trim();
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].trim();

const out = `${head}\n${body}\n<script type="module">\n${script}\n</script>\n`;
writeFileSync(join(dist, "artifact.html"), out);
console.log(`dist/artifact.html: ${(out.length / 1024).toFixed(1)} KB`);
