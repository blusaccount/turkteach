import "./style.css";
import { PHRASES, TOPICS } from "./phrases";
import { cardId, newCard, queue, schedule, type Card, type Grade } from "./srs";
import { inflectAll } from "./suffix";
import { STARTER_SCENARIOS } from "./scenarios";
import { applyChanges, dream, dreamMaterial, roleplayTurn, type RoleplayReply, type Turn } from "./ai";
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
type Tab = "home" | "review" | "talk" | "phrases" | "suffix";
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
const speakBtn = (text: string) =>
  canSpeak()
    ? h("button", { class: "icon-btn", title: "Listen", "aria-label": "Listen", onclick: (e: Event) => { e.stopPropagation(); speak(text); } }, "🔊")
    : null;

// ---------- shell ----------
const TABS: [Tab, string][] = [
  ["home", "Today"],
  ["review", "Review"],
  ["talk", "Talk"],
  ["phrases", "Phrases"],
  ["suffix", "Suffixes"],
];

function shell() {
  const tabs = h("nav", { class: "tabs", role: "tablist" });
  for (const [id, label] of TABS) {
    tabs.append(
      h("button", { role: "tab", "aria-selected": String(tab === id), onclick: () => go(id) }, label),
    );
  }
  view = h("main", { class: "stack", style: "gap:16px" });
  root.replaceChildren(
    h(
      "div",
      { class: "app" },
      h("header", { class: "top" },
        h("div", { class: "brand" }, h("span", { class: "tile", "aria-hidden": "true" }), h("h1", {}, "Öğretmen")),
        h("span", { class: "muted small" }, "Family Turkish, one conversation at a time"),
      ),
      tabs,
      view,
    ),
  );
}

function go(t: Tab) {
  tab = t;
  try { localStorage.setItem("turkteach:tab", t); } catch { /* ignore */ }
  if (t !== "talk" && chat) endChat(false);
  shell();
  render();
}

function render() {
  view.replaceChildren();
  ({ home: renderHome, review: renderReview, talk: renderTalk, phrases: renderPhrases, suffix: renderSuffix })[tab]();
}

// ---------- Today ----------
let dreaming = false;
let dreamError = "";

function renderHome() {
  const now = Date.now();
  const q = queue(S.cards, now);
  const learned = S.cards.filter((c) => c.reps >= 2).length;
  const name = S.profile.learnerName;

  view.append(
    h("section", { class: "panel" },
      h("h2", {}, name ? `Merhaba, ${name}!` : "Merhaba!"),
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("b", {}, String(q.length)), h("span", {}, "cards to review")),
        h("div", { class: "stat" }, h("b", {}, String(learned)), h("span", {}, "phrases learned")),
        h("div", { class: "stat" }, h("b", {}, String(S.log.sessions.length)), h("span", {}, "conversations")),
      ),
      h("div", { class: "row" },
        h("button", { class: "btn primary", onclick: () => go("review"), disabled: q.length === 0 }, q.length ? "Start review" : "All caught up"),
        h("button", { class: "btn", onclick: () => go("talk") }, "Practise a conversation"),
      ),
    ),
  );

  view.append(dreamPanel());

  // Settings: names make role-plays personal.
  const learner = h("input", { type: "text", id: "learner-name", value: S.profile.learnerName, placeholder: "e.g. Lukas" });
  const partner = h("input", { type: "text", id: "partner-name", value: S.profile.partnerName, placeholder: "Her name" });
  const saveNames = () => {
    S.profile.learnerName = learner.value.trim().slice(0, 40);
    S.profile.partnerName = partner.value.trim().slice(0, 40);
    saveProfile();
  };
  learner.addEventListener("change", saveNames);
  partner.addEventListener("change", saveNames);
  view.append(
    h("details", { class: "panel" },
      h("summary", { style: "cursor:pointer" }, h("b", {}, "Personalise")),
      h("p", { class: "muted small" }, "Names are used in the role-plays so the family talks to you, about her."),
      h("div", { class: "row" },
        h("label", { class: "field" }, "Your name", learner),
        h("label", { class: "field" }, "Your girlfriend's name", partner),
      ),
      h("p", { class: "muted small" }, store.remote
        ? "Your progress is saved privately to your claude.ai account."
        : "Running outside claude.ai: progress is saved in this browser only, and the Claude features are off."),
    ),
  );
}

