// Access to claude.ai artifact capabilities. Each one resolves to null when the page
// runs outside claude.ai (e.g. `npm run dev`), and the app degrades gracefully.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export interface Sample {
  (input: string | { role: "user" | "assistant"; content: string }[], opts?: Any): Promise<{ text: string }>;
  json<T>(input: string | { role: "user" | "assistant"; content: string }[], opts?: Any): Promise<T>;
}

export interface Platform {
  sample: Sample | null;
  db: Any | null;
  user: Any | null;
  tts: Any | null;
  dictation: Any | null;
}

function use(name: string): Promise<Any | null> {
  const claude = (window as Any).claude;
  if (!claude?.use) return Promise.resolve(null);
  return claude.use(name).catch(() => null);
}

export async function loadPlatform(): Promise<Platform> {
  const [sample, db, user, tts, dictation] = await Promise.all(
    ["sample", "db", "user", "tts", "dictation"].map(use),
  );
  return { sample, db, user, tts, dictation };
}

export function errorText(e: unknown): string {
  const code = (e as Any)?.code as string | undefined;
  switch (code) {
    case "not_granted":
      return "Claude access was declined for this page. You can allow it from the artifact's Permissions menu.";
    case "rate_limited":
      return "You've hit your Claude usage limit for now. Try again a little later.";
    case "prompt_too_large":
      return "That was too much text for one request.";
    case "invalid_json":
    case "empty_completion":
      return "Claude's answer came back garbled. Please try again.";
    case "cancelled":
      return "Stopped.";
    default:
      return (e as Any)?.message ?? "Something went wrong talking to Claude. Please try again.";
  }
}
