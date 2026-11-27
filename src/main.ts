import "./style.css";
import { PHRASES, TOPICS } from "./phrases";
import { cardId, newCard, queue, schedule, type Card, type Grade } from "./srs";
import { inflectAll } from "./suffix";
import { STARTER_SCENARIOS } from "./scenarios";
import { applyChanges, dream, dreamMaterial, roleplayTurn, type RoleplayReply, type Turn } from "./ai";
import { icon } from "./icons";
import { errorText, loadPlatform, type Platform } from "./platform";
import {
  emptyLog,
  emptyProfile,
  openStore,
  trimLog,
  type AppState,
  type DreamProposal,
  type Memory,
  type Scenario,
  type Store,
} from "./store";

// ---------- tiny DOM helper (always textContent, never innerHTML) ----------
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k in el && typeof v !== "string") (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

// ---------- app state ----------
let P: Platform;
let store: Store;
let S: AppState;
type Tab = "home" | "review" | "talk" | "phrases" | "suffix" | "dream" | "me";
let tab: Tab = "home";
const root = document.getElementById("app")!;
let view: HTMLElement;

const saveDeck = () => store.save("deck", { cards: S.cards });
const saveProfile = () => {
  S.profile.dreams = S.profile.dreams.slice(-30);
  S.profile.history = S.profile.history.slice(-10);
  S.profile.scenarios = S.profile.scenarios.slice(-12);
  store.save("profile", S.profile);
};
const saveLog = () => {
  S.log = trimLog(S.log);
  store.save("log", S.log);
};

function seedDeck(existing: Card[]): Card[] {
  const have = new Set(existing.map((c) => c.id));
  const add = PHRASES.filter((p) => !have.has(p.id)).map((p, i) =>
    newCard({ id: p.id, tr: p.tr, en: p.en, note: p.note, topic: p.topic, source: "starter" }, i),
  );
  return [...existing, ...add];
}

function addCard(tr: string, en: string, source: Card["source"], topic = "From conversations", note?: string): boolean {
  const id = cardId(tr);
  if (!id || S.cards.some((c) => c.id === id)) return false;
  S.cards.push(newCard({ id, tr, en, note, topic, source }));
  saveDeck();
  return true;
}

// ---------- speech ----------
function speak(text: string) {
  if (P.tts) {
    P.tts.speak(text, { language: "tr" }).catch(() => browserSpeak(text));
  } else browserSpeak(text);
}
function browserSpeak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* no speech available */
  }
}
const canSpeak = () => !!P.tts || "speechSynthesis" in window;
const iconBtn = (name: string, label: string, onclick: (e: Event) => void, cls = "") =>
  h("button", { class: `icon-btn ${cls}`, title: label, "aria-label": label, onclick }, icon(name, 18));
const speakBtn = (text: string) =>
  canSpeak() ? iconBtn("speaker", "Listen", (e) => { e.stopPropagation(); speak(text); }) : null;

// ---------- shell ----------
const TABS: [Tab, string, string][] = [
  ["home", "Home", "home"],
  ["review", "Review", "cards"],
  ["talk", "Talk", "chat"],
  ["phrases", "Words", "book"],
  ["suffix", "Grammar", "harmony"],
];

function shell() {
  const nav = h("nav", { class: "tabbar", role: "tablist" });
  for (const [id, label, ic] of TABS) {
    const active = tab === id || (tab === "dream" && id === "home") || (tab === "me" && id === "home");
    nav.append(h("button", { role: "tab", "aria-selected": String(active), onclick: () => go(id) }, icon(ic, 22), h("span", {}, label)));
  }
  view = h("main", { class: "stack view" });
  root.replaceChildren(h("div", { class: "app" }, view), nav);
}

function go(t: Tab) {
  tab = t;
  try { localStorage.setItem("turkteach:tab", t); } catch { /* ignore */ }
  if (t !== "talk" && chat) endChat(false);
  shell();
  render();
  window.scrollTo(0, 0);
}

function render() {
  view.replaceChildren();
  ({ home: renderHome, review: renderReview, talk: renderTalk, phrases: renderPhrases, suffix: renderSuffix, dream: renderDream, me: renderMe })[tab]();
}