const KIND_LABEL: Record<Memory["kind"], string> = { weak: "Needs work", strength: "Strength", focus: "Focus", fact: "About you" };
const KIND_CHIP: Record<Memory["kind"], string> = { weak: "warn", strength: "blue", focus: "dream", fact: "" };

function dreamPanel(): HTMLElement {
  const p = S.profile;
  const last = p.dreams[p.dreams.length - 1];
  const material = dreamMaterial(S);
  const panel = h("section", { class: "panel dream-panel" });
  panel.append(
    h("div", { class: "row spread" },
      h("div", { class: "stack", style: "gap:2px" },
        h("span", { class: "eyebrow" }, "Dreaming"),
        h("h2", {}, p.pending ? "Claude dreamt about your practice" : "What Claude remembers about you"),
      ),
      h("span", { class: "chip dream" }, last ? `Last dream ${ago(last.at)}` : "No dreams yet"),
    ),
  );

  if (p.pending) {
    panel.append(proposalView(p.pending));
    return panel;
  }

  if (p.memories.length) {
    if (last?.note) panel.append(h("p", {}, last.note));
    const order: Memory["kind"][] = ["focus", "weak", "strength", "fact"];
    const list = h("div", { class: "stack" });
    for (const m of [...p.memories].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))) {
      list.append(
        h("div", { class: "row", style: "align-items:flex-start;flex-wrap:nowrap" },
          h("span", { class: `chip ${KIND_CHIP[m.kind]}`, style: "flex:none" }, KIND_LABEL[m.kind]),
          h("span", { class: "small", style: "min-width:0" }, m.text, m.seen > 1 ? h("span", { class: "muted" }, ` · seen ${m.seen}×`) : null),
        ),
      );
    }
    panel.append(list);
  } else {
    panel.append(
      h("p", { class: "small" },
        "While you practise, the app keeps small notes: your corrections, missed cards and conversations. Dreaming is a separate pass where Claude reads across all of those, spots what keeps coming up, and proposes updates to its memory of you, new flashcards and new scenes. Nothing changes until you approve it.",
      ),
    );
  }
  if (!P.sample) {
    panel.append(h("p", { class: "notice" }, "Dreaming needs Claude. Open this app as an artifact on claude.ai to turn it on."));
    return panel;
  }
  const btn = h("button", { class: "btn primary", disabled: dreaming, onclick: () => runDream() }, dreaming ? "Dreaming…" : "Dream now");
  const auto = h("input", { type: "checkbox", id: "auto-dream", checked: p.autoDream });
  auto.addEventListener("change", () => { p.autoDream = auto.checked; saveProfile(); });
  panel.append(
    h("div", { class: "row spread" },
      btn,
      h("label", { class: "row small muted", style: "gap:6px" }, auto, "Dream by itself once a day"),
    ),
  );
  if (dreaming) panel.append(h("p", { class: "muted small" }, "Reading your recent sessions. This can take a minute."));
  else if (material < 3 && last)
    panel.append(h("p", { class: "muted small" }, "Not much new since the last dream. Review or talk a bit more first for a better one."));
  if (dreamError) panel.append(h("p", { class: "error" }, dreamError));
  if (p.history.length) panel.append(historyView());
  return panel;
}

