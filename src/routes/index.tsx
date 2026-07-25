import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GameScene = lazy(() =>
  import("@/game/GameScene").then((m) => ({ default: m.GameScene })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gang Wars — 3D Turf Warfare" },
      {
        name: "description",
        content:
          "Mobile-first 3D multiplayer turf war. Pick a gang, capture districts, defend your city.",
      },
      { property: "og:title", content: "Gang Wars — 3D Turf Warfare" },
      {
        property: "og:description",
        content: "Mobile-first 3D multiplayer turf war set in a neon-lit night city.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="fixed inset-0 bg-black" />}>
      <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
        <GameScene />
      </Suspense>
    </ClientOnly>
  );
}
