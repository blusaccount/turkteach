// A small SM-2 style scheduler. Intervals are in days; `due` is epoch ms (0 = new card).

export type Grade = 0 | 1 | 2 | 3; // again, hard, good, easy

export interface Card {
  id: string;
  tr: string;
  en: string;
  note?: string;
  topic: string;
  source: "starter" | "roleplay" | "dream";
  due: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  added: number;
}

const DAY = 86_400_000;
const MIN = 60_000;

export function newCard(
  fields: Pick<Card, "id" | "tr" | "en" | "topic" | "source"> & { note?: string },
  now = Date.now(),
): Card {
  return { ...fields, due: 0, interval: 0, ease: 2.5, reps: 0, lapses: 0, added: now };
}

export function schedule(card: Card, grade: Grade, now = Date.now()): Card {
  const c = { ...card };
  if (grade === 0) {
    c.reps = 0;
    c.lapses += 1;
    c.interval = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now + 10 * MIN;
    return c;
  }
  if (c.reps === 0) {
    c.interval = grade === 3 ? 3 : 1;
  } else if (c.reps === 1) {
    c.interval = grade === 1 ? 2 : grade === 2 ? 3 : 5;
  } else {
    const factor = grade === 1 ? 1.2 : grade === 2 ? c.ease : c.ease * 1.3;
    c.interval = Math.max(c.interval + 1, Math.round(c.interval * factor));
  }
  if (grade === 1) c.ease = Math.max(1.3, c.ease - 0.15);
  if (grade === 3) c.ease = c.ease + 0.15;
  c.reps += 1;
  c.due = now + c.interval * DAY;
  return c;
}

/** Cards to study now: everything due, plus up to `newLimit` new cards. */
export function queue(cards: Card[], now = Date.now(), newLimit = 10): Card[] {
  const due = cards.filter((c) => c.due !== 0 && c.due <= now).sort((a, b) => a.due - b.due);
  const fresh = cards
    .filter((c) => c.due === 0)
    .sort((a, b) => sourceRank(a) - sourceRank(b) || a.added - b.added)
    .slice(0, newLimit);
  return [...due, ...fresh];
}

// Cards Claude wrote for you (dreams, role-plays) come before the generic starter deck.
function sourceRank(c: Card): number {
  return c.source === "dream" ? 0 : c.source === "roleplay" ? 1 : 2;
}

/** The cards you struggle with most, for Claude to look at while dreaming. */
export function weakest(cards: Card[], n = 15): Card[] {
  return cards
    .filter((c) => c.reps > 0 || c.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
    .slice(0, n);
}

export function cardId(tr: string): string {
  return tr
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9çğıöşü]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
