import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/credits")({
  head: () => ({
    meta: [
      { title: "FORGOTTEN — Credits" },
      {
        name: "description",
        content: "The sources of every asset in the FORGOTTEN world. Remain forgotten.. or become remembered.",
      },
      { property: "og:title", content: "FORGOTTEN — Credits" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreditsPage,
});

function CreditsPage() {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/models/CREDITS.md")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => { if (!cancelled) setText(t); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-dvh bg-background text-foreground px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs tracking-[0.35em] text-muted-foreground uppercase">11:11</p>
        <h1 className="mt-2 font-serif text-3xl text-amber-100">Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What this world is built from, and whose hands shaped it.
        </p>
        <a href="/" className="mt-4 inline-block text-xs text-amber-200/70 hover:text-amber-100 underline underline-offset-4">
          ← Return
        </a>
        <article className="mt-6 space-y-3 text-sm leading-relaxed text-foreground/90">
          {failed && <p className="text-red-200/80">The record could not be read. The memories are fractured.</p>}
          {text === null && !failed && <p className="text-muted-foreground">Reading the record…</p>}
          {text !== null && <SimpleMarkdown text={text} />}
        </article>
        <div className="mt-10 border-t border-border pt-4 text-xs tracking-[0.25em] text-muted-foreground/70 uppercase">
          The Forgotten Project · Awakened at 11:11
        </div>
      </div>
    </main>
  );
}

/** Minimal markdown rendering (headings, lists, paragraphs) — no dependencies. */
function SimpleMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.length === 0) return null;
        if (lines[0].startsWith("#")) {
          const level = lines[0].match(/^#+/)![0].length;
          const content = lines[0].replace(/^#+\s*/, "");
          const Tag = (level <= 2 ? "h2" : "h3") as "h2" | "h3";
          return <Tag key={i} className={level <= 2 ? "pt-4 font-serif text-xl text-amber-100/90" : "pt-3 font-serif text-lg text-amber-100/80"}>{content}</Tag>;
        }
        if (lines.every((l) => /^\s*[-*]\s/.test(l))) {
          return (
            <ul key={i} className="space-y-1 pl-5 list-disc marker:text-amber-300/50">
              {lines.map((l, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inline(l.replace(/^\s*[-*]\s*/, "")) }} />)}
            </ul>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: inline(lines.join(" ")) }} />;
      })}
    </>
  );
}

/** **bold** and `code` only — content is our own CREDITS.md, not user input. */
function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong class='text-foreground'>$1</strong>")
    .replace(/`([^`]+)`/g, "<code class='rounded bg-muted px-1 text-[0.8em]'>$1</code>");
}
