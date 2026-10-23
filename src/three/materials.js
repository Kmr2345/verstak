// Материалы для 3D: листовые материалы (с процедурной текстурой дерева), металл ручек, линии рёбер.

import * as THREE from 'three';
import { SCENE_UNIT } from '../config.js';

const TEX_MM = 500; // сколько миллиметров дерева в одной плитке текстуры

// Детерминированный генератор: у одного декора текстура всегда одинаковая
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Волокна рисуем вертикально (вдоль оси v текстуры), позже UV разворачиваются вдоль длины детали
function makeWoodTexture(baseColor, seed) {
  if (typeof document === 'undefined') return null;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return null; // тесты без canvas
  const rnd = seeded(seed);

  g.fillStyle = baseColor;
  g.fillRect(0, 0, size, size);
  g.lineCap = 'round';

  for (let i = 0; i < 280; i++) {
    const x = rnd() * size;
    const width = 0.5 + rnd() * 2.8;
    const alpha = 0.04 + rnd() * 0.2;
    const dark = rnd() < 0.62;
    const amp = 1 + rnd() * 4;
    const freq = 1 + Math.floor(rnd() * 3);
    const phase = rnd() * Math.PI * 2;
    g.strokeStyle = dark ? `rgba(34,17,6,${alpha})` : `rgba(255,236,205,${alpha * 0.8})`;
    g.lineWidth = width;
    // три копии по x, чтобы текстура бесшовно стыковалась по краям
    for (const shift of [-size, 0, size]) {
      g.beginPath();
      for (let y = 0; y <= size; y += 16) {
        const dx = Math.sin((y / size) * Math.PI * 2 * freq + phase) * amp;
        g[y === 0 ? 'moveTo' : 'lineTo'](x + shift + dx, y);
      }
      g.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

const cache = new Map();
const highlights = new Map();
let xray = false;

function applyXray(mat) {
  mat.transparent = xray;
  mat.opacity = xray ? 0.32 : 1;
  mat.depthWrite = !xray;
  mat.needsUpdate = true;
}

export function sheetMaterial(sheet) {
  const key = `${sheet.id}|${sheet.color}|${sheet.pattern}`;
  let mat = cache.get(key);
  if (!mat) {
    const map = sheet.pattern === 'wood' ? makeWoodTexture(sheet.color, hashString(sheet.id)) : null;
    mat = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : sheet.color,
      map,
      roughness: sheet.kind === 'МДФ' ? 0.4 : 0.58,
      metalness: 0,
    });
    applyXray(mat);
    cache.set(key, mat);
  }
  return mat;
}

export const handleMaterial = new THREE.MeshStandardMaterial({ color: 0xc9cdd3, roughness: 0.28, metalness: 0.9 });
export const legMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 });
export const edgeLineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.17 });

export function setXray(on) {
  xray = on;
  for (const mat of cache.values()) applyXray(mat);
  applyXray(handleMaterial);
  applyXray(legMaterial);
}

// Материал для наведения мыши: тот же, но со светящимся оттенком
export function highlightOf(base) {
  let mat = highlights.get(base);
  if (!mat) {
    mat = base.clone();
    mat.emissive = new THREE.Color(0x2f6bff);
    mat.emissiveIntensity = 0.28;
    highlights.set(base, mat);
  }
  // клон не должен отставать от базы, когда включён рентген
  mat.transparent = base.transparent;
  mat.opacity = base.opacity;
  mat.depthWrite = base.depthWrite;
  return mat;
}

// Раскладывает UV по реальным размерам: волокна идут вдоль длины детали, масштаб один на все детали.
// size — размеры детали в мм по x, y, z; axis — ось толщины.
export function applyPhysicalUVs(geometry, size, axis, seedKey) {
  const axisIndex = { x: 0, y: 1, z: 2 }[axis];
  const rest = [0, 1, 2].filter((i) => i !== axisIndex);
  const grain = size[rest[0]] >= size[rest[1]] ? rest[0] : rest[1];

  const rnd = seeded(hashString(seedKey));
  const offU = rnd();
  const offV = rnd();

  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const toTex = SCENE_UNIT / TEX_MM;

  for (let i = 0; i < pos.count; i++) {
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const normalAxis = n.indexOf(Math.max(...n));
    const [a, b] = [0, 1, 2].filter((k) => k !== normalAxis);
    const along = grain !== normalAxis ? grain : a;      // у торца волокно любое
    const across = along === a ? b : a;
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    uv.setXY(i, p[across] * toTex + offU, p[along] * toTex + offV);
  }
  uv.needsUpdate = true;
}
