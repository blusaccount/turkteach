// Persistence. In claude.ai the data lives in the artifact's private per-person store
// (data/users/<you>/...), so it follows you across devices. Elsewhere it falls back to
// localStorage. Three documents: your deck, your learner profile, and your activity log.

import type { Card } from "./srs";
import type { Platform } from "./platform";

export interface Mistake {
  at: number;
  kind: "correction" | "review-miss" | "drill-miss";
  said?: string;
  better?: string;
  why?: string;
  tr?: string;
  en?: string;
}

export interface Session {
  at: number;
  scenario: string;
  turns: { who: "you" | "them"; tr: string }[];
}

export interface Scenario {
  id: string;
  title: string;
  character: string;
  setting: string;
  goal: string;
  source: "starter" | "dream";
}

/** One entry in the learner's long-term memory, curated by dreaming. */
export interface Memory {
  id: string;
  kind: "weak" | "strength" | "focus" | "fact";
  text: string;
  evidence: string[];
  seen: number;
  updated: number;
}

export interface MemoryChange {
  op: "add" | "update" | "remove";
  id?: string;
  kind: Memory["kind"];
  text: string;
  why: string;
  evidence: string[];
  count: number;
}

/** What a dream proposes. Nothing changes until the learner reviews it. */
export interface DreamProposal {
  at: number;
  summary: string;
  note: string;
  level: string;
  reviewed: { sessions: number; mistakes: number; cards: number };
  changes: MemoryChange[];
  cards: { tr: string; en: string; note: string; topic: string; why: string }[];
  scenarios: { title: string; character: string; setting: string; goal: string; why: string }[];
}

export interface DreamRecord {
  at: number;
  summary: string;
  note: string;
  accepted: number;
  rejected: number;
}

export interface MemoryVersion {
  at: number;
  reason: string;
  level: string;
  memories: Memory[];
}

export interface Profile {
  learnerName: string;
  partnerName: string;
  level: string;
  memories: Memory[];
  scenarios: Scenario[];
  pending: DreamProposal | null;
  dreams: DreamRecord[];
  history: MemoryVersion[];
  lastDream: number;
  autoDream: boolean;
}

export interface Log {
  mistakes: Mistake[];
  sessions: Session[];
  reviews: number;
  drill: Record<string, { right: number; wrong: number }>;
}

export interface AppState {
  cards: Card[];
  profile: Profile;
  log: Log;
}

export const emptyProfile = (): Profile => ({
  learnerName: "",
  partnerName: "",
  level: "Early beginner (A1), has used Duolingo",
  memories: [],
  scenarios: [],
  pending: null,
  dreams: [],
  history: [],
  lastDream: 0,
  autoDream: false,
});

export const emptyLog = (): Log => ({ mistakes: [], sessions: [], reviews: 0, drill: {} });

type DocName = "deck" | "profile" | "log";

export interface Store {
  remote: boolean;
  load(): Promise<Partial<{ deck: { cards: Card[] }; profile: Profile; log: Log }>>;
  save(name: DocName, data: object): void;
}

const LS_PREFIX = "turkteach:";

function localStore(): Store {
  return {
    remote: false,
    async load() {
      const out: Record<string, unknown> = {};
      for (const n of ["deck", "profile", "log"]) {
        try {
          const raw = localStorage.getItem(LS_PREFIX + n);
          if (raw) out[n] = JSON.parse(raw);
        } catch {
          /* storage unavailable */
        }
      }
      return out;
    },
    save(name, data) {
      try {
        localStorage.setItem(LS_PREFIX + name, JSON.stringify(data));
      } catch {
        /* storage unavailable */
      }
    },
  };
}

function remoteStore(db: Platform["db"], uid: string): Store {
  const col = db.collection(`data/users/${uid}`);
  // One write in flight per document; later saves replace a pending one.
  const pending = new Map<DocName, object>();
  const inflight = new Set<DocName>();
  const timers = new Map<DocName, number>();

  async function flush(name: DocName) {
    if (inflight.has(name)) return;
    const data = pending.get(name);
    if (!data) return;
    pending.delete(name);
    inflight.add(name);
    try {
      await col.doc(name).set(data as Record<string, unknown>);
    } catch (e) {
      console.warn("save failed", name, e);
    } finally {
      inflight.delete(name);
      if (pending.has(name)) flush(name);
    }
  }

  return {
    remote: true,
    async load() {
      const out: Record<string, unknown> = {};
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 10_000));
      await Promise.race([
        Promise.all(
          (["deck", "profile", "log"] as DocName[]).map(async (n) => {
            const snap = await col.doc(n).get();
            if (snap.exists) out[n] = snap.data();
          }),
        ),
        timeout,
      ]);
      return out;
    },
    save(name, data) {
      pending.set(name, JSON.parse(JSON.stringify(data)));
      clearTimeout(timers.get(name));
      timers.set(name, window.setTimeout(() => flush(name), 800));
    },
  };
}

export async function openStore(p: Platform): Promise<Store> {
  if (p.db && p.user) {
    try {
      const uid = await p.user.id();
      if (uid) return remoteStore(p.db, uid);
    } catch {
      /* fall through */
    }
  }
  return localStore();
}

/** Keep the log bounded so documents stay well under the store's size cap. */
export function trimLog(log: Log): Log {
  return {
    mistakes: log.mistakes.slice(-300),
    sessions: log.sessions.slice(-30).map((x) => ({ ...x, turns: x.turns.slice(-40) })),
    reviews: log.reviews,
    drill: log.drill,
  };
}