function topBar(title: string, ...right: Child[]) {
  return h("header", { class: "topbar" }, h("h1", {}, title), h("div", { class: "row", style: "gap:6px" }, ...right));
}

// ---------- Home ----------
let dreaming = false;
let dreamError = "";

function ring(done: number, total: number, center: Child, sub: string) {
  const r = 52, c = 2 * Math.PI * r, frac = total ? done / total : 0;
  const wrap = h("div", { class: "ring" });
  wrap.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="ring-bg"/><circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>`;
  wrap.append(h("div", { class: "ring-label" }, h("b", {}, center), h("span", {}, sub)));
  return wrap;
}

function renderHome() {
  const q = queue(S.cards);
  const learned = S.cards.filter((c) => c.reps >= 2).length;
  const name = S.profile.learnerName;
  const pending = S.profile.pending;

  view.append(
    topBar(name ? `Merhaba, ${name}` : "Merhaba", iconBtn("user", "You", () => go("me"))),
    h("section", { class: "hero" },
      ring(learned, S.cards.length, String(q.length), "to review"),
      h("div", { class: "stack", style: "gap:10px;align-items:flex-start" },
        h("p", { class: "muted small" }, `${learned} of ${S.cards.length} learned`),
        h("button", { class: "btn primary big", onclick: () => go("review"), disabled: !q.length }, q.length ? "Review" : "Done for now"),
      ),
    ),
    h("div", { class: "tiles" },
      h("button", { class: "tile-btn talk", onclick: () => go("talk") }, icon("chat", 28), h("b", {}, "Talk"), h("span", {}, "Role-play")),
      h("button", { class: "tile-btn dream", onclick: () => go("dream") },
        icon("moon", 28),
        h("b", {}, dreaming ? "Dreaming…" : "Dream"),
        h("span", {}, pending ? "Ready to review" : S.profile.memories.length ? `${S.profile.memories.length} memories` : "Learns from you"),
        pending ? h("i", { class: "dot", "aria-label": "New" }) : null,
      ),
    ),
  );

  const mem = S.profile.memories.filter((m) => m.kind === "focus" || m.kind === "weak").slice(0, 4);
  if (mem.length) {
    view.append(
      h("div", { class: "stack", style: "gap:6px" },
        h("span", { class: "eyebrow" }, "Working on"),
        h("div", { class: "tags" }, ...mem.map((m) => h("span", { class: `chip ${KIND_CHIP[m.kind]}` }, m.text))),
      ),
    );
  }
}

// ---------- You ----------
function renderMe() {
  const learner = h("input", { type: "text", id: "learner-name", value: S.profile.learnerName, placeholder: "Your name" });
  const partner = h("input", { type: "text", id: "partner-name", value: S.profile.partnerName, placeholder: "Her name" });
  const saveNames = () => {
    S.profile.learnerName = learner.value.trim().slice(0, 40);
    S.profile.partnerName = partner.value.trim().slice(0, 40);
    saveProfile();
  };
  learner.addEventListener("change", saveNames);
  partner.addEventListener("change", saveNames);
  const auto = h("input", { type: "checkbox", id: "auto-dream", checked: S.profile.autoDream });
  auto.addEventListener("change", () => { S.profile.autoDream = auto.checked; saveProfile(); });
  view.append(
    topBar("You", iconBtn("close", "Close", () => go("home"))),
    h("section", { class: "panel" },
      h("label", { class: "field" }, "Your name", learner),
      h("label", { class: "field" }, "Her name", partner),
      h("label", { class: "row switch" }, auto, "Dream by itself once a day"),
    ),
    h("p", { class: "muted small center" }, store.remote ? "Saved privately to your Claude account." : "Saved in this browser only."),
  );
}

// ---------- Dream ----------
const KIND_LABEL: Record<Memory["kind"], string> = { weak: "Practise", strength: "Strong", focus: "Focus", fact: "You" };
const KIND_CHIP: Record<Memory["kind"], string> = { weak: "warn", strength: "blue", focus: "dream", fact: "" };
let dreamInfo = false;

function renderDream() {
  const p = S.profile;
  const last = p.dreams[p.dreams.length - 1];
  view.append(topBar("Dream", iconBtn("info", "What is dreaming?", () => { dreamInfo = !dreamInfo; render(); }, dreamInfo ? "on" : "")));
  if (dreamInfo) {
    view.append(h("p", { class: "notice" },
      "While you practise, the app keeps small notes. Dreaming reads across them, finds what keeps coming up, and suggests changes. Nothing changes until you apply it."));
  }

  if (p.pending) { view.append(proposalView(p.pending)); return; }

  view.append(
    h("section", { class: "dream-hero" },
      h("div", { class: "moon" }, icon("moon", 40)),
      last?.note ? h("p", {}, last.note) : h("p", { class: "muted" }, "No dreams yet."),
      P.sample
        ? h("button", { class: "btn primary big", disabled: dreaming, onclick: () => runDream() }, dreaming ? "Dreaming…" : "Dream now")
        : h("span", { class: "chip" }, "Open on claude.ai to dream"),
      last ? h("span", { class: "muted small" }, `Last dream ${ago(last.at)}`) : null,
      dreamError ? h("p", { class: "error" }, dreamError) : null,
    ),
  );

  if (p.memories.length) {
    const order: Memory["kind"][] = ["focus", "weak", "strength", "fact"];
    const list = h("div", { class: "panel list" });
    for (const m of [...p.memories].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))) {
      const ev = h("div", { class: "muted small", hidden: true }, ...m.evidence.map((e) => h("div", { class: "tr quote" }, e)));
      list.append(
        h("button", { class: "list-row", onclick: () => (ev.hidden = !ev.hidden) },
          h("span", { class: `chip ${KIND_CHIP[m.kind]}` }, KIND_LABEL[m.kind]),
          h("span", { class: "grow" }, m.text, ev),
          m.seen > 1 ? h("span", { class: "muted small" }, `${m.seen}×`) : null,
        ),
      );
    }
    view.append(h("span", { class: "eyebrow" }, "What Claude remembers"), list);
  }
  if (p.history.length) view.append(historyView());
}

function proposalView(d: DreamProposal): HTMLElement {
  const keep = { changes: d.changes.map(() => true), cards: d.cards.map(() => true), scenarios: d.scenarios.map(() => true) };
  const box = h("div", { class: "stack", style: "gap:14px" });
  box.append(
    h("section", { class: "dream-hero" }, h("div", { class: "moon" }, icon("sparkle", 36)), h("p", {}, d.note || d.summary)),
  );
  const item = (arr: boolean[], i: number, main: Child, sub: Child, detail: Child[]) => {
    const cb = h("input", { type: "checkbox", checked: true, "aria-label": "Keep" });
    cb.addEventListener("change", () => (arr[i] = cb.checked));
    const more = h("div", { class: "muted small stack", style: "gap:4px", hidden: true }, ...detail);
    const row = h("div", { class: "list-row" }, cb,
      h("div", { class: "grow stack", style: "gap:2px" }, main, sub, more),
      detail.length ? iconBtn("info", "Why", () => (more.hidden = !more.hidden), "small") : null,
    );
    return row;
  };
  const opLabel = { add: "New", update: "Update", remove: "Forget" };
  if (d.changes.length) {
    const list = h("div", { class: "panel list" });
    d.changes.forEach((c, i) => {
      const old = c.id ? S.profile.memories.find((m) => m.id === c.id) : undefined;
      list.append(item(keep.changes, i,
        h("span", { class: "row", style: "gap:6px" }, h("span", { class: `chip ${c.op === "remove" ? "warn" : "dream"}` }, opLabel[c.op]), h("span", { class: `chip ${KIND_CHIP[c.kind]}` }, KIND_LABEL[c.kind])),
        h("span", {}, c.op === "remove" ? old?.text ?? c.text : c.text),
        [c.why ? h("span", {}, c.why + (c.count > 1 ? ` (${c.count}×)` : "")) : "", ...c.evidence.map((e) => h("span", { class: "tr quote" }, e))],
      ));
    });
    box.append(h("span", { class: "eyebrow" }, "Memory"), list);
  }
  if (d.cards.length) {
    const list = h("div", { class: "panel list" });
    d.cards.forEach((c, i) => list.append(item(keep.cards, i, h("span", { class: "tr" }, c.tr), h("span", { class: "muted small" }, c.en), c.why || c.note ? [h("span", {}, c.why || c.note)] : [])));
    box.append(h("span", { class: "eyebrow" }, "New cards"), list);
  }
  if (d.scenarios.length) {
    const list = h("div", { class: "panel list" });
    d.scenarios.forEach((c, i) => list.append(item(keep.scenarios, i, h("b", {}, c.title), "", [h("span", {}, c.setting), c.why ? h("span", {}, c.why) : ""])));
    box.append(h("span", { class: "eyebrow" }, "New scenes"), list);
  }
  const none = { changes: d.changes.map(() => false), cards: d.cards.map(() => false), scenarios: d.scenarios.map(() => false) };
  box.append(
    h("div", { class: "row" },
      h("button", { class: "btn primary big grow", onclick: () => acceptDream(d, keep) }, "Apply"),
      h("button", { class: "btn big", onclick: () => acceptDream(d, none) }, "Discard"),
    ),
  );
  return box;
}

function acceptDream(d: DreamProposal, keep: { changes: boolean[]; cards: boolean[]; scenarios: boolean[] }) {
  const p = S.profile;
  const changes = d.changes.filter((_, i) => keep.changes[i]);
  let accepted = 0;
  if (changes.length) {
    p.history.push({ at: Date.now(), reason: "Before dream", level: p.level, memories: p.memories });
    p.memories = applyChanges(p.memories, changes);
    p.level = d.level || p.level;
    accepted += changes.length;
  }
  d.cards.forEach((c, i) => { if (keep.cards[i] && addCard(c.tr, c.en, "dream", c.topic, c.note || undefined)) accepted++; });
  d.scenarios.forEach((c, i) => {
    if (!keep.scenarios[i]) return;
    p.scenarios.push({ id: `dream-${d.at}-${i}`, title: c.title, character: c.character, setting: c.setting, goal: c.goal, source: "dream" });
    accepted++;
  });
  const total = d.changes.length + d.cards.length + d.scenarios.length;
  p.dreams.push({ at: d.at, summary: d.summary, note: d.note, accepted, rejected: total - accepted });
  p.pending = null;
  saveProfile();
  render();
}

function historyView(): HTMLElement {
  const p = S.profile;
  const det = h("details", { class: "small muted" }, h("summary", {}, `Earlier versions (${p.history.length})`));
  for (const v of [...p.history].reverse()) {
    det.append(
      h("div", { class: "row spread" },
        h("span", {}, `${new Date(v.at).toLocaleDateString()} · ${v.memories.length} memories`),
        h("button", { class: "btn ghost", onclick: () => {
          p.history.push({ at: Date.now(), reason: "Before restore", level: p.level, memories: p.memories });
          p.memories = v.memories;
          p.level = v.level;
          saveProfile();
          render();
        } }, "Restore"),
      ),
    );
  }
  return det;
}

async function runDream() {
  if (dreaming || !P.sample || S.profile.pending) return;
  dreaming = true;
  dreamError = "";
  if (tab === "dream" || tab === "home") render();
  try {
    const d = await dream(P.sample, S);
    S.profile.pending = d;
    S.profile.lastDream = d.at;
    saveProfile();
  } catch (e) {
    dreamError = errorText(e);
  } finally {
    dreaming = false;
    if (tab === "dream" || tab === "home") render();
  }
}

function ago(t: number): string {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return m <= 1 ? "just now" : `${m} min ago`;
  const hr = Math.round(m / 60);
  if (hr < 36) return `${hr} h ago`;
  return `${Math.round(hr / 24)} days ago`;
}

// ---------- Review ----------
let revealed = false;
let reverse = false;
const session = { done: 0 };

function renderReview() {
  const q = queue(S.cards);
  view.append(
    topBar("Review",
      h("span", { class: "count" }, String(q.length)),
      iconBtn("swap", reverse ? "Showing English first" : "Showing Turkish first", () => { reverse = !reverse; revealed = false; render(); }, reverse ? "on" : ""),
    ),
  );
  const total = q.length + session.done;
  view.append(h("div", { class: "bar" }, h("i", { style: `width:${total ? (session.done / total) * 100 : 100}%` })));

  if (!q.length) {
    view.append(h("section", { class: "flash" }, icon("check", 44), h("p", { class: "prompt" }, "Aferin!"), h("button", { class: "btn primary big", onclick: () => go("talk") }, "Talk")));
    return;
  }
  const card = q[0];
  const front = reverse ? card.en : card.tr;
  const back = reverse ? card.tr : card.en;
  const flash = h("section", { class: "flash" + (revealed ? " open" : ""), tabindex: 0, role: "button", "aria-label": revealed ? "Answer" : "Show answer", onclick: () => { if (!revealed) reveal(); } },
    card.source === "dream" ? h("span", { class: "badge" }, icon("moon", 14), "Dream") : card.due === 0 ? h("span", { class: "badge" }, "New") : null,
    h("p", { class: "prompt" + (reverse ? "" : " tr") }, front),
  );
  if (revealed) {
    flash.append(h("div", { class: "divider" }), h("p", { class: "answer" + (reverse ? " tr" : "") }, back));
    if (card.note) {
      const note = h("p", { class: "muted small", hidden: true }, card.note);
      flash.append(note);
      flash.prepend(h("span", { class: "corner" }, iconBtn("info", "Note", (e) => { e.stopPropagation(); note.hidden = !note.hidden; }, "small")));
    }
  } else flash.append(h("span", { class: "muted small" }, "Tap to flip"));
  const sp = speakBtn(card.tr);
  if (sp && (!reverse || revealed)) flash.append(sp);
  view.append(flash);

  if (revealed) {
    const g = (grade: Grade, label: string, cls: string) => h("button", { class: `btn grade ${cls}`, onclick: () => grade_(card, grade) }, label);
    view.append(h("div", { class: "grades" }, g(0, "Again", "again"), g(1, "Hard", "hard"), g(2, "Good", "good"), g(3, "Easy", "easy")));
  }
}

function reveal() {
  revealed = true;
  render();
  const c = queue(S.cards)[0];
  if (c && reverse) speak(c.tr);
}

function grade_(card: Card, grade: Grade) {
  const i = S.cards.findIndex((c) => c.id === card.id);
  if (i < 0) return;
  S.cards[i] = schedule(card, grade);
  S.log.reviews += 1;
  if (grade === 0) S.log.mistakes.push({ at: Date.now(), kind: "review-miss", tr: card.tr, en: card.en });
  session.done += 1;
  revealed = false;
  saveDeck();
  saveLog();
  render();
}

document.addEventListener("keydown", (e) => {
  if (tab !== "review") return;
  const t = e.target as HTMLElement;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  const card = queue(S.cards)[0];
  if (!card) return;
  if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
  else if (revealed && ["1", "2", "3", "4"].includes(e.key)) grade_(card, (Number(e.key) - 1) as Grade);
});

// ---------- Talk ----------
interface ChatState {
  scenario: Scenario;
  turns: Turn[];
  extras: Map<number, RoleplayReply>;
  busy: boolean;
  error: string;
  abort?: AbortController;
  draft: string;
  showHint: boolean;
  showGoal: boolean;
}
let chat: ChatState | null = null;

const SCENE_ICON: Record<string, string> = { "first-dinner": "dinner", "tea-with-dad": "tea", "kitchen-help": "pot", "bayram-visit": "gift", "video-call": "phone", cousins: "people" };

function allScenarios(): Scenario[] {
  return [...S.profile.scenarios.slice().reverse(), ...STARTER_SCENARIOS];
}

function renderTalk() {
  if (chat) { renderChat(chat); return; }
  view.append(topBar("Talk"));
  if (!P.sample) view.append(h("p", { class: "notice" }, "Open on claude.ai to talk."));
  const grid = h("div", { class: "scenes" });
  for (const s of allScenarios()) {
    grid.append(
      h("button", { class: "scene" + (s.source === "dream" ? " from-dream" : ""), disabled: !P.sample, onclick: () => startChat(s) },
        h("span", { class: "scene-icon" }, icon(s.source === "dream" ? "sparkle" : SCENE_ICON[s.id] ?? "chat", 26)),
        h("b", {}, s.title),
      ),
    );
  }
  view.append(grid);
}

function startChat(s: Scenario) {
  chat = { scenario: s, turns: [], extras: new Map(), busy: false, error: "", draft: "", showHint: false, showGoal: false };
  render();
  takeTurn();
}

function endChat(rerender = true) {
  if (chat) {
    chat.abort?.abort();
    const yours = chat.turns.filter((t) => t.who === "you").length;
    if (yours > 0) {
      S.log.sessions.push({ at: Date.now(), scenario: chat.scenario.title, turns: chat.turns.map((t) => ({ who: t.who, tr: t.tr })) });
      saveLog();
    }
  }
  chat = null;
  if (rerender) render();
}

async function takeTurn() {
  if (!chat || !P.sample) return;
  const c = chat;
  c.busy = true;
  c.error = "";
  c.showHint = false;
  c.abort = new AbortController();
  render();
  try {
    const r = await roleplayTurn(P.sample, S, c.scenario, c.turns, c.abort.signal);
    if (chat !== c) return;
    const lastYou = c.turns.length - 1;
    if (r.correction && lastYou >= 0 && c.turns[lastYou].who === "you") {
      S.log.mistakes.push({ at: Date.now(), kind: "correction", said: r.correction.said || c.turns[lastYou].tr, better: r.correction.better, why: r.correction.why });
      saveLog();
    }
    c.turns.push({ who: "them", tr: r.reply_tr, en: r.reply_en });
    c.extras.set(c.turns.length - 1, r);
  } catch (e) {
    if (chat === c) c.error = errorText(e);
  } finally {
    if (chat === c) {
      c.busy = false;
      render();
      const last = c.turns[c.turns.length - 1];
      if (last?.who === "them" && autoSpeak) speak(last.tr);
    }
  }
}

let autoSpeak = false;

function renderChat(c: ChatState) {
  view.append(
    h("header", { class: "topbar" },
      h("div", { class: "row", style: "gap:4px;min-width:0;flex-wrap:nowrap" },
        iconBtn("back", "End conversation", () => endChat(), "plain"),
        h("h1", { class: "ellipsis" }, c.scenario.title),
      ),
      h("div", { class: "row", style: "gap:6px;flex-wrap:nowrap" },
        canSpeak() ? iconBtn("speaker", autoSpeak ? "Auto-read on" : "Auto-read off", () => { autoSpeak = !autoSpeak; render(); }, autoSpeak ? "on" : "") : null,
        iconBtn("info", "Goal", () => { c.showGoal = !c.showGoal; render(); }, c.showGoal ? "on" : ""),
      ),
    ),
  );
  if (c.showGoal) view.append(h("p", { class: "notice" }, c.scenario.goal));

  const log = h("div", { class: "chat", "aria-live": "polite" });
  let lastHint: RoleplayReply | undefined;
  c.turns.forEach((t, i) => {
    if (t.who === "them") {
      const ex = c.extras.get(i);
      const en = h("p", { class: "en", hidden: true }, t.en ?? "");
      log.append(
        h("div", { class: "bubble them", onclick: () => (en.hidden = !en.hidden), title: "Tap for English" },
          h("div", { class: "line" }, h("p", { class: "tr" }, t.tr), speakBtn(t.tr)),
          en,
        ),
      );
      if (ex?.phrases.length) {
        const row = h("div", { class: "phrase-add" });
        for (const ph of ex.phrases) {
          const exists = S.cards.some((x) => x.id === cardId(ph.tr));
          const b = h("button", { class: "mini", disabled: exists, title: ph.en }, icon(exists ? "check" : "plus", 14), ph.tr);
          b.addEventListener("click", () => { if (addCard(ph.tr, ph.en, "roleplay")) { b.replaceChildren(icon("check", 14), ph.tr); b.setAttribute("disabled", ""); } });
          row.append(b);
        }
        log.append(row);
      }
      if (i === c.turns.length - 1) lastHint = ex;
    } else {
      log.append(h("div", { class: "bubble you" }, h("p", {}, t.tr)));
      const cor = c.extras.get(i + 1)?.correction;
      if (cor) {
        const why = h("span", { class: "muted small", hidden: true }, cor.why);
        const exists = S.cards.some((x) => x.id === cardId(cor.better));
        const add = h("button", { class: "mini", disabled: exists, title: "Add to review" }, icon(exists ? "check" : "plus", 14));
        add.addEventListener("click", (e) => { e.stopPropagation(); if (addCard(cor.better, `Correction of: ${cor.said || t.tr}`, "roleplay", "Corrections", cor.why)) { add.replaceChildren(icon("check", 14)); add.setAttribute("disabled", ""); } });
        log.append(
          h("div", { class: "fix", onclick: () => (why.hidden = !why.hidden), title: "Tap for why" },
            h("div", { class: "row", style: "gap:6px;flex-wrap:nowrap" }, icon("check", 16), h("span", { class: "tr grow" }, cor.better), speakBtn(cor.better), add),
            why,
          ),
        );
      }
    }
  });
  if (c.busy) log.append(h("div", { class: "bubble them typing" }, h("i"), h("i"), h("i")));
  if (c.error) log.append(h("div", { class: "row" }, h("p", { class: "error" }, c.error), h("button", { class: "btn", onclick: takeTurn }, "Retry")));
  if (c.showHint && lastHint?.hint_tr) {
    log.append(h("div", { class: "hint" }, h("span", { class: "tr" }, lastHint.hint_tr), h("span", { class: "muted small" }, lastHint.hint_en)));
  }
  view.append(log);

  const input = h("textarea", { id: "chat-input", rows: 1, placeholder: "Türkçe…", disabled: c.busy }) as HTMLTextAreaElement;
  input.value = c.draft;
  input.addEventListener("input", () => (c.draft = input.value));
  const send = () => {
    const text = input.value.trim();
    if (!text || c.busy) return;
    c.turns.push({ who: "you", tr: text.slice(0, 500) });
    c.draft = "";
    takeTurn();
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  const composer = h("div", { class: "composer" },
    lastHint?.hint_tr && !c.busy ? iconBtn("bulb", "Idea", () => { c.showHint = !c.showHint; render(); }, c.showHint ? "on" : "") : null,
    input,
    P.dictation ? micButton(input, c) : null,
    iconBtn("send", "Send", send, "solid"),
  );
  view.append(composer);
  if (!c.busy) setTimeout(() => input.focus({ preventScroll: true }), 0);
  setTimeout(() => composer.scrollIntoView({ block: "end", behavior: "auto" }), 0);
}

function micButton(input: HTMLTextAreaElement, c: ChatState): HTMLElement {
  const d = P.dictation;
  let base = "";
  let listening = false;
  const offs: Array<() => void> = [];
  const btn = iconBtn("mic", "Speak Turkish", () => {
    if (listening) { d.stop().catch(() => {}); return; }
    base = input.value ? input.value.trimEnd() + " " : "";
    d.start({ language: "tr" }).catch((e: { code?: string }) => { if (e?.code === "not_granted") btn.remove(); });
    offs.push(
      d.onState(({ state }: { state: string }) => {
        listening = state === "listening" || state === "starting";
        btn.classList.toggle("live", listening);
        if (state === "idle") offs.splice(0).forEach((f) => f());
      }),
      d.onPartial(({ text }: { text: string }) => { input.value = base + text; }),
      d.onFinal(({ text }: { text: string }) => { base = base + text + " "; input.value = base; c.draft = input.value; }),
    );
  });
  return btn;
}

// ---------- Words ----------
let topicFilter = "All";
let adding = false;
function renderPhrases() {
  view.append(topBar("Words", h("span", { class: "count" }, String(S.cards.length)), iconBtn(adding ? "close" : "plus", adding ? "Close" : "Add a phrase", () => { adding = !adding; render(); }, adding ? "on" : "")));

  if (adding) {
    const tr = h("input", { type: "text", id: "new-tr", placeholder: "Türkçe" });
    const en = h("input", { type: "text", id: "new-en", placeholder: "English" });
    const add = () => {
      if (!tr.value.trim() || !en.value.trim()) return;
      addCard(tr.value.trim(), en.value.trim(), "roleplay", "My own");
      adding = false;
      render();
    };
    view.append(h("section", { class: "panel" }, tr, en, h("button", { class: "btn primary", onclick: add }, "Add")));
  }

  const extra = [...new Set(S.cards.map((c) => c.topic).filter((t) => !(TOPICS as string[]).includes(t)))];
  const short: Record<string, string> = { "Greetings & politeness": "Polite", "At the table": "Table", "Family": "Family", "Small talk": "Small talk", "Visits & holidays": "Visits", "Feelings & reactions": "Reactions" };
  view.append(
    h("div", { class: "filters" },
      ...["All", ...TOPICS, ...extra].map((t) =>
        h("button", { class: "filter" + (t === topicFilter ? " on" : ""), onclick: () => { topicFilter = t; render(); } }, short[t] ?? t)),
    ),
  );
  const list = h("div", { class: "panel list" });
  for (const c of S.cards.filter((c) => topicFilter === "All" || c.topic === topicFilter)) {
    const note = c.note ? h("span", { class: "muted small", hidden: true }, c.note) : null;
    const dot = c.source === "dream" ? "dream" : c.reps >= 2 ? "done" : c.due === 0 ? "new" : "learning";
    list.append(
      h("div", { class: "list-row", onclick: () => note && (note.hidden = !note.hidden) },
        h("i", { class: `status ${dot}`, title: dot }),
        h("div", { class: "grow stack", style: "gap:0" }, h("span", { class: "tr" }, c.tr), h("span", { class: "muted small" }, c.en), note),
        speakBtn(c.tr),
      ),
    );
  }
  view.append(list);
}

// ---------- Grammar ----------
let suffixWord = "ev";
function renderSuffix() {
  const input = h("input", { type: "text", id: "suffix-word", class: "big-input", value: suffixWord, placeholder: "kitap", autocomplete: "off", spellcheck: false });
  const out = h("div", { class: "panel list" });
  const draw = () => {
    suffixWord = input.value;
    const results = inflectAll(input.value);
    out.replaceChildren();
    out.hidden = !results.length;
    for (const r of results) {
      const stemLen = r.form.length - r.suffix.length - (r.form.includes(" ") ? 1 : 0);
      const steps = h("ol", { class: "steps", hidden: true }, ...r.steps.map((s) => h("li", {}, s.detail)));
      out.append(
        h("div", { class: "list-row form", onclick: () => (steps.hidden = !steps.hidden) },
          h("div", { class: "grow stack", style: "gap:2px" },
            h("span", { class: "word" }, r.form.slice(0, stemLen), h("em", {}, r.form.slice(stemLen))),
            steps,
          ),
          h("span", { class: "muted small" }, r.meaning),
          speakBtn(r.form),
        ),
      );
    }
  };
  input.addEventListener("input", draw);
  view.append(
    topBar("Grammar"),
    input,
    h("div", { class: "filters" }, ...["ev", "kitap", "araba", "çocuk", "anne", "İstanbul"].map((w) =>
      h("button", { class: "filter", onclick: () => { input.value = w; draw(); } }, w))),
    out,
  );
  draw();
}

// ---------- boot ----------
async function boot() {
  root.replaceChildren(h("div", { class: "app" }, h("p", { class: "muted center" }, "Yükleniyor…")));
  P = await loadPlatform();
  store = await openStore(P);
  let loaded: Awaited<ReturnType<Store["load"]>> = {};
  try {
    loaded = await store.load();
  } catch {
    loaded = {};
  }
  S = {
    cards: seedDeck(loaded.deck?.cards ?? []),
    profile: { ...emptyProfile(), ...(loaded.profile ?? {}) },
    log: { ...emptyLog(), ...(loaded.log ?? {}) },
  };
  if (!loaded.deck) saveDeck();
  try {
    const t = localStorage.getItem("turkteach:tab") as Tab | null;
    if (t && TABS.some(([id]) => id === t) && t !== "talk") tab = t;
  } catch { /* ignore */ }
  shell();
  render();

  // Dream on open once a day when there's something new. It only proposes; you still approve.
  const due = Date.now() - S.profile.lastDream > 20 * 3_600_000;
  if (P.sample && S.profile.autoDream && !S.profile.pending && due && dreamMaterial(S) >= 3) runDream();
}

boot();
