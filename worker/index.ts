import { TypeSafeClient, score } from "@typesafe-ai/sdk";

interface Env {
  AI: { run(model: string, input: object): Promise<{ choices: { message: { content: string } }[] }> };
  TYPESAFE_AI_API_KEY: string;
}

const MAX_SHOTS = 5;

const OCR_PROMPT = `Transcribe the chat messages in these screenshots, in order.
Messages on the right side were sent by the person who took the screenshot: start those lines with "Me:".
Messages on the left side: start those lines with "Them:".
One message per line. Keep emoji. Skip timestamps, names, read receipts and app buttons. Output only the transcript.`;

// Level 0 is "into you", level 4 is fully friendzoned. src/main.tsx has one caption per level, in this order.
const LEVELS = [
  "Them flirts with Me or shows clear romantic interest: compliments on looks, pet names, asking Me out or for time alone",
  "Them is warm and playful with Me and curious about Me, with some hints of romantic interest",
  "Them is friendly and polite with Me, with no romantic signals either way",
  "Them treats Me as a friend: platonic plans, calls Me buddy or bestie, talks about crushes on other people",
  "Them says they only see Me as a friend or sibling, turns Me down, or is dating someone else",
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

export default {
  async fetch(req: Request, env: Env) {
    if (req.method !== "POST") return new Response("Not found", { status: 404 });
    const { text, images } = (await req.json()) as { text: string; images: string[] };
    const conversation = [text.trim(), images.length ? await transcribe(env, images.slice(0, MAX_SHOTS)) : ""]
      .filter(Boolean)
      .join("\n");

    const jev = new TypeSafeClient({ apiKey: env.TYPESAFE_AI_API_KEY });
    const { answers } = await jev.systemOne({
      state: { conversation, roles: "Me is the person asking. Them is the person Me has a crush on." },
      questions: { friendzone: score("Based on how Them talks to Me, how does Them see Me?", LEVELS) },
    });
    return Response.json({ score: answers.friendzone.score, confidence: answers.friendzone.confidence });
  },
};
