// Проекции изделия на плоскости видов (спереди, слева, сверху) с удалением невидимых линий.
//
// Каждая деталь на виде — прямоугольник. Контур прямоугольника рисуем только там,
// где его не закрывает более близкий к зрителю прямоугольник. Для осевых параллелепипедов
// этого достаточно для честного чертежа.

import { GAP } from '../config.js';

const EPS = 0.01;
const TOL = GAP; // зазоры в пару миллиметров считаем закрытыми, иначе чертёж зарастает штрихами

// Прямоугольник вида: u вправо, v вверх, near — насколько деталь близка к зрителю
const PROJECT = {
  front: (b) => ({ u0: b.x0, u1: b.x1, v0: b.y0, v1: b.y1, near: b.z1 }),
  side: (b) => ({ u0: b.z0, u1: b.z1, v0: b.y0, v1: b.y1, near: -b.x0 }), // смотрим слева, перёд изделия справа
  top: (b) => ({ u0: b.x0, u1: b.x1, v0: -b.z1, v1: -b.z0, near: b.y1 }), // перёд внизу листа
};

export const VIEW_NAMES = { front: 'Вид спереди', side: 'Вид слева', top: 'Вид сверху' };

function toBox(pos, size) {
  const [x, y, z] = pos;
  const [sx, sy, sz] = size;
  return { x0: x - sx / 2, x1: x + sx / 2, y0: y - sy / 2, y1: y + sy / 2, z0: z - sz / 2, z1: z + sz / 2 };
}

// Все видимые объекты изделия: детали, ручки и ножки
export function collectBoxes(model) {
  const boxes = model.parts.map((p) => toBox(p.pos, p.size));
  for (const f of model.fixtures) boxes.push(toBox(f.pos, f.size));
  return boxes;
}

// Вычитает из отрезка [a, b] закрытые интервалы, возвращает оставшиеся куски
function subtract(a, b, covers) {
  let pieces = [[a, b]];
  for (const [c0, c1] of covers) {
    const next = [];
    for (const [p0, p1] of pieces) {
      if (c1 <= p0 || c0 >= p1) next.push([p0, p1]);
      else {
        if (c0 > p0) next.push([p0, c0]);
        if (c1 < p1) next.push([c1, p1]);
      }
    }
    pieces = next;
    if (!pieces.length) break;
  }
  return pieces;
}

// Видимые отрезки вида в миллиметрах (u вправо, v вверх)
export function visibleSegments(boxes, view) {
  const rects = boxes.map(PROJECT[view]);
  const out = [];
  const seen = new Set();

  const emit = (u0, v0, u1, v1) => {
    if (Math.hypot(u1 - u0, v1 - v0) < 0.3) return;
    const key = [u0, v0, u1, v1].map((n) => n.toFixed(1)).join(',');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ u0, v0, u1, v1 });
  };

  for (const r of rects) {
    const nearer = rects.filter((o) => o !== r && o.near > r.near + EPS);

    // Горизонтальные рёбра: закрывает тот, чей диапазон по v накрывает ребро
    for (const v of [r.v0, r.v1]) {
      const covers = nearer
        .filter((o) => v > o.v0 - TOL && v < o.v1 + TOL)
        .map((o) => [o.u0 - TOL, o.u1 + TOL]);
      for (const [a, b] of subtract(r.u0, r.u1, covers)) emit(a, v, b, v);
    }
    // Вертикальные рёбра
    for (const u of [r.u0, r.u1]) {
      const covers = nearer
        .filter((o) => u > o.u0 - TOL && u < o.u1 + TOL)
        .map((o) => [o.v0 - TOL, o.v1 + TOL]);
      for (const [a, b] of subtract(r.v0, r.v1, covers)) emit(u, a, u, b);
    }
  }
  return out;
}

// Габарит вида в миллиметрах
export function viewExtent(model, view) {
  const { width: W, height: H, depth: D } = model.project;
  // перёд выступает за габарит на высоту ручек, поэтому берём реальные границы
  const boxes = collectBoxes(model).map(PROJECT[view]);
  const u0 = Math.min(...boxes.map((r) => r.u0), view === 'side' ? -D / 2 : -W / 2);
  const u1 = Math.max(...boxes.map((r) => r.u1), view === 'side' ? D / 2 : W / 2);
  const v0 = Math.min(...boxes.map((r) => r.v0), view === 'top' ? -D / 2 : 0);
  const v1 = Math.max(...boxes.map((r) => r.v1), view === 'top' ? D / 2 : H);
  return { u0, u1, v0, v1, w: u1 - u0, h: v1 - v0 };
}
