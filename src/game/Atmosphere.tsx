import { Clouds, Mist } from "./fx/Sky";
import { Particles } from "./fx/Particles";
import { Smoke } from "./fx/Smoke";
import { Border } from "./fx/Border";
import { SkyDome, Sun, Wasteland, Mountains, CloudBanks } from "./fx/Horizon";
import { Islands, CloudShadows, Birds } from "./fx/Life";
import { KingdomClouds, KingdomEntry } from "./fx/KingdomBorders";

// Set any of these to false if a part is too heavy on your phone.
const SHOW_CLOUDS = true;
const SHOW_MIST = true;
const SHOW_PARTICLES = true;
const SHOW_SMOKE = true;
const SHOW_BORDER = true;
const SHOW_HORIZON = true; // sky gradient, sun, mountains, wasteland, horizon clouds
const SHOW_ISLANDS = true;
const SHOW_SHADOWS = true;
const SHOW_BIRDS = true;
const SHOW_KINGDOM_CLOUDS = true; // cloud walls on kingdom borders

export function Atmosphere() {
  return (
    <>
      {SHOW_HORIZON && (
        <>
          <SkyDome />
          <Sun />
          <Wasteland />
          <Mountains />
          <CloudBanks />
        </>
      )}
      {SHOW_ISLANDS && <Islands />}
      {SHOW_CLOUDS && <Clouds />}
      {SHOW_MIST && <Mist />}
      {SHOW_PARTICLES && <Particles />}
      {SHOW_SMOKE && <Smoke />}
      {SHOW_BORDER && <Border />}
      {SHOW_SHADOWS && <CloudShadows />}
      {SHOW_BIRDS && <Birds />}
      {SHOW_KINGDOM_CLOUDS && <KingdomClouds />}
      <KingdomEntry />
    </>
  );
}