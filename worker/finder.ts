import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk";
import type { Env } from "./index";

// A Choice accepts up to 255 options, so longer documents are searched in chunks, all at once.
const CHUNK = 250;
const MAX_LINES = 2000;
// Tuned on a sample paper: answered questions read >= 0.95 and unanswered ones <= 0.05.
const FOUND = 0.5;
const HIT = 0.15;

// Jev's line-search pattern: tag every line with an id, ask a Choice for "which line answers this?"
// and a Noul for "does any line answer it?". The line ids Jev returns are the citations.
async function searchChunk(jev: TypeSafeClient, lines: string[], start: number, question: string) {
  const ids = lines.map((_, i) => `L${start + i}`);
  const { answers } = await jev.systemOne({
    state: ids.map((id, i) => `${id}| ${lines[i]}`).join("\n"),
    questions: {
      where: choice(
        `Which line of the document contains the answer to: "${question}"?`,
        Object.fromEntries(ids.map((id) => [id, null])),
      ),
      exists: noul(`Does any line of the document address or answer: "${question}"?`, {
        true: "At least one line of the document states or directly implies the answer",
        false: "No line of the document addresses this",
      }),
    },
  });
  return { exists: answers.exists.noul, probabilities: answers.where.probabilities };
}

export async function find(req: Request, env: Env) {
  const { lines, question } = (await req.json()) as { lines: string[]; question: string };
  const jev = new TypeSafeClient({ apiKey: env.TYPESAFE_AI_API_KEY });
  const starts = Array.from({ length: Math.ceil(Math.min(lines.length, MAX_LINES) / CHUNK) }, (_, i) => i * CHUNK);
  const chunks = await Promise.all(
    starts.map((start) => searchChunk(jev, lines.slice(start, start + CHUNK), start, question.slice(0, 500))),
  );
  // Choice probabilities add up to 1 in every chunk, so only trust chunks whose Noul says the answer is there.
  const hits = chunks
    .filter((chunk) => chunk.exists >= FOUND)
    .flatMap((chunk) => Object.entries(chunk.probabilities))
    .filter(([, p]) => p >= HIT)
    .map(([id, p]) => ({ line: Number(id.slice(1)), p }))
    .sort((a, b) => b.p - a.p);
  return Response.json({ exists: Math.max(...chunks.map((chunk) => chunk.exists)), hits });
}
