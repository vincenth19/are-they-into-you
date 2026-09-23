import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { Gauge } from "./Stage";
import "./index.css";

type Verdict = { score: number; confidence: number };

const MAX_SHOTS = 5;
// One caption per Jev score level, in the same order as LEVELS in worker/index.ts.
const CAPTIONS = [
  "They're into you. Stop overthinking and ask them out.",
  "There's a spark. Small, but it's there.",
  "Could go either way. Schrödinger's crush.",
  "Friendzone detected. They like you… as a friend.",
  "They'd help you move apartments. That's the whole relationship.",
];

const readAsDataURL = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

function App() {
  const [text, setText] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Jev's score says how friendzoned; its confidence says how sure. A high score it isn't sure about doesn't earn a tombstone.
  const friendzoned = verdict && verdict.score >= 2.5 && verdict.confidence >= 0.5;
  const mood = !verdict ? "worried" : friendzoned ? "dead" : "happy";

  async function addShots(files: FileList) {
    const images = [...files].filter((file) => file.type.startsWith("image/"));
    const urls = await Promise.all(images.map(readAsDataURL));
    setShots((prev) => [...prev, ...urls].slice(0, MAX_SHOTS));
  }

  async function check(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setVerdict(null);
    setError("");
    try {
      const [res] = await Promise.all([
        fetch("/api/judge", { method: "POST", body: JSON.stringify({ text, images: shots }) }),
        new Promise((resolve) => setTimeout(resolve, 2500)), // let the suspense build
      ]);
      if (!res.ok) throw new Error();
      setVerdict(await res.json());
    } catch {
      setError("Couldn't get a verdict. Check your connection and try again.");
    }
    setLoading(false);
  }

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col gap-4 px-4 py-6 short:gap-2 short:py-3 md:grid md:max-w-4xl md:grid-cols-2 md:content-center md:gap-x-16">
      <header className="text-center md:text-left">
        <h1 className="font-display text-5xl leading-none text-stamp short:text-4xl md:text-6xl">Am I friendzoned?</h1>
        <p className="mt-3 text-balance md:text-lg">
          <span className="block">Paste your DMs or drop in screenshots.</span>
          <span className="block">We'll break it to you gently.</span>
        </p>
      </header>

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center md:col-start-2 md:row-span-2 md:row-start-1">
        <Gauge mood={mood} score={verdict?.score ?? null} loading={loading} />
        <div aria-live="polite" className="min-h-24 text-balance">
          {verdict ? (
            <>
              <p className="font-display text-3xl text-stamp md:text-4xl">{Math.round(verdict.score * 25)}% friendzoned</p>
              <p className="mt-1 md:text-lg">
                {verdict.confidence < 0.5
                  ? "Mixed signals. We can't call it, so we're calling it a win."
                  : CAPTIONS[Math.round(verdict.score)]}
              </p>
              <p className="text-sm text-plum/60">{Math.round(verdict.confidence * 100)}% sure</p>
            </>
          ) : (
            <p className={`md:text-lg ${error ? "text-stamp" : ""}`}>
              {loading ? "Reading the vibes…" : error || "Show me the DMs. I can take it."}
            </p>
          )}
        </div>
      </section>

      <form
        onSubmit={check}
        onPaste={(e) => addShots(e.clipboardData.files)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addShots(e.dataTransfer.files);
        }}
        className="flex flex-col gap-3"
      >
        <div className="rounded-3xl border-2 border-plum/15 bg-white/70 focus-within:border-stamp">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={8000}
            aria-label="Your DMs"
            placeholder={"Me: wanna grab food friday?\nThem: omg yes!! can I bring my boyfriend? 🥰"}
            className="block w-full resize-none bg-transparent px-4 pt-3 short:h-16 placeholder:text-plum/40 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 px-3 pt-1 pb-3">
            {shots.map((src, i) => (
              <div key={src} className="relative">
                <img src={src} alt={`Screenshot ${i + 1}`} className="size-9 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setShots(shots.filter((_, j) => j !== i))}
                  aria-label={`Remove screenshot ${i + 1}`}
                  className="absolute -top-2 -right-2 size-5 rounded-full bg-plum text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
            {shots.length < MAX_SHOTS && (
              <label className="cursor-pointer rounded-full bg-lilac px-3 py-1.5 text-sm font-medium focus-within:outline-2 focus-within:outline-stamp hover:bg-heart">
                Add screenshots ({shots.length}/{MAX_SHOTS})
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => e.target.files && addShots(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>
        <button
          disabled={loading || (!text.trim() && !shots.length)}
          className="mt-1 rounded-full bg-stamp py-3.5 font-display text-2xl text-white shadow-[0_6px_0_#8f1016] transition-transform focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-stamp active:translate-y-1.5 active:shadow-none disabled:opacity-50"
        >
          {loading ? "Checking…" : "Check my chances"}
        </button>
        <p className="text-center text-sm text-plum/60">We don't save your DMs.</p>
      </form>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
