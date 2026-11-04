import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHARACTER_PALETTE as P, characterVariant, appearanceHash, type CharacterVariant, type CharacterRole } from './characterAppearance';

export type CharacterRefs = {
  root: THREE.Group | null; body: THREE.Group | null; head: THREE.Group | null;
  armL: THREE.Group | null; armR: THREE.Group | null; legL: THREE.Group | null; legR: THREE.Group | null;
  torsoMat: THREE.MeshToonMaterial | null;
};
export const CHARACTER_SCALE = 1.15;
const BOX = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
const FACE = new THREE.PlaneGeometry(0.43, 0.46);
const CHEST = new THREE.PlaneGeometry(0.68, 0.84);
const GRADIENT = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
GRADIENT.minFilter = GRADIENT.magFilter = THREE.NearestFilter;
GRADIENT.needsUpdate = true;
const OUTLINE = new THREE.MeshBasicMaterial({ color: P.outline, side: THREE.BackSide });
// One shared material for every baked part: the colour lives in the vertices instead.
const VERTEX_TOON = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
const textureCache = new Map<string, THREE.CanvasTexture>();
function artTexture(kind: string, variant: CharacterVariant, color: string, muted: boolean, monster: boolean) {
  const key = [kind, variant, color, muted, monster].join(':');
  const cached = textureCache.get(key); if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  if (c) {
    const detail = muted ? P.gray : P.violet;
    c.fillStyle = kind === 'face' ? P.skin : color; c.fillRect(0, 0, 256, 256);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (kind === 'face') {
      // Heavy anime lids, violet iris and hollow ink socket. No smoking accessories.
      c.fillStyle = P.bone; c.beginPath(); c.moveTo(20, 95); c.quadraticCurveTo(65, 117, 114, 94); c.quadraticCurveTo(70, 155, 20, 95); c.fill();
      c.fillStyle = P.violet; c.beginPath(); c.ellipse(72, 112, 16, 14, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = P.outline; c.beginPath(); c.ellipse(73, 112, 5, 12, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = P.bone; c.fillRect(64, 104, 5, 4);
      c.strokeStyle = P.outline; c.lineWidth = 8; c.beginPath(); c.moveTo(17, 94); c.quadraticCurveTo(63, 108, 116, 94); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(27, 75); c.quadraticCurveTo(70, 60, 114, 75); c.stroke();
      c.fillStyle = P.drip; c.beginPath(); c.ellipse(186, 109, 37, 39, -0.15, 0, Math.PI * 2); c.fill();
      c.strokeStyle = P.drip; c.lineWidth = 12;
      [[160, 166], [177, 198], [195, 177], [212, 155]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x, 117); c.bezierCurveTo(x - 5, 141, x + 4, y - 13, x, y); c.stroke(); });
      c.fillStyle = P.outline; c.beginPath(); c.ellipse(185, 105, 26, 29, -0.15, 0, Math.PI * 2); c.fill();
      c.lineWidth = 3; c.strokeStyle = P.outline; c.beginPath(); c.moveTo(112, 148); c.lineTo(104, 163); c.lineTo(120, 164); c.stroke();
      c.beginPath(); c.moveTo(98, 190); c.quadraticCurveTo(133, 215, 165, 185); c.stroke();
      if (monster) {
        [53, 76].forEach(y => [68, 184].forEach(x => { c.fillStyle = P.bone; c.beginPath(); c.ellipse(x, y, 25, 9, 0.1, 0, Math.PI * 2); c.fill(); c.fillStyle = P.crimson; c.beginPath(); c.ellipse(x, y, 8, 8, 0, 0, Math.PI * 2); c.fill(); }));
        c.fillStyle = P.bone; [114, 147].forEach(x => { c.beginPath(); c.moveTo(x, 199); c.lineTo(x + 10, 196); c.lineTo(x + 5, 215); c.fill(); });
      }
    } else {
      c.strokeStyle = P.ink; c.lineWidth = 5;
      c.beginPath(); c.moveTo(30, 28); c.quadraticCurveTo(128, 78, 224, 28); c.stroke();
      if (variant === 'skeleton') {
        c.strokeStyle = muted ? '#b5b2b0' : P.bone; c.lineWidth = 12;
        c.beginPath(); c.moveTo(128, 68); c.lineTo(128, 232); c.stroke();
        [90, 119, 148, 177, 206].forEach((y, i) => [-1, 1].forEach(s => { c.beginPath(); c.moveTo(128 + s * 12, y); c.bezierCurveTo(128 + s * (85-i*9), y-25, 128 + s * (96-i*10), y+13, 128+s*16, y+14); c.stroke(); }));
      } else if (variant === 'cardigan') {
        c.fillStyle = muted ? P.gray : P.crimson; c.fillRect(104, 0, 48, 256);
        c.strokeStyle = P.ink; c.lineWidth = 10; [99,157].forEach(x => { c.beginPath(); c.moveTo(x, 0); c.lineTo(x,256); c.stroke(); });
        for(let y=60;y<240;y+=48) for(const x of [34,70,187,222]) { c.fillStyle = muted ? '#a7a19b' : (y%96===60 ? P.crimson : P.bone); c.beginPath(); c.moveTo(x,y-15);c.lineTo(x+15,y);c.lineTo(x,y+15);c.lineTo(x-15,y);c.closePath();c.fill(); }
      } else if (variant === 'samurai') {
        c.strokeStyle = muted ? P.gray : P.crimson; c.lineWidth = 20; c.beginPath();c.moveTo(42,0);c.lineTo(177,227);c.moveTo(207,0);c.lineTo(78,227);c.stroke();
        c.fillStyle=P.ink;c.fillRect(0,216,256,22);
      } else {
        c.fillStyle = detail; c.beginPath();c.moveTo(76,139);c.lineTo(95,157);c.lineTo(109,127);c.lineTo(130,155);c.lineTo(155,126);c.lineTo(168,160);c.lineTo(189,137);c.lineTo(174,192);c.lineTo(90,192);c.closePath();c.fill();
        c.fillStyle = P.ink;c.fillRect(98,178,68,5);
        if (variant === 'lightning' || variant === 'hood' || variant.includes('beanie')) {
          c.fillStyle=detail;[-1,1].forEach(s=>{ const x=s===-1?15:219;c.beginPath();c.moveTo(x+18,59);c.lineTo(x-10,125);c.lineTo(x+14,112);c.lineTo(x-3,198);c.lineTo(x+43,101);c.lineTo(x+17,111);c.closePath();c.fill(); });
        }
        c.strokeStyle=detail;c.lineWidth=4;[100,155].forEach(x=>{c.beginPath();c.moveTo(x,40);c.lineTo(x,104);c.stroke();});
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture); return texture;
}
const hatCache = new Map<string, THREE.BufferGeometry>();
function hatGeometry(variant: CharacterVariant) {
  const cached=hatCache.get(variant);if(cached)return cached;
  const parts: THREE.BufferGeometry[]=[];
  const add=(g:THREE.BufferGeometry,x:number,y:number,z:number)=>{g.translate(x,y,z);parts.push(g);};
  if(variant==='frog-hat') { add(new THREE.CylinderGeometry(.29,.34,.22,12),0,.54,0);add(new THREE.CylinderGeometry(.39,.39,.035,12),0,.43,0);[-1,1].forEach(s=>add(new THREE.SphereGeometry(.10,8,6),s*.24,.68,.02)); }
  else if(variant==='bun'||variant==='samurai') { add(new THREE.SphereGeometry(.29,10,8,0,Math.PI*2,0,Math.PI*.57),0,.41,-.02); if(variant==='bun')add(new THREE.SphereGeometry(.20,8,6),-.08,.68,-.16); else {[-1,0,1].forEach(s=>{const g=BOX.clone();g.scale(.20,.85,.22);add(g,s*.22,.17,-.18);});} }
  else if(variant==='hood') { const g=BOX.clone();g.scale(.63,.67,.36);add(g,0,.28,-.16); }
  else { add(new THREE.SphereGeometry(.30,12,8,0,Math.PI*2,0,Math.PI*.5),0,.47,-.01);add(new THREE.CylinderGeometry(.30,.30,.09,12),0,.46,-.01); }
  const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());const geometry=merged??BOX;hatCache.set(variant,geometry);return geometry;
}

// ---- Baked parts ---------------------------------------------------------------------------
// Every limb used to be many little meshes (each drawn twice, fill + black outline). Now each limb is
// ONE filled mesh with vertex colours plus ONE outline mesh. Same look, about half the draw calls.
type Vec3 = [number, number, number];
type Part = { geo?: THREE.BufferGeometry; pos?: Vec3; rot?: Vec3; scale?: Vec3; color: string };
type Baked = { fill: THREE.BufferGeometry; outline: THREE.BufferGeometry };
const bakeCache = new Map<string, Baked>();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();

function plain(g: THREE.BufferGeometry) {
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  return g;
}

function bake(key: string, parts: Part[]): Baked {
  const hit = bakeCache.get(key); if (hit) return hit;
  const fills: THREE.BufferGeometry[] = [];
  const outlines: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const src = p.geo ?? BOX;
    const pos = p.pos ?? [0, 0, 0];
    const rot = p.rot ?? [0, 0, 0];
    const sc = p.scale ?? [1, 1, 1];
    tmpQ.setFromEuler(tmpE.set(rot[0], rot[1], rot[2]));
    tmpM.compose(new THREE.Vector3(pos[0], pos[1], pos[2]), tmpQ, new THREE.Vector3(sc[0], sc[1], sc[2]));
    const fill = plain(src.clone()).applyMatrix4(tmpM);
    const outline = plain(src.clone()).scale(1.065, 1.065, 1.065).applyMatrix4(tmpM);
    const n = fill.attributes.position.count;
    const colors = new Float32Array(n * 3);
    tmpC.set(p.color);
    for (let i = 0; i < n; i++) { colors[i * 3] = tmpC.r; colors[i * 3 + 1] = tmpC.g; colors[i * 3 + 2] = tmpC.b; }
    fill.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    fills.push(fill);
    outlines.push(outline);
  }
  const baked: Baked = {
    fill: mergeGeometries(fills, false) ?? fills[0],
    outline: mergeGeometries(outlines, false) ?? outlines[0],
  };
  bakeCache.set(key, baked);
  return baked;
}

