// Prompts for the two Claude features. Both run through the artifact's `sample`
// capability, which uses the viewer's own Claude plan. No API key involved.

import type { Sample } from "./platform";
import type { AppState, DreamProposal, Memory, MemoryChange, Scenario } from "./store";
import { weakest } from "./srs";
import { drillSummary } from "./drill";

export interface Turn {
  who: "you" | "them";
  tr: string;
  en?: string;
}

export interface RoleplayReply {
  reply_tr: string;
  reply_en: string;
  correction: { said: string; better: string; why: string } | null;
  hint_tr: string;
  hint_en: string;
  phrases: { tr: string; en: string }[];
}

function learnerContext(s: AppState): string {
  const p = s.profile;
  const mem = (k: Memory["kind"]) => p.memories.filter((m) => m.kind === k).map((m) => m.text);
  const lines = [
    `Learner level: ${p.level}.`,
    p.learnerName ? `Learner's name: ${p.learnerName}.` : "",
    p.partnerName ? `Their girlfriend's name: ${p.partnerName}.` : "",
    mem("weak").length ? `Known weak spots (gently steer the conversation to practise these): ${mem("weak").join("; ")}.` : "",
    mem("focus").length ? `Current focus: ${mem("focus").join("; ")}.` : "",
    mem("fact").length ? `About the learner: ${mem("fact").join("; ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function roleplayTurn(
  sample: Sample,
  state: AppState,
  scenario: Scenario,
  turns: Turn[],
  signal?: AbortSignal,
): Promise<RoleplayReply> {
  const transcript = turns.length
    ? turns.map((t) => `${t.who === "you" ? "LEARNER" : "YOU (character)"}: ${t.tr}`).join("\n")
    : "(The scene is just starting. Open the conversation yourself.)";

  const prompt = `You are a role-play partner in a Turkish practice app. The learner is dating a Turkish woman and wants to be able to talk with her family in everyday spoken Turkish.

${learnerContext(state)}

SCENE: ${scenario.title}
You play: ${scenario.character}
Setting: ${scenario.setting}
Learner's goal: ${scenario.goal}

How to play:
- Stay in character and speak natural, warm, everyday Turkish the way a real Turkish family member would, including common expressions (Afiyet olsun, Eline sağlık, Maşallah, Kolay gelsin) where they fit.
- Keep each reply short: 1 to 2 simple sentences at the learner's level. Ask one easy question to keep the conversation going.
- Use the formal "siz" when the learner addresses elders, and model that politely.
- If the learner writes in English or mixes languages, reply in Turkish anyway, and in "correction" show how to say what they meant in Turkish.
- Corrections are gentle: only correct real mistakes (grammar, vowel harmony, word choice, missing politeness). Ignore missing Turkish characters (s for ş, i for ı and so on) and capitalization. If the line was fine, set correction to null.
- "phrases": 0 to 2 useful phrases from YOUR reply worth adding to flashcards.
- "hint": a short example of something the learner could say next.

Conversation so far:
${transcript}

Reply with only this JSON object:
{"reply_tr": string, "reply_en": string, "correction": {"said": string, "better": string, "why": string} | null, "hint_tr": string, "hint_en": string, "phrases": [{"tr": string, "en": string}]}`;

  const r = await sample.json<RoleplayReply>(prompt, { cache: false, modelTier: "default", signal });
  return {
    reply_tr: String(r.reply_tr ?? ""),
    reply_en: String(r.reply_en ?? ""),
    correction:
      r.correction && r.correction.better
        ? { said: String(r.correction.said ?? ""), better: String(r.correction.better), why: String(r.correction.why ?? "") }
        : null,
    hint_tr: String(r.hint_tr ?? ""),
    hint_en: String(r.hint_en ?? ""),
    phrases: Array.isArray(r.phrases) ? r.phrases.filter((x) => x?.tr && x?.en).slice(0, 3) : [],
  };
}

/** How much new experience there is since the last dream. */
export function dreamMaterial(s: AppState): number {
  const since = s.profile.lastDream;
  return (
    s.log.mistakes.filter((m) => m.at > since).length +
    s.log.sessions.filter((x) => x.at > since).length * 3 +
    Math.floor(s.cards.filter((c) => c.reps > 0).length / 10)
  );
}

/**
 * Dreaming, after Lamis Mukta's "Learning while you sleep" talk: an out-of-band pass that
 * reads many past sessions plus the existing memory, looks for recurring patterns,
 * contradictions and stale entries, and PROPOSES changes backed by evidence and counts.
 * The current memory is not touched; the learner accepts or rejects each change.
 */
export async function dream(sample: Sample, s: AppState, signal?: AbortSignal): Promise<DreamProposal> {
  const since = s.profile.lastDream;
  const mistakes = s.log.mistakes.filter((m) => m.at > since).slice(-100);
  const sessions = s.log.sessions.filter((x) => x.at > since).slice(-12);
  const weak = weakest(s.cards, 20).map((c) => ({ tr: c.tr, en: c.en, misses: c.lapses, ease: +c.ease.toFixed(2) }));
  const strong = s.cards.filter((c) => c.reps >= 3 && c.lapses === 0).length;
  const existing = [...new Set(s.cards.map((c) => c.tr))].slice(-250);

  const transcripts = sessions
    .map((x) => `--- ${x.scenario} (${new Date(x.at).toISOString().slice(0, 10)})\n` + x.turns.map((t) => `${t.who === "you" ? "LEARNER" : "FAMILY"}: ${t.tr}`).join("\n"))
    .join("\n");

  const prompt = `You are the dreaming step of a Turkish learning app. While the learner is away, you review their recent practice sessions together with their long-term learner memory, and propose how that memory and their study material should change. Like sleep consolidating memory: find what keeps happening across sessions, which no single session can see.

The learner's goal: be able to talk and write with their Turkish girlfriend and her family (meals, small talk, visits, holidays, polite forms, family words). They practise in writing: typed flashcards, grammar drills (noun cases, verb tenses) and written role-play chats. They started from Duolingo.

CURRENT LEARNER MEMORY (each entry has an id):
${JSON.stringify(s.profile.memories.map((m) => ({ id: m.id, kind: m.kind, text: m.text, seen: m.seen })))}
Current level: ${s.profile.level}

ROLE-PLAY TRANSCRIPTS SINCE LAST DREAM:
${transcripts || "(none)"}

CORRECTIONS, MISSED FLASHCARDS AND GRAMMAR DRILL MISSES SINCE LAST DREAM (drill misses: "tr" is the word, "better" the right form, "said" what they typed, "why" the target):
${JSON.stringify(mistakes)}

WEAKEST FLASHCARDS: ${JSON.stringify(weak)}
GRAMMAR DRILL ACCURACY (all time): ${JSON.stringify(drillSummary(s.log.drill ?? {}))}
STATS: ${s.cards.length} cards, ${strong} solid, ${s.log.reviews} reviews in total.

What to do:
1. Memory changes. Look for recurring mistakes (a case suffix or tense and its vowel harmony, spelling with Turkish letters, siz vs sen, word order, a word they keep missing), new strengths, contradictions between entries, and stale entries (a weak spot that no longer shows up, or is now handled correctly in the transcripts). Propose:
   - "add" for a new pattern, only if it appears at least twice or is clearly important;
   - "update" (give the id) to merge, sharpen or correct an entry;
   - "remove" (give the id) for stale or contradicted entries.
   kinds: "weak" (recurring problem), "strength", "focus" (at most one: what to work on next), "fact" (stable facts about the learner useful for conversations, e.g. their job or hobbies, only if the learner said them).
   Every change needs "why", "count" (how many times you saw the pattern) and 1 to 3 "evidence" items quoted from the transcripts or corrections. Don't invent evidence. Keep each memory text short and specific. Propose nothing if nothing changed.
2. 5 to 8 new flashcards in natural everyday Turkish that drill the weak spots (the learner types the Turkish from the English, so keep each one short and unambiguous), each with a one-line "note" (the pattern it drills) and "why". Topic is one of: Greetings & politeness, At the table, Family, Small talk, Visits & holidays, Feelings & reactions, Food & drink, Home, People, Time, Verbs, Describing, Grammar patterns. Don't repeat existing cards: ${JSON.stringify(existing)}
3. 1 or 2 new role-play scenes with her family that would naturally make the learner practise the weak spots, with "why".
4. "note": 2 to 3 encouraging sentences to the learner in English, with one Turkish phrase, on what you noticed.
If there is very little data, keep memory changes minimal and base cards and scenes on sensible next steps for a beginner with this goal.

Reply with only this JSON object:
{"summary": string, "note": string, "level": string, "changes": [{"op": "add"|"update"|"remove", "id": string (for update/remove), "kind": string, "text": string, "why": string, "count": number, "evidence": string[]}], "cards": [{"tr": string, "en": string, "note": string, "topic": string, "why": string}], "scenarios": [{"title": string, "character": string, "setting": string, "goal": string, "why": string}]}`;

  type Raw = Omit<DreamProposal, "at" | "reviewed">;
  const r = await sample.json<Raw>(prompt, { cache: false, modelTier: "complex", signal });
  const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  const ids = new Set(s.profile.memories.map((m) => m.id));
  const kinds = ["weak", "strength", "focus", "fact"];
  const changes: MemoryChange[] = arr<MemoryChange>(r.changes)
    .filter((c) => c && ["add", "update", "remove"].includes(c.op))
    .filter((c) => c.op === "add" || (c.id && ids.has(String(c.id))))
    .map((c) => ({
      op: c.op,
      id: c.id ? String(c.id) : undefined,
      kind: (kinds.includes(String(c.kind)) ? c.kind : "weak") as Memory["kind"],
      text: String(c.text ?? "").slice(0, 200),
      why: String(c.why ?? ""),
      evidence: arr<string>(c.evidence).map(String).slice(0, 3),
      count: Number(c.count) || 1,
    }))
    .filter((c) => c.op === "remove" || c.text)
    .slice(0, 12);

  return {
    at: Date.now(),
    summary: String(r.summary ?? ""),
    note: String(r.note ?? ""),
    level: String(r.level || s.profile.level),
    reviewed: { sessions: sessions.length, mistakes: mistakes.length, cards: weak.length },
    changes,
    cards: arr<DreamProposal["cards"][number]>(r.cards)
      .filter((c) => c?.tr && c?.en)
      .map((c) => ({ tr: String(c.tr), en: String(c.en), note: String(c.note ?? ""), topic: String(c.topic ?? "Dream"), why: String(c.why ?? "") }))
      .slice(0, 10),
    scenarios: arr<DreamProposal["scenarios"][number]>(r.scenarios)
      .filter((c) => c?.title && c?.setting)
      .map((c) => ({ title: String(c.title), character: String(c.character ?? "A member of her family"), setting: String(c.setting), goal: String(c.goal ?? ""), why: String(c.why ?? "") }))
      .slice(0, 3),
  };
}

/** Apply the accepted parts of a proposal to memory, keeping a version for rollback. */
export function applyChanges(memories: Memory[], changes: MemoryChange[], now = Date.now()): Memory[] {
  let out = memories.map((m) => ({ ...m }));
  changes.forEach((c, i) => {
    if (c.op === "remove") out = out.filter((m) => m.id !== c.id);
    else if (c.op === "update") {
      const m = out.find((x) => x.id === c.id);
      if (m) Object.assign(m, { kind: c.kind, text: c.text, evidence: c.evidence, seen: m.seen + c.count, updated: now });
    } else {
      out.push({ id: `m${now.toString(36)}${i}`, kind: c.kind, text: c.text, evidence: c.evidence, seen: c.count, updated: now });
    }
  });
  // At most one focus: keep the newest.
  const foci = out.filter((m) => m.kind === "focus").sort((a, b) => b.updated - a.updated);
  return out.filter((m) => m.kind !== "focus" || m === foci[0]);
}