/** The review step: every proposed change shows its evidence and can be kept or dropped. */
function proposalView(d: DreamProposal): HTMLElement {
  const keep = {
    changes: d.changes.map(() => true),
    cards: d.cards.map(() => true),
    scenarios: d.scenarios.map(() => true),
  };
  const box = h("div", { class: "stack", style: "gap:12px" });
  box.append(
    h("p", {}, d.note || d.summary),
    h("p", { class: "muted small" },
      `Read ${d.reviewed.sessions} conversation${d.reviewed.sessions === 1 ? "" : "s"}, ${d.reviewed.mistakes} corrections or misses, and your ${d.reviewed.cards} weakest cards. Untick anything that looks wrong, then apply.`),
  );
  const toggle = (arr: boolean[], i: number) => {
    const cb = h("input", { type: "checkbox", checked: true, "aria-label": "Keep this change" });
    cb.addEventListener("change", () => (arr[i] = cb.checked));
    return cb;
  };
  const opLabel = { add: "New", update: "Update", remove: "Forget" };
  if (d.changes.length) {
    const list = h("div", { class: "stack" }, h("h3", {}, "Memory"));
    d.changes.forEach((c, i) => {
      const old = c.id ? S.profile.memories.find((m) => m.id === c.id) : undefined;
      list.append(
        h("label", { class: "panel", style: "padding:10px 12px;gap:4px;flex-direction:row;align-items:flex-start" },
          toggle(keep.changes, i),
          h("div", { class: "stack", style: "gap:4px;min-width:0" },
            h("div", { class: "row", style: "gap:6px" },
              h("span", { class: `chip ${c.op === "remove" ? "warn" : "dream"}` }, opLabel[c.op]),
              h("span", { class: `chip ${KIND_CHIP[c.kind]}` }, KIND_LABEL[c.kind]),
              c.count > 1 ? h("span", { class: "muted small" }, `seen ${c.count}×`) : null,
            ),
            old && c.op === "update" ? h("span", { class: "muted small", style: "text-decoration:line-through" }, old.text) : null,
            h("span", { class: "small" }, c.op === "remove" ? old?.text ?? c.text : c.text),
            c.why ? h("span", { class: "muted small" }, c.why) : null,
            ...c.evidence.map((e) => h("span", { class: "small tr", style: "border-left:2px solid var(--line);padding-left:8px" }, e)),
          ),
        ),
      );
    });
    box.append(list);
  }
  if (d.cards.length) {
    const list = h("div", { class: "stack" }, h("h3", {}, "New flashcards"));
    d.cards.forEach((c, i) =>
      list.append(
        h("label", { class: "row", style: "align-items:flex-start;flex-wrap:nowrap" },
          toggle(keep.cards, i),
          h("div", { class: "stack", style: "gap:0;min-width:0" }, h("span", { class: "tr" }, c.tr), h("span", { class: "small" }, c.en), h("span", { class: "muted small" }, c.why || c.note)),
        ),
      ),
    );
    box.append(list);
  }
  if (d.scenarios.length) {
    const list = h("div", { class: "stack" }, h("h3", {}, "New scenes"));
    d.scenarios.forEach((c, i) =>
      list.append(
        h("label", { class: "row", style: "align-items:flex-start;flex-wrap:nowrap" },
          toggle(keep.scenarios, i),
          h("div", { class: "stack", style: "gap:0;min-width:0" }, h("b", { class: "small" }, c.title), h("span", { class: "muted small" }, c.why || c.setting)),
        ),
      ),
    );
    box.append(list);
  }
  box.append(
    h("div", { class: "row" },
      h("button", { class: "btn primary", onclick: () => acceptDream(d, keep) }, "Apply selected"),
      h("button", { class: "btn", onclick: () => acceptDream(d, { changes: d.changes.map(() => false), cards: d.cards.map(() => false), scenarios: d.scenarios.map(() => false) }) }, "Discard dream"),
    ),
  );
  return box;
}

