import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const CheckerPanel = lazy(() =>
  import("@/game/assets/CheckerPanel").then((m) => ({ default: m.CheckerPanel })),
);

export const Route = createFileRoute("/assets")({
  validateSearch: (search: Record<string, unknown>) => {
    if (import.meta.env.DEV) console.log("[assets] raw search:", JSON.stringify(search));
    return {
      dev: search.dev === "1" || search.dev === true,
    };
  },
  head: () => ({
    meta: [
      { title: "FORGOTTEN — Asset library" },
      { name: "description", content: "Internal asset library checker for the FORGOTTEN project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
  const { dev } = Route.useSearch();
  if (!dev) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 text-center">
        <div>
          <p className="font-serif text-2xl text-amber-100">Nothing to see here</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This page rests. Append <code className="rounded bg-muted px-1">?dev=1</code> to wake it.
          </p>
          <a href="/" className="mt-4 inline-block text-xs text-amber-200/70 hover:text-amber-100 underline underline-offset-4">← Return</a>
        </div>
      </main>
    );
  }
  return (
    <ClientOnly fallback={<div className="min-h-dvh bg-background" />}>
      <Suspense fallback={<div className="min-h-dvh bg-background" />}>
        <CheckerPanel />
      </Suspense>
    </ClientOnly>
  );
}
