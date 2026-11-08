import { Text } from "@react-three/drei";
import { Detailed } from "@react-three/drei";
import { useMemo } from "react";
import {
  BUILDINGS,
  BLOCK_SIZE,
  GRID,
  HARBOR_Z,
  DISTRICT_LABELS,
  type BuildingBox,
} from "./worldData";
import { themeOf } from "./city/palette";
import { Terrain } from "./city/Terrain";
import { Roads } from "./city/Roads";
import { Lamps, Lots, Props } from "./city/Street";
import { MergeStatic } from "./city/MergeStatic";
import { BOX } from "./city/parts";
import { solidMaterial } from "./city/textures";
import { KingsCastle } from "./medieval/KingsCastle";
import { VillageBlocks } from "./medieval/VillageBlocks";
import { TownSquare } from "./medieval/TownSquare";
import {
  Bank, Crane, Harbor, LowRise, Mall, Silo, Stadium, Tower, Warehouse,
} from "./city/buildingsA";
import {
  Brownstone, Casino, Hangar, Headquarters, Hospital, House, Pagoda, Plaza, Shanty,
} from "./city/buildingsB";

// Level of detail: the full building up close, one simple block at medium range, nothing beyond the fog.
const LOD_BLOCK = 100;
const LOD_HIDDEN = 340;

/** The far version of a building: a single box in its kingdom's stone colour (one draw call). */
function Silhouette({ b }: { b: BuildingBox }) {
  const theme = themeOf(b.district);
  return (
    <mesh
      geometry={BOX}
      material={solidMaterial(theme.stone)}
      position={[b.x, b.h / 2, b.z]}
      scale={[b.w, b.h, b.d]}
    />
  );
}

/**
 * Chooses the level of detail by distance from the camera, with no React re-rendering.
 * The close version is baked into a few big meshes once, a moment after loading.
 */
function WithLod({ b, delay, children }: { b: BuildingBox; delay: number; children: React.ReactNode }) {
  // The LOD object sits at the building, so distance is measured to the building itself.
  // The children already use world coordinates, so they are shifted back by the same amount.
  return (
    <Detailed distances={[0, LOD_BLOCK, LOD_HIDDEN]} position={[b.x, 0, b.z]}>
      <group position={[-b.x, 0, -b.z]}>
        <MergeStatic delayMs={delay}>{children}</MergeStatic>
      </group>
      <group position={[-b.x, 0, -b.z]}>
        <Silhouette b={b} />
      </group>
      <group />
    </Detailed>
  );
}

function renderBuilding(b: BuildingBox, i: number) {
  switch (b.type) {
    case "tower": return <Tower key={i} b={b} />;
    case "warehouse": return <Warehouse key={i} b={b} />;
    case "silo": return <Silo key={i} b={b} />;
    case "bank": return <Bank key={i} b={b} />;
    case "lowrise": return <LowRise key={i} b={b} />;
    case "mall": return <Mall key={i} b={b} />;
    case "harbor": return <Harbor key={i} b={b} />;
    case "crane": return <Crane key={i} b={b} />;
    case "stadium": return <Stadium key={i} b={b} />;
    case "hospital": return <Hospital key={i} b={b} />;
    case "house": return <House key={i} b={b} />;
    case "plaza": return <Plaza key={i} b={b} />;
    case "hangar": return <Hangar key={i} b={b} />;
    case "casino": return <Casino key={i} b={b} />;
    case "pagoda": return <Pagoda key={i} b={b} />;
    case "shanty": return <Shanty key={i} b={b} />;
    case "brownstone": return <Brownstone key={i} b={b} />;
    case "hq": return <Headquarters key={i} b={b} />;
    default: return null;
  }
}

export function City() {
  const rendered = useMemo(() => {
    return BUILDINGS.map((b, i) => {
      // The Kings' village cottages are drawn together by <VillageBlocks /> below.
      if (b.cottage) return null;

      // In the Kings' village the old modern plazas are gone: the town square is <TownSquare />,
      // and the other plaza blocks are left as open meadow.
      if (b.type === "plaza" && b.district === "downtown") return null;

      // Flat decorations (plazas) are cheap and have no height: no level of detail needed.
      if (b.type === "plaza") return renderBuilding(b, i);

      // The Kings' Hall is the first piece rebuilt from the real medieval models.
      // It bakes itself into one mesh, and shows the old Hall while loading or if loading fails.
      if (b.type === "hq" && b.district === "downtown") {
        return (
          <KingsCastle
            key={i}
            b={b}
            fallback={
              <WithLod b={b} delay={60 + (i % 90) * 20}>
                {renderBuilding(b, i)}
              </WithLod>
            }
          />
        );
      }

      return (
        // Merging is spread over the first couple of seconds so the game does not freeze while loading.
        <WithLod key={i} b={b} delay={60 + (i % 90) * 20}>
          {renderBuilding(b, i)}
        </WithLod>
      );
    });
  }, []);

  const groundExtent = (GRID * 2 + 2) * BLOCK_SIZE;

  return (
    <group>
      {/* The ground: rolling in the Kings' village, flat everywhere else. */}
      <Terrain />

      <Lots />
      <MergeStatic delayMs={150}>
        <Roads />
      </MergeStatic>
      <Lamps />
      <Props />

      {/* The Black Tide: violet harbor water. */}
      <mesh position={[0, 0.03, HARBOR_Z - BLOCK_SIZE * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundExtent, BLOCK_SIZE * 1.4]} />
        <meshStandardMaterial color="#6b52b8" emissive="#3a2a80" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>

      {rendered}
      <VillageBlocks />
      <TownSquare />

      {DISTRICT_LABELS.map((d, i) => (
        <Text
          key={i}
          position={[d.x, 46, d.z]}
          fontSize={5}
          color={themeOf(d.district).trim}
          outlineWidth={0.25}
          outlineColor="#2a2530"
          anchorX="center"
          anchorY="middle"
        >
          {d.name}
        </Text>
      ))}
    </group>
  );
}
