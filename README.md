# Öğretmen

A small app for learning the everyday, spoken Turkish you need with a Turkish partner's family: meals at the parents', small talk with her dad, Bayram visits, polite forms and family words.

It runs as a **claude.ai artifact**, so the Claude features use your normal Claude subscription. There's no API key and no server.

**Open it:** https://claude.ai/artifact/BZzcfgC44qiHaTGFro4Hdt

## What's in it

Everything is written practice: you type the Turkish.

| Tab | What it does |
| --- | --- |
| **Home** | Review count, progress ring, and shortcuts to Drill, Chat and Dream. |
| **Review** | Spaced-repetition flashcards (SM-2 style). You see the English and type the Turkish. Missing Turkish letters count as "almost"; a row of ç ğ ı İ ö ş ü buttons helps without a Turkish keyboard. Flip-card mode is one tap away. |
| **Drill** | Grammar drills, typed: noun cases (plural, in/at, from, to, the, of, my, with) on everyday nouns, and verb tenses (present -iyor, negative, past -di, future -ecek) for all six persons. Rounds of 10; forms you get wrong come up more often. The suffix explorer shows every form of a noun and the rule behind it. |
| **Chat** | Written role-play with Claude as a member of her family (first dinner, tea with her dad, Bayram at grandma's, …). Gentle corrections under your lines, an idea for what to write next, one tap to save phrases. |
| **Words** | About 220 cards: family phrases with cultural notes, plus vocabulary for food, home, people, time, numbers, verbs, adjectives and question words. Add your own. |

## Dreaming

Based on Lamis Mukta's talk *Learning while you sleep: beyond memory to dreaming* (AI Native DevCon, June 2026), adapted from agents to a learner:

- **In-session notes stay small.** While you practise, the app only records what happened: corrections from chats, flashcards you missed, grammar drill misses and accuracy, and chat transcripts.
- **Dreaming is a separate pass.** On demand, or once a day by itself if you turn that on, Claude reads across recent conversations, corrections and your weakest cards together with its current memory of you. It looks for things no single session shows: recurring mistakes, new strengths, entries that contradict each other, and weak spots that have stopped showing up.
- **It proposes and you decide.** A dream proposes memory changes (new, update, forget), each with the reason, how often it saw the pattern and quoted evidence, plus new flashcards and new role-play scenes aimed at your weak spots. Nothing changes until you apply it, and you can untick any item.
- **Memory is versioned.** Every applied dream saves the previous memory, and you can restore any earlier version.
- **Memory feeds back into practice.** Role-play characters steer the conversation toward your weak spots, and dream cards come up first in reviews.

## Where your data lives

In claude.ai, everything is stored in the artifact's private per-person store (`data/users/<you>/`), so it follows you across devices and nobody else who opens the artifact can see it. Run locally, it falls back to `localStorage` and the Claude features are switched off.

## Develop

```sh
npm install
npm run dev      # local preview (Claude features off outside claude.ai)
npm test         # suffix and verb rules, answer checking, scheduler, dream memory changes
npm run build    # writes dist/artifact.html, the single page that gets published
```

To publish a new version, build and publish `dist/artifact.html` as an artifact with these capabilities: `sample` (asks Claude on your plan), and `db` and `user` (your saved progress). In Claude Code you can just ask Claude to "publish dist/artifact.html to the Öğretmen artifact".

## Code map

- `src/phrases.ts` starter deck
- `src/srs.ts` spaced-repetition scheduler
- `src/suffix.ts` vowel harmony and noun suffix rules
- `src/verbs.ts` verb tenses
- `src/drill.ts` typed-answer checking and drill generation
- `src/ai.ts` role-play and dreaming prompts, and applying accepted memory changes
- `src/store.ts` persistence (artifact store or localStorage)
- `src/main.ts` the UI
- `scripts/build-artifact.mjs` inlines the build into one page
