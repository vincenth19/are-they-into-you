import { StrictMode, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { locate, openPdf, type Line, type Page } from "./pdf";
import "./index.css";

type Hit = { line: number; p: number };
type Question = { text: string; loading: boolean; error?: boolean; exists?: number; hits: Hit[] };
type Doc = { name: string; lines: Line[]; pages: Page[] };

// One colour per question, used for its highlights and its number badge.
const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444"];
const color = (q: number) => COLORS[q % COLORS.length];
const key = (q: number, line: number) => `${q}-${line}`;

function PageView({ page, children }: { page: Page; children: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ratio = window.devicePixelRatio || 1;
    const el = canvas.current!;
    el.width = page.viewport.width * ratio;
    el.height = page.viewport.height * ratio;
    const task = page.proxy.render({ canvas: el, viewport: page.viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
    return () => task.cancel();
  }, [page]);
  return (
    <div className="relative mx-auto bg-white shadow" style={{ width: page.viewport.width, height: page.viewport.height }}>
      <canvas ref={canvas} className="size-full" />
      {children}
    </div>
  );
}

function App() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [opening, setOpening] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const viewer = useRef<HTMLDivElement>(null);

  async function open(file?: File) {
    if (!file) return;
    setOpening(true);
    const width = Math.min(viewer.current!.clientWidth - 32, 900);
    const { lines, pages } = await openPdf(new Uint8Array(await file.arrayBuffer()), width);
    setDoc({ name: file.name, lines, pages });
    setQuestions([]);
    setOpening(false);
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!doc || !text) return;
    const q = questions.length;
    setDraft("");
    setQuestions((qs) => [...qs, { text, loading: true, hits: [] }]);
    const res = await fetch("/api/finder", {
      method: "POST",
      body: JSON.stringify({ lines: doc.lines.map((line) => line.text), question: text }),
    }).catch(() => null);
    const result = res?.ok ? await res.json() : { error: true };
    setQuestions((qs) => qs.map((question, i) => (i === q ? { ...question, ...result, loading: false } : question)));
  }

  // Selecting a finding in one panel scrolls the other panel to it.
  function select(k: string, scrollTo: string) {
    setSelected(k);
    document.getElementById(scrollTo)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const highlights = useMemo(
    () =>
      doc
        ? questions.flatMap((question, q) =>
            question.hits.map((hit) => ({ q, hit, line: doc.lines[hit.line], boxes: locate(doc.lines[hit.line], doc.pages) })),
          )
        : [],
    [doc, questions],
  );

  return (
    <div
      className="flex h-dvh flex-col bg-neutral-100 text-neutral-900"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        open(e.dataTransfer.files[0]);
      }}
    >
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">Finder</h1>
        <span className="truncate text-sm text-neutral-500">{doc?.name}</span>
        <label className="ml-auto cursor-pointer rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white">
          {doc ? "Open another PDF" : "Open a PDF"}
          <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => open(e.target.files?.[0])} />
        </label>
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={viewer} className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          {!doc ? (
            <div className="grid h-full place-items-center rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500">
              {opening ? "Reading the PDF…" : "Drop a PDF here, then ask it questions. Answers are highlighted in the document."}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {doc.pages.map((page, i) => (
                <PageView key={i} page={page}>
                  {highlights
                    .filter((h) => h.line.page === i + 1)
                    .map(({ q, hit, boxes }) =>
                      boxes.map((box, b) => (
                        <button
                          key={`${key(q, hit.line)}-${b}`}
                          id={b === 0 ? `hl-${key(q, hit.line)}` : undefined}
                          onClick={() => {
                            setSheetOpen(true);
                            select(key(q, hit.line), `finding-${key(q, hit.line)}`);
                          }}
                          className="absolute rounded-sm mix-blend-multiply"
                          style={{
                            ...box,
                            background: color(q),
                            opacity: selected === key(q, hit.line) ? 0.55 : 0.3,
                          }}
                        >
                          {b === 0 && (
                            <span
                              className="absolute -top-2 -left-5 grid size-4 place-items-center rounded-full text-[10px] font-bold text-white"
                              style={{ background: color(q) }}
                            >
                              {q + 1}
                            </span>
                          )}
                        </button>
                      )),
                    )}
                </PageView>
              ))}
            </div>
          )}
        </div>

        {/* A side panel on wide screens; a bottom sheet you can pull up on phones. */}
        <aside
          className={`fixed inset-x-0 bottom-0 flex max-h-[70dvh] flex-col rounded-t-2xl border-t border-neutral-200 bg-white shadow-2xl transition-transform lg:static lg:max-h-none lg:w-96 lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none ${sheetOpen ? "translate-y-0" : "translate-y-[calc(100%-3.5rem)]"}`}
        >
          <button onClick={() => setSheetOpen(!sheetOpen)} className="h-14 shrink-0 text-sm font-medium lg:hidden">
            {sheetOpen ? "Hide" : "Show"} questions ({questions.length})
          </button>
          <form onSubmit={ask} className="flex gap-2 border-b border-neutral-200 p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!doc}
              placeholder={doc ? "Ask a question about this PDF" : "Open a PDF first"}
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button disabled={!doc || !draft.trim()} className="rounded-lg bg-neutral-900 px-3 text-sm text-white disabled:opacity-40">
              Ask
            </button>
          </form>
          <ol className="flex-1 overflow-y-auto p-3">
            {questions.map((question, q) => (
              <li key={q} className="mb-4">
                <p className="flex gap-2 text-sm font-medium">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full text-xs text-white" style={{ background: color(q) }}>
                    {q + 1}
                  </span>
                  {question.text}
                </p>
                <div className="mt-2 ml-7 flex flex-col gap-2 text-sm">
                  {question.loading && <p className="text-neutral-500">Searching…</p>}
                  {question.error && <p className="text-red-600">Search failed. Try again.</p>}
                  {!question.loading && !question.error && !question.hits.length && (
                    <p className="text-neutral-500">Not in this PDF.</p>
                  )}
                  {question.hits.map((hit) => (
                    <button
                      key={hit.line}
                      id={`finding-${key(q, hit.line)}`}
                      onClick={() => {
                        setSheetOpen(false);
                        select(key(q, hit.line), `hl-${key(q, hit.line)}`);
                      }}
                      className={`rounded-lg border-l-4 p-2 text-left ${selected === key(q, hit.line) ? "bg-neutral-100" : ""}`}
                      style={{ borderColor: color(q) }}
                    >
                      “{doc!.lines[hit.line].text}”
                      <span className="mt-1 block text-xs text-neutral-500">
                        Page {doc!.lines[hit.line].page} · {Math.round(hit.p * 100)}% match
                      </span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
