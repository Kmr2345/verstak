// Рисует примитивы чертежа в SVG. Единицы viewBox — миллиметры бумаги.

import { LAYERS } from './layers.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => Math.round(v * 100) / 100;

export function itemsToSvgBody(items) {
  return items
    .map((it) => {
      const style = LAYERS[it.layer] || LAYERS.outline;
      if (it.t === 'line') {
        return `<line x1="${n(it.x1)}" y1="${n(it.y1)}" x2="${n(it.x2)}" y2="${n(it.y2)}" stroke="${style.color}" stroke-width="${style.w}" stroke-linecap="round"/>`;
      }
      const anchor = it.anchor === 'middle' ? 'middle' : it.anchor === 'end' ? 'end' : 'start';
      const rotate = it.rot ? ` transform="rotate(${it.rot} ${n(it.x)} ${n(it.y)})"` : '';
      return `<text x="${n(it.x)}" y="${n(it.y)}" font-size="${n(it.size)}" text-anchor="${anchor}" fill="${style.color}"${it.bold ? ' font-weight="600"' : ''}${rotate}>${esc(it.text)}</text>`;
    })
    .join('');
}

// Полный SVG-документ. paper: рисовать белый лист под чертежом.
export function itemsToSvg(items, width, height, { paper = false, className = '' } = {}) {
  const bg = paper ? `<rect width="${width}" height="${height}" fill="#ffffff"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 ${n(width)} ${n(height)}" preserveAspectRatio="xMidYMid meet" font-family="IBM Plex Sans, system-ui, sans-serif">${bg}${itemsToSvgBody(items)}</svg>`;
}
