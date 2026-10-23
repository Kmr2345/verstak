// Слои чертежа: толщина линий и цвета для экрана/PDF, имя слоя и цвет для DXF.
// Толщина в миллиметрах на бумаге.

export const LAYERS = {
  frame: { w: 0.7, color: '#111111', dxf: 'FRAME', aci: 7 },
  outline: { w: 0.5, color: '#111111', dxf: 'OUTLINE', aci: 7 },
  dim: { w: 0.18, color: '#1f3b8a', dxf: 'DIM', aci: 5 },
  text: { w: 0.18, color: '#111111', dxf: 'TEXT', aci: 7 },
  part: { w: 0.3, color: '#222222', dxf: 'PARTS', aci: 7 },
  sheet: { w: 0.4, color: '#555555', dxf: 'SHEET', aci: 8 },
  edge: { w: 0.9, color: '#d4380d', dxf: 'EDGE', aci: 1 },
  table: { w: 0.2, color: '#555555', dxf: 'TABLE', aci: 8 },
};

// Примитивы чертежа. Координаты в миллиметрах, ось y направлена вниз (как в SVG).
export const line = (x1, y1, x2, y2, layer = 'outline') => ({ t: 'line', x1, y1, x2, y2, layer });

export const rect = (x, y, w, h, layer = 'outline') => [
  line(x, y, x + w, y, layer),
  line(x + w, y, x + w, y + h, layer),
  line(x + w, y + h, x, y + h, layer),
  line(x, y + h, x, y, layer),
];

export const text = (x, y, str, size = 3.5, opts = {}) => ({
  t: 'text',
  x,
  y,
  text: String(str),
  size,
  anchor: opts.anchor || 'start',
  rot: opts.rot || 0,
  bold: !!opts.bold,
  layer: opts.layer || 'text',
});

// Грубая оценка ширины текста, чтобы длинные названия не вылезали из ячеек
export function fit(str, maxWidth, size) {
  const perChar = size * 0.52;
  const max = Math.max(1, Math.floor(maxWidth / perChar));
  const s = String(str);
  return s.length <= max ? s : s.slice(0, Math.max(1, max - 1)) + '…';
}

export function translate(items, dx, dy) {
  return items.map((it) =>
    it.t === 'line'
      ? { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy }
      : { ...it, x: it.x + dx, y: it.y + dy }
  );
}
