# Am I friendzoned? 💔

Paste your DMs or drop in screenshots, and a meter tells you where you stand.

**Live: https://friendzone.vincenth19.com**

![The site: a worried candy heart under a meter that runs from Bae to Bro](docs/screenshot.png)

It's a joke site, but also a small, complete example of two things:

- **[Jev](https://docs.typesafe.ai/)** by TypeSafe AI, a model that returns typed answers with calibrated probabilities instead of text.
- **Reading chat screenshots** with a vision model on Cloudflare Workers AI.

Everything runs on one Cloudflare Worker.

## How it works

```
Browser ── POST /api/judge { text, images } ──▶ Worker (worker/index.ts)
                                                  │
                  screenshots? ───────────────────┼──▶ Workers AI (Gemma 4) ──▶ "Me: …" / "Them: …" transcript
                                                  │
                                                  └──▶ Jev, one Score question ──▶ { score, confidence }
Browser ◀─────────────── { score, confidence } ───┘
```

1. **Read the screenshots.** Jev only accepts text, so screenshots are transcribed first. Plain OCR (like Tesseract) gets the words but not who said them, and that is the whole question. A vision model can follow the chat-app convention: bubbles on the right are yours (`Me:`), bubbles on the left are theirs (`Them:`).
2. **Ask Jev.** The transcript becomes Jev's `state`, and the Worker asks one Score question about it.
3. **Show the verdict.** The page turns the score into the needle position and uses the confidence to pick the character.

## The Jev part

### Why a Score question

Jev has three question types:

| Type | Answers | Example |
| --- | --- | --- |
| Choice | Which option from a set | "Which team handles this ticket?" |
| Noul | Probability the answer is yes | "Does this message sound urgent?" |
| Score | Position on an ordered scale | "How friendzoned is this?" |

Being friendzoned is a scale with in-betweens, so it's a Score. The answer can land between two levels, and that number drives the needle directly.

### The question

```ts
jev.systemOne({
  state: {
    conversation, // "Me: …\nThem: …"
    roles: "Me is the person asking. Them is the person Me has a crush on.",
  },
  questions: {
    friendzone: score("Based on how Them talks to Me, how does Them see Me?", [
      "Them flirts with Me or shows clear romantic interest: compliments on looks, pet names, asking Me out or for time alone",
      "Them is warm and playful with Me and curious about Me, with some hints of romantic interest",
      "Them is friendly and polite with Me, with no romantic signals either way",
      "Them treats Me as a friend: platonic plans, calls Me buddy or bestie, talks about crushes on other people",
      "Them says they only see Me as a friend or sibling, turns Me down, or is dating someone else",
    ]),
  },
});
```

The five strings are levels 0 to 4. Three things make them work:

- **Describe situations, not degrees.** Jev checks each level against the chat on its own, without seeing its number or the levels around it. "Calls Me buddy or bestie" is something it can match against. "Somewhat friendzoned" isn't.
- **Name the people.** Jev reads literally. Using `Me` and `Them` in the `roles` field and in every level leaves no doubt about whose feelings are being rated.
- **Send the state as an object.** Named fields (`conversation`, `roles`) keep the chat separate from the context about it.

### What comes back

This is the real response for "can I bring my girlfriend? you're like a brother to me fr":

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "friendzone": {
      "type": "score",
      "score": 3.98,
      "confidence": 0.98,
      "probabilities": { "0": 0.0, "1": 0.0, "2": 0.0, "3": 0.02, "4": 0.98 },
      "legend": { "0": "Them flirts with Me…", "4": "Them says they only see Me as a friend…" }
    }
  },
  "usage": { "input_tokens": 475, "output_tokens": 19 }
}
```

(`legend` is shortened here. It echoes all five levels.)

- **`probabilities`**: how likely each level is. They add up to 1.
- **`score`**: the average level, weighted by those probabilities: 3 × 0.02 + 4 × 0.98 = 3.98. The page shows `score / 4` as a percentage, so this is "100% friendzoned".
- **`confidence`**: from 0 to 1, how concentrated the probabilities are. All the weight on one level means high confidence; weight spread across levels means low.

### Confidence decides the tombstone

The score says *how* friendzoned; confidence says *how sure* Jev is. The page shows the tombstone only when the score is high and Jev is sure about it ([src/main.tsx](src/main.tsx)):

```ts
const friendzoned = verdict.score >= 2.5 && verdict.confidence >= 0.5;
```

Everything else gets the happy heart, so mixed signals get the benefit of the doubt. Some real results:

| What Them said | score | confidence | Result |
| --- | --- | --- | --- |
| "omg yes!! I've been wanting to ask you the same thing 😳 you looked so good today btw" | 0.00 | 1.00 | happy |
| "me too :) we should hang out again sometime" | 1.73 | 0.76 | happy |
| "aww thank you!! ur the best, love you lots 💕 we need to catch up soon bestie" | 2.84 | 0.86 | tombstone |
| "can I bring my girlfriend? you're like a brother to me fr" | 3.98 | 0.98 | tombstone |

In the "hang out again" row, Jev put 0.72 on level 2 (friendly, no signals) and 0.27 on level 1 (hints of interest). That split is why the score falls between the two levels and confidence is lower.

## The OCR part

- **Model:** `@cf/google/gemma-4-26b-a4b-it` on Workers AI, through the Worker's `AI` binding, so there's no extra API key.
- **One request for all screenshots** (up to 5), so the transcript stays in order.
- **Thinking is turned off** with `chat_template_kwargs: { enable_thinking: false }`. With it on, Gemma wrote about 500 tokens of reasoning before the transcript: 45 seconds and 18 neurons per screenshot. With it off: about 8 seconds and 5 neurons, with the same transcript.

## What it costs

| Part | Cost per check |
| --- | --- |
| Jev | About 475 input tokens at $0.042 per million, so roughly $0.00002. Output tokens are free. |
| Gemma OCR | About 5 neurons per screenshot. Workers AI includes 10,000 free neurons a day (about 400 checks with 5 screenshots each), then $0.011 per 1,000 neurons. |
| Worker and static files | Covered by Cloudflare's free tier or the $5 Workers plan. |

## Run it yourself

You need [Bun](https://bun.sh), a Cloudflare account, and a TypeSafe API key from [console.typesafe.ai](https://console.typesafe.ai/keys).

```bash
bun install
echo "TYPESAFE_AI_API_KEY=your-key" > .env
bunx wrangler login
bun dev
```

`bun dev` runs the React app and the Worker together at http://localhost:5173, using `@cloudflare/vite-plugin`. Workers AI always runs on Cloudflare's servers, even in local dev, so you have to be logged in to Wrangler.

To deploy, first change or remove `routes` in [wrangler.jsonc](wrangler.jsonc), which points at `friendzone.vincenth19.com`. Without it you get a `*.workers.dev` URL. Then:

```bash
bun run deploy
bunx wrangler secret put TYPESAFE_AI_API_KEY
```

## Files

| File | What it does |
| --- | --- |
| [worker/index.ts](worker/index.ts) | The API: OCR with Gemma, then the Jev question |
| [src/main.tsx](src/main.tsx) | The page: form, verdict captions, tombstone rule |
| [src/Stage.tsx](src/Stage.tsx) | The gauge: meter, needle, heart and tombstone, drawn in SVG and animated with Motion |
| [src/index.css](src/index.css) | Tailwind theme, based on the colours of candy conversation hearts |
| [wrangler.jsonc](wrangler.jsonc) | Worker config: static files, AI binding, custom domain |

Built with React 19, Tailwind CSS 4, Motion, Vite, Cloudflare Workers and [`@typesafe-ai/sdk`](https://www.npmjs.com/package/@typesafe-ai/sdk).

Privacy: the Worker doesn't store anything. Your text and screenshots are sent to Cloudflare Workers AI and TypeSafe to be processed.