function acceptDream(d: DreamProposal, keep: { changes: boolean[]; cards: boolean[]; scenarios: boolean[] }) {
  const p = S.profile;
  const changes = d.changes.filter((_, i) => keep.changes[i]);
  let accepted = 0;
  if (changes.length) {
    p.history.push({ at: Date.now(), reason: "Before dream of " + new Date(d.at).toLocaleDateString(), level: p.level, memories: p.memories });
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
  const det = h("details", {}, h("summary", { class: "small muted", style: "cursor:pointer" }, `Memory history (${p.history.length} earlier versions)`));
  for (const v of [...p.history].reverse()) {
    det.append(
      h("div", { class: "row spread small", style: "padding-top:6px" },
        h("span", {}, `${new Date(v.at).toLocaleString()} · ${v.memories.length} entries`),
        h("button", { class: "btn ghost", onclick: () => {
          p.history.push({ at: Date.now(), reason: "Before rollback", level: p.level, memories: p.memories });
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
  if (tab === "home") render();
  try {
    const d = await dream(P.sample, S);
    S.profile.pending = d;
    S.profile.lastDream = d.at;
    saveProfile();
  } catch (e) {
    dreamError = errorText(e);
  } finally {
    dreaming = false;
    if (tab === "home") render();
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
let session = { done: 0 };

function renderReview() {
  const q = queue(S.cards);
  const dir = h("label", { class: "row small muted", style: "gap:6px" },
    h("input", { type: "checkbox", id: "reverse", checked: reverse, onchange: (e: Event) => { reverse = (e.target as HTMLInputElement).checked; revealed = false; render(); } }),
    "English → Turkish",
  );
  view.append(h("div", { class: "row spread" }, h("span", { class: "muted small" }, `${q.length} left · ${session.done} done this session`), dir));

  if (!q.length) {
    view.append(
      h("section", { class: "panel flash" },
        h("p", { class: "prompt" }, "Aferin! 🎉"),
        h("p", { class: "muted" }, "Well done. Nothing left to review right now."),
        h("button", { class: "btn primary", onclick: () => go("talk") }, "Practise a conversation"),
      ),
    );
    return;
  }
  const card = q[0];
  const front = reverse ? card.en : card.tr;
  const back = reverse ? card.tr : card.en;
  const panel = h("section", { class: "panel flash" },
    h("div", { class: "row" },
      h("span", { class: "chip" + (card.source === "dream" ? " dream" : "") }, card.source === "dream" ? "From a dream" : card.topic),
      card.due === 0 ? h("span", { class: "chip blue" }, "New") : null,
    ),
    h("div", { class: "row", style: "justify-content:center" }, h("p", { class: "prompt" + (reverse ? "" : " tr") }, front), !reverse ? speakBtn(card.tr) : null),
  );
  if (revealed) {
    panel.append(
      h("div", { class: "row", style: "justify-content:center" }, h("p", { class: "answer" + (reverse ? " tr" : "") }, back), reverse ? speakBtn(card.tr) : null),
      card.note ? h("p", { class: "muted small" }, card.note) : "",
    );
  } else {
    panel.append(h("button", { class: "btn primary", onclick: reveal }, "Show answer"), h("span", { class: "muted small" }, "Say it out loud first. Space to reveal."));
  }
  view.append(panel);

  if (revealed) {
    const g = (grade: Grade, label: string, sub: string, cls = "") =>
      h("button", { class: `btn ${cls}`, onclick: () => grade_(card, grade) }, label, h("small", {}, sub));
    view.append(
      h("div", { class: "grades" },
        g(0, "Again", "1", "again"),
        g(1, "Hard", "2"),
        g(2, "Good", "3"),
        g(3, "Easy", "4"),
      ),
    );
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
  extras: Map<number, RoleplayReply>; // reply metadata keyed by turn index
  busy: boolean;
  error: string;
  abort?: AbortController;
  draft: string;
}
let chat: ChatState | null = null;

function allScenarios(): Scenario[] {
  return [...S.profile.scenarios.slice().reverse(), ...STARTER_SCENARIOS];
}

function renderTalk() {
  if (!P.sample) {
    view.append(h("p", { class: "notice" }, "Conversation practice runs on Claude. Open this app as an artifact on claude.ai and it uses your own Claude plan, with no API key."));
  }
  if (!chat) {
    view.append(h("div", { class: "stack", style: "gap:4px" },
      h("h2", {}, "Pick a scene"),
      h("p", { class: "muted small" }, "Claude plays a member of her family. Write in Turkish (English is fine when you're stuck) and you'll get gentle corrections."),
    ));
    const grid = h("div", { class: "scenarios" });
    for (const s of allScenarios()) {
      grid.append(
        h("button", { class: "panel scenario", disabled: !P.sample, onclick: () => startChat(s) },
          h("div", { class: "row spread" }, h("h3", {}, s.title), s.source === "dream" ? h("span", { class: "chip dream" }, "From a dream") : null),
          h("p", { class: "muted small" }, s.setting),
          h("p", { class: "small" }, h("b", {}, "Goal: "), s.goal),
        ),
      );
    }
    view.append(grid);
    return;
  }
  renderChat(chat);
}

function startChat(s: Scenario) {
  chat = { scenario: s, turns: [], extras: new Map(), busy: false, error: "", draft: "" };
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
  c.abort = new AbortController();
  render();
  try {
    const r = await roleplayTurn(P.sample, S, c.scenario, c.turns, c.abort.signal);
    if (chat !== c) return;
    // Attach the correction to the learner's last line.
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
  const auto = h("input", { type: "checkbox", id: "auto-speak", checked: autoSpeak, onchange: (e: Event) => { autoSpeak = (e.target as HTMLInputElement).checked; } });
  view.append(
    h("div", { class: "row spread" },
      h("div", { class: "stack", style: "gap:2px;min-width:0;flex:1" }, h("h2", {}, c.scenario.title), h("p", { class: "muted small" }, c.scenario.goal)),
      h("button", { class: "btn", onclick: () => endChat() }, "End conversation"),
    ),
    canSpeak() ? h("label", { class: "row small muted", style: "gap:6px" }, auto, "Read replies aloud") : "",
  );

  const log = h("div", { class: "chat", "aria-live": "polite" });
  c.turns.forEach((t, i) => {
    if (t.who === "them") {
      const ex = c.extras.get(i);
      const en = h("p", { class: "en", hidden: true }, t.en ?? "");
      log.append(
        h("div", { class: "bubble them" },
          h("div", { class: "line" }, h("p", { class: "tr" }, t.tr), speakBtn(t.tr)),
          en,
          h("button", { class: "btn ghost small", style: "align-self:flex-start;padding:0", onclick: (e: Event) => { en.hidden = !en.hidden; (e.target as HTMLElement).textContent = en.hidden ? "Show English" : "Hide English"; } }, "Show English"),
        ),
      );
      if (ex && ex.phrases.length) {
        const row = h("div", { class: "phrase-add" });
        for (const ph of ex.phrases) {
          const exists = S.cards.some((x) => x.id === cardId(ph.tr));
          const b = h("button", { class: "chip blue", style: "border:0;cursor:pointer", disabled: exists, title: ph.en }, exists ? `✓ ${ph.tr}` : `+ ${ph.tr}`);
          b.addEventListener("click", () => { if (addCard(ph.tr, ph.en, "roleplay")) { b.textContent = `✓ ${ph.tr}`; b.setAttribute("disabled", ""); } });
          row.append(b);
        }
        log.append(row);
      }
      if (ex && i === c.turns.length - 1 && ex.hint_tr && !c.busy) {
        log.append(h("p", { class: "hint" }, "Idea: ", h("span", { class: "tr" }, ex.hint_tr), ` (${ex.hint_en})`));
      }
    } else {
      log.append(h("div", { class: "bubble you" }, h("p", {}, t.tr)));
      const next = c.extras.get(i + 1);
      if (next?.correction) {
        const cor = next.correction;
        const fix = h("div", { class: "fix" },
          h("span", { class: "eyebrow" }, "Better"),
          h("div", { class: "row", style: "gap:6px" }, h("span", { class: "better tr" }, cor.better), speakBtn(cor.better)),
          cor.why ? h("span", { class: "muted" }, cor.why) : null,
        );
        const exists = S.cards.some((x) => x.id === cardId(cor.better));
        const add = h("button", { class: "btn ghost small", style: "align-self:flex-start;padding:0", disabled: exists }, exists ? "In your deck" : "+ Add to review");
        add.addEventListener("click", () => { if (addCard(cor.better, `Correction of: ${cor.said || t.tr}`, "roleplay", "Corrections", cor.why)) { add.textContent = "Added"; add.setAttribute("disabled", ""); } });
        fix.append(add);
        log.append(fix);
      }
    }
  });
  if (c.busy) log.append(h("p", { class: "hint" }, "…"));
  if (c.error) log.append(h("div", { class: "row" }, h("p", { class: "error" }, c.error), h("button", { class: "btn", onclick: takeTurn }, "Try again")));
  view.append(log);

  // Composer
  const input = h("textarea", { id: "chat-input", rows: 2, placeholder: "Türkçe yaz… (Write in Turkish)", disabled: c.busy }) as HTMLTextAreaElement;
  input.value = c.draft;
  input.addEventListener("input", () => (c.draft = input.value));
  const send = () => {
    const text = input.value.trim();
    if (!text || c.busy) return;
    c.turns.push({ who: "you", tr: text.slice(0, 500) });
    c.draft = "";
    takeTurn();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  const composer = h("div", { class: "composer" }, input);
  if (P.dictation) composer.append(micButton(input, c));
  composer.append(h("button", { class: "btn primary", disabled: c.busy, onclick: send }, "Send"));
  view.append(composer);
  if (!c.busy) setTimeout(() => input.focus({ preventScroll: true }), 0);
  setTimeout(() => composer.scrollIntoView({ block: "end", behavior: "auto" }), 0);
}

function micButton(input: HTMLTextAreaElement, c: ChatState): HTMLElement {
  const d = P.dictation;
  const btn = h("button", { class: "icon-btn", title: "Speak Turkish", "aria-label": "Speak Turkish" }, "🎙");
  let base = "";
  let listening = false;
  const offs: Array<() => void> = [];
  btn.addEventListener("click", () => {
    if (listening) { d.stop().catch(() => {}); return; }
    base = input.value ? input.value.trimEnd() + " " : "";
    d.start({ language: "tr" }).catch((e: { code?: string }) => {
      if (e?.code === "not_granted") btn.remove();
    });
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

// ---------- Phrases ----------
let topicFilter = "All";
function renderPhrases() {
  const topics = ["All", ...TOPICS, ...new Set(S.cards.map((c) => c.topic).filter((t) => !(TOPICS as string[]).includes(t)))];
  const sel = h("select", { id: "topic", "aria-label": "Topic" }, ...topics.map((t) => h("option", { value: t, selected: t === topicFilter }, t)));
  sel.addEventListener("change", () => { topicFilter = sel.value; render(); });

  const en = h("input", { type: "text", id: "new-en", placeholder: "English" });
  const tr = h("input", { type: "text", id: "new-tr", placeholder: "Türkçe" });
  const msg = h("span", { class: "muted small" });
  const add = () => {
    if (!tr.value.trim() || !en.value.trim()) { msg.textContent = "Fill in both sides."; return; }
    msg.textContent = addCard(tr.value.trim(), en.value.trim(), "roleplay", "My own") ? "Added to your review deck." : "That one's already in your deck.";
    tr.value = en.value = "";
    setTimeout(render, 900);
  };

  view.append(
    h("details", { class: "panel" },
      h("summary", { style: "cursor:pointer" }, h("b", {}, "Add your own phrase")),
      h("p", { class: "muted small" }, "Heard something at dinner? Add it here and it joins your reviews."),
      h("div", { class: "row" }, tr, en),
      h("div", { class: "row" }, h("button", { class: "btn primary", onclick: add }, "Add"), msg),
    ),
    h("div", { class: "row spread" }, h("span", { class: "muted small" }, `${S.cards.length} phrases in your deck`), h("div", { style: "max-width:260px;flex:1" }, sel)),
  );
  const list = h("div", { class: "panel phrase-list" });
  const cards = S.cards.filter((c) => topicFilter === "All" || c.topic === topicFilter);
  for (const c of cards) {
    const state = c.due === 0 ? "New" : c.reps >= 2 ? "Learned" : "Learning";
    list.append(
      h("div", { class: "phrase" },
        speakBtn(c.tr),
        h("div", { class: "body" },
          h("span", { class: "tr" }, c.tr),
          h("span", { class: "small" }, c.en),
          c.note ? h("span", { class: "muted small" }, c.note) : null,
        ),
        h("span", { class: "chip" + (c.source === "dream" ? " dream" : state === "Learned" ? " blue" : "") }, c.source === "dream" ? "Dream" : state),
      ),
    );
  }
  view.append(list);
}

// ---------- Suffixes ----------
let suffixWord = "ev";
function renderSuffix() {
  const input = h("input", { type: "text", id: "suffix-word", value: suffixWord, placeholder: "Type a Turkish noun, e.g. kitap", autocomplete: "off", spellcheck: false });
  const out = h("div", { class: "forms" });
  const draw = () => {
    suffixWord = input.value;
    const results = inflectAll(input.value);
    out.replaceChildren();
    if (!input.value.trim()) return;
    if (!results.length) {
      out.append(h("p", { class: "muted" }, "Type a single Turkish word with at least one vowel."));
      return;
    }
    for (const r of results) {
      const stemLen = r.form.length - r.suffix.length - (r.form.includes(" ") ? 1 : 0);
      const stem = r.form.slice(0, stemLen);
      const tail = r.form.slice(stemLen);
      out.append(
        h("details", { class: "form-row" },
          h("summary", {},
            h("span", { class: "row", style: "gap:8px" }, h("span", { class: "word" }, stem, h("em", {}, tail)), speakBtn(r.form)),
            h("span", { class: "muted small", style: "text-align:right" }, r.meaning),
          ),
          h("ol", {}, ...r.steps.map((s) => h("li", {}, h("b", {}, s.label + ": "), s.detail))),
        ),
      );
    }
  };
  input.addEventListener("input", draw);
  view.append(
    h("section", { class: "panel" },
      h("h2", {}, "Vowel harmony helper"),
      h("p", { class: "muted small" }, "Turkish suffixes change their vowel to match the word. Type a noun to see its common forms; open a row to see why."),
      h("div", { class: "row" }, ...["ev", "kitap", "araba", "çocuk", "anne", "İstanbul"].map((w) =>
        h("button", { class: "chip blue", style: "border:0;cursor:pointer", onclick: () => { input.value = w; draw(); } }, w))),
      input,
    ),
    out,
    h("p", { class: "muted small" }, "Regular rules only. Loanwords (saat → saati) and a few short words (dört → dördü) break them."),
  );
  draw();
}

// ---------- boot ----------
async function boot() {
  root.replaceChildren(h("div", { class: "app" }, h("p", { class: "muted" }, "Yükleniyor… (loading)")));
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

  // Self-learning: dream on open once a day when there's something new to learn from.
  const due = Date.now() - S.profile.lastDream > 20 * 3_600_000;
  if (P.sample && S.profile.autoDream && due && dreamMaterial(S) >= 3) runDream();
}

boot();
