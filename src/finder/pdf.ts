import init, { processPdf } from "@firecrawl/pdf-inspector-wasm";
import { GlobalWorkerOptions, getDocument, type PDFPageProxy, type PageViewport } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

GlobalWorkerOptions.workerSrc = workerUrl;

export type Line = { text: string; page: number };
export type Page = { proxy: PDFPageProxy; viewport: PageViewport; items: TextItem[]; text: string; owner: number[] };
export type Box = { left: number; top: number; width: number; height: number };

// Letters and digits only, so the two libraries' spacing, hyphenation and punctuation don't matter when matching.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// pdf-inspector gives clean text in reading order. Split it into sentences, each tagged with its page.
function toLines(markdown: string) {
  const lines: Line[] = [];
  let page = 1;
  for (const raw of markdown.split("\n")) {
    const marker = raw.match(/<!-- Page (\d+) -->/);
    if (marker) page = Number(marker[1]);
    const text = raw.replace(/<!--.*?-->|<\/?u>|\*\*|^#+\s*|^-\s*|\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
    for (const sentence of text ? text.split(/(?<=[.!?])\s+(?=[A-Z"“(])/) : []) lines.push({ text: sentence, page });
  }
  return lines;
}

// Text comes from pdf-inspector (for Jev); page drawing and text positions come from pdf.js (for highlights).
export async function openPdf(bytes: Uint8Array, width: number) {
  await init();
  const { markdown } = processPdf(bytes, { includePageMarkers: true });
  const doc = await getDocument({ data: bytes.slice() }).promise; // pdf.js takes ownership of the buffer
  const pages = await Promise.all(
    Array.from({ length: doc.numPages }, async (_, i): Promise<Page> => {
      const proxy = await doc.getPage(i + 1);
      const viewport = proxy.getViewport({ scale: width / proxy.getViewport({ scale: 1 }).width });
      const items = (await proxy.getTextContent()).items.filter((item): item is TextItem => "str" in item);
      // One long string per page, plus which text item each character came from.
      let text = "";
      const owner: number[] = [];
      items.forEach((item, j) => {
        const n = norm(item.str);
        text += n;
        owner.push(...Array(n.length).fill(j));
      });
      return { proxy, viewport, items, text, owner };
    }),
  );
  return { lines: toLines(markdown ?? ""), pages };
}

// Where a line sits on its page, as boxes in rendered pixels. Empty if pdf.js can't find it (e.g. chart labels).
export function locate(line: Line, pages: Page[]): Box[] {
  const page = pages[line.page - 1];
  const needle = norm(line.text);
  const at = needle ? page?.text.indexOf(needle) : -1;
  if (!page || at < 0) return [];
  return [...new Set(page.owner.slice(at, at + needle.length))].map((j) => {
    const { transform, width, height } = page.items[j];
    const [x1, y1] = page.viewport.convertToViewportPoint(transform[4], transform[5]);
    const [x2, y2] = page.viewport.convertToViewportPoint(transform[4] + width, transform[5] + height);
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
  });
}
