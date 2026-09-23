import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { Gauge, Marquee } from "./Stage";
import "./index.css";

type Verdict = { score: number; confidence: number; friendzoned: boolean };

const MAX_SHOTS = 5;
// One caption per Jev score level, in the same order as LEVELS in worker/index.ts.
const CAPTIONS = [
  "You're cooked. Delete the drafts and touch grass.",
  "Dry replies. They're being polite, not interested.",
  "Friendly, no signals yet. Keep it chill.",
  "They're putting in effort. Keep the chat going.",
  "They're down bad. Ask them out already.",
];
// The whole page changes colour with the verdict.
const BACKGROUND = { worried: "bg-cherry", happy: "bg-hotpink", dead: "bg-ash" };

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

  // Jev's score says how into you they are; its confidence says how sure. A low score it isn't sure about doesn't earn a tombstone.
  const cooked = verdict && verdict.score <= 1.5 && verdict.confidence >= 0.5;
  const mood = !verdict ? "worried" : cooked ? "dead" : "happy";

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
    <div className={`flex h-dvh flex-col transition-colors duration-700 ${BACKGROUND[mood]}`}>
      <Marquee />
      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-4 px-4 py-5 short:gap-2 short:py-3 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:content-center lg:gap-x-16">
        <header className="text-center lg:text-left">
          <h1 className="font-display text-5xl leading-none text-balance extrude short:text-4xl lg:text-7xl">Are they into you?</h1>
          <p className="mt-4 text-balance lg:text-lg">
            <span className="block">Paste your DMs or drop in screenshots.</span>
            <span className="block">We'll break it to you gently.</span>
          </p>
        </header>

        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Gauge mood={mood} score={verdict?.score ?? null} loading={loading} />
          <div aria-live="polite" className="min-h-24 text-balance">
            {verdict ? (
              <>
                <p className="font-display text-4xl extrude lg:text-5xl">
                  {verdict.friendzoned ? "Friendzoned" : `${Math.round(verdict.score * 25)}% into you`}
                </p>
                <p className="mt-2 lg:text-lg">
                  {verdict.friendzoned
                    ? "They said the F-word: friend. You're cooked."
                    : verdict.confidence < 0.5
                    ? "Mixed signals. We can't call it, so we're calling it a win."
                    : CAPTIONS[Math.round(verdict.score)]}
                </p>
                <p className="text-sm text-cream/70">{Math.round(verdict.confidence * 100)}% sure</p>
              </>
            ) : (
              <p className={`lg:text-lg ${error ? "text-lemon" : ""}`}>
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
          className="flex flex-col gap-4"
        >
          <div className="rounded-3xl border-2 border-plum bg-cream text-plum shadow-[0_6px_0_var(--color-plum)] focus-within:outline-4 focus-within:outline-offset-2 focus-within:outline-lemon">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={8000}
              aria-label="Your DMs"
              placeholder={"Me: wanna grab food friday?\nThem: omg yes!! what time? 🥰"}
              className="block w-full resize-none bg-transparent px-4 pt-3 placeholder:text-plum/40 focus:outline-none short:h-16"
            />
            <div className="flex flex-wrap items-center gap-2 px-3 pt-1 pb-3">
              {shots.map((src, i) => (
                <div key={src} className="relative">
                  <img src={src} alt={`Screenshot ${i + 1}`} className="size-9 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setShots(shots.filter((_, j) => j !== i))}
                    aria-label={`Remove screenshot ${i + 1}`}
                    className="absolute -top-2 -right-2 size-5 rounded-full bg-plum text-xs text-cream"
                  >
                    ×
                  </button>
                </div>
              ))}
              {shots.length < MAX_SHOTS && (
                <label className="cursor-pointer rounded-full bg-heart px-3 py-1.5 text-sm font-medium focus-within:outline-2 focus-within:outline-plum hover:bg-lemon">
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
            className="rounded-full border-2 border-plum bg-lemon py-3.5 font-display text-2xl text-plum shadow-[0_6px_0_var(--color-plum)] transition-transform focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-cream active:translate-y-1.5 active:shadow-none disabled:bg-cream disabled:text-plum/50"
          >
            {loading ? "Checking…" : "Check the vibe"}
          </button>
          <p className="text-center text-sm text-cream/80">We don't save your DMs.</p>
        </form>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
