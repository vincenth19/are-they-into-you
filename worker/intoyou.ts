import { TypeSafeClient, noul, score } from "@typesafe-ai/sdk";
import type { Env } from "./index";

const MAX_SHOTS = 5;

const OCR_PROMPT = `Transcribe the chat messages in these screenshots, in order.
Messages on the right side were sent by the person who took the screenshot: start those lines with "Me:".
Messages on the left side: start those lines with "Them:".
One message per line. Keep emoji. Skip timestamps, names, read receipts and app buttons. Output only the transcript.`;

// Level 0 is "cooked", level 4 is "down bad". src/intoyou/main.tsx has one caption per level, in this order.
const LEVELS = [
  "Them gives dry one-word replies, ignores Me's questions, or turns Me down",
  "Them replies politely but briefly, rarely asks Me anything, and doesn't build on the conversation",
  "Them is friendly and engaged with Me, with no romantic signals either way",
  "Them puts effort into talking to Me: long replies, asks Me questions, playful emoji, keeps the chat going",
  "Them flirts with Me, compliments Me, suggests plans or time alone, or says they like Me",
] as const;

async function transcribe(env: Env, images: string[]) {
  const content = [
    { type: "text", text: OCR_PROMPT },
    ...images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];
  // Thinking adds ~500 tokens and ~35s for no gain on plain transcription.
  const res = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
    messages: [{ role: "user", content }],
    chat_template_kwargs: { enable_thinking: false },
  });
  return res.choices[0].message.content;
}

export async function judge(req: Request, env: Env) {
  const { text, images } = (await req.json()) as { text: string; images: string[] };
  const conversation = [text.trim(), images.length ? await transcribe(env, images.slice(0, MAX_SHOTS)) : ""]
    .filter(Boolean)
    .join("\n");

  const jev = new TypeSafeClient({ apiKey: env.TYPESAFE_AI_API_KEY });
  const { answers } = await jev.systemOne({
    state: { conversation, roles: "Me is the person asking. Them is the person Me is texting." },
    questions: {
      interest: score("Based on how Them texts Me, how interested is Them in Me?", LEVELS),
      friendzoned: noul("Them says they only see Me as a friend or family, or that they are dating someone else"),
    },
  });
  // A Score should measure one thing, so "friend only" is its own yes/no question. It outranks effort:
  // a warm "you're like a brother to me" is still a no.
  const { interest, friendzoned } = answers;
  return Response.json(
    friendzoned.noul >= 0.5
      ? { score: 0, confidence: friendzoned.noul, friendzoned: true }
      : { score: interest.score, confidence: interest.confidence, friendzoned: false },
  );
}