function BakedPart({ baked }: { baked: Baked }) {
  return <>
    <mesh geometry={baked.fill} material={VERTEX_TOON} dispose={null} />
    <mesh geometry={baked.outline} material={OUTLINE} dispose={null} />
  </>;
}

type Props = { color: string; accent: string; skin?: string; showWeaponSlot?: React.ReactNode; scale?: number;
  variant?: CharacterVariant; role?: CharacterRole; monster?: boolean;
  identity?: () => { id: string | number; color: string; accent: string } | undefined;
};
export const Character = forwardRef<CharacterRefs, Props>(function Character({color,accent,skin=P.skin,showWeaponSlot,scale=CHARACTER_SCALE,variant='lightning',role='faction',monster=false,identity},ref) {
  const root=useRef<THREE.Group>(null),body=useRef<THREE.Group>(null),head=useRef<THREE.Group>(null),armL=useRef<THREE.Group>(null),armR=useRef<THREE.Group>(null),legL=useRef<THREE.Group>(null),legR=useRef<THREE.Group>(null);
  const torsoMat=useRef<THREE.MeshToonMaterial>(null);
  const identityKey=useRef<string>('');const [remote,setRemote]=useState<ReturnType<NonNullable<Props['identity']>>>();
  useFrame(()=>{const next=identity?.();if(next&&identityKey.current!==`${next.id}:${next.color}`){identityKey.current=`${next.id}:${next.color}`;setRemote(next);}});
  const v=remote?characterVariant(remote.id):variant;
  const muted=role==='civilian';
  const torso=role==='guard'?P.ink:muted?P.civilian[appearanceHash(v)%P.civilian.length]:remote?.color??color;
  const trim=role==='guard'?P.gold:muted?P.gray:remote?.accent??accent;
  const hat=v==='frog-hat'?(muted?'#697660':P.frog):v==='bun'||v==='samurai'||v==='hood'?P.hair:v==='purple-beanie'? (muted?P.gray:'#7436b3'):P.gray;
  const faceMap=useMemo(()=>artTexture('face',v,skin,muted,monster),[v,skin,muted,monster]);
  const chestMap=useMemo(()=>artTexture('chest',v,torso,muted,monster),[v,torso,muted,monster]);

  const bodyParts=useMemo(()=>{
    const parts: Part[]=[{pos:[0,.15,0],scale:[.74,.08,.44],color:P.ink}];
    if(role==='guard'){
      parts.push({pos:[0,.81,.24],scale:[.54,.11,.06],color:trim});
      parts.push({pos:[0,.48,.24],scale:[.045,.42,.04],color:trim});
    }
    return bake(`body|${role}|${trim}`,parts);
  },[role,trim]);

  const headParts=useMemo(()=>{
    const parts: Part[]=[
      {pos:[0,0,0],scale:[.22,.16,.22],color:skin},
      {pos:[0,.27,0],scale:[.47,.48,.44],color:skin},
      {geo:hatGeometry(v),color:hat},
    ];
    if(v==='frog-hat') [-1,1].forEach(s=>parts.push({pos:[s*.24,.68,.105],scale:[.08,.09,.025],color:P.ink}));
    if(v==='bun') [-1,1].forEach(s=>parts.push({pos:[-.23,.49,.18],rot:[0,0,s*.75],scale:[.15,.025,.025],color:muted?P.gray:P.violet}));
    if(v!=='bun'&&v!=='samurai'&&v!=='hood'&&v!=='frog-hat') parts.push({pos:[.08,.54,.277],scale:[.16,.08,.025],color:v==='purple-beanie'?P.ink:P.bone});
    return bake(`head|${v}|${skin}|${hat}|${muted}`,parts);
  },[v,skin,hat,muted]);

  const armParts=useMemo(()=>[-1,1].map(s=>{
    const parts: Part[]=[{pos:[0,-.40,0],scale:[.22,.8,.24],color:torso}];
    if(v==='lightning') parts.push({pos:[0,-.36,.13],rot:[0,0,s*.3],scale:[.045,.42,.02],color:muted?P.gray:P.violet});
    parts.push({pos:[0,-.9,0],scale:[.18,.18,.18],color:skin});
    return bake(`arm|${s}|${torso}|${skin}|${v==='lightning'}|${muted}`,parts);
  }),[torso,skin,v,muted]);

  const legParts=useMemo(()=>bake('leg',[
    {pos:[0,-.4,0],scale:[.26,.85,.28],color:P.ink},
    {pos:[0,-.9,.05],scale:[.28,.12,.4],color:P.ink},
  ]),[]);

  useImperativeHandle(ref,()=>({get root(){return root.current;},get body(){return body.current;},get head(){return head.current;},get armL(){return armL.current;},get armR(){return armR.current;},get legL(){return legL.current;},get legR(){return legR.current;},get torsoMat(){return torsoMat.current;}}));
  return <group ref={root} scale={scale}><group ref={body}>
    <group position={[0,.55,0]} scale={[.72,.90,.42]}>
      <mesh geometry={BOX} dispose={null}><meshToonMaterial ref={torsoMat} color={torso} gradientMap={GRADIENT}/></mesh>
      <mesh geometry={BOX} material={OUTLINE} scale={1.06} dispose={null}/>
    </group>
    <mesh geometry={CHEST} position={[0,.55,.219]} dispose={null}><meshBasicMaterial map={chestMap} toneMapped={false}/></mesh>
    <BakedPart baked={bodyParts}/>
    <group ref={head} position={[0,1.2,0]}>
      <mesh geometry={FACE} position={[0,.27,.229]} dispose={null}><meshBasicMaterial map={faceMap} toneMapped={false}/></mesh>
      <BakedPart baked={headParts}/>
    </group>
    {[-1,1].map((s,i)=><group key={s} ref={s<0?armL:armR} position={[s*.46,1,0]}>
      <BakedPart baked={armParts[i]}/>
      {s>0&&showWeaponSlot&&<group position={[0,-.95,.15]} rotation={[1.4,0,0]}>{showWeaponSlot}</group>}
    </group>)}
    {[-1,1].map(s=><group key={s} ref={s<0?legL:legR} position={[s*.18,.1,0]}>
      <BakedPart baked={legParts}/>
    </group>)}
  </group></group>;
});