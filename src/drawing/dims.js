// Размерные линии. Все расстояния в единицах чертежа; k — множитель «бумажных» величин
// (стрелки, выносы, высота текста), чтобы при масштабе 1:1 подписи не терялись.

import { line, text } from './layers.js';

const TICK = 1.6;       // половина засечки
const OVERSHOOT = 2;    // на сколько размерная линия выходит за выносные
const TEXT_SIZE = 3.2;

// Горизонтальный размер между x1 и x2. yRef — край предмета, offset — на сколько ниже (+) или выше (−) линия.
export function dimHorizontal(out, x1, x2, yRef, offset, label, k = 1) {
  const y = yRef + offset * k;
  const dir = Math.sign(offset) || 1;
  out.push(line(x1, yRef + dir * 1 * k, x1, y + dir * OVERSHOOT * k, 'dim'));
  out.push(line(x2, yRef + dir * 1 * k, x2, y + dir * OVERSHOOT * k, 'dim'));
  out.push(line(x1 - OVERSHOOT * k, y, x2 + OVERSHOOT * k, y, 'dim'));
  for (const x of [x1, x2]) out.push(line(x - TICK * k, y + TICK * k, x + TICK * k, y - TICK * k, 'dim'));
  const textY = dir > 0 ? y + TEXT_SIZE * k * 1.15 : y - 1 * k;
  out.push(text((x1 + x2) / 2, textY, label, TEXT_SIZE * k, { anchor: 'middle', layer: 'dim' }));
}

// Вертикальный размер между y1 и y2. xRef — край предмета, offset — влево (−) или вправо (+).
export function dimVertical(out, y1, y2, xRef, offset, label, k = 1) {
  const x = xRef + offset * k;
  const dir = Math.sign(offset) || 1;
  out.push(line(xRef + dir * 1 * k, y1, x + dir * OVERSHOOT * k, y1, 'dim'));
  out.push(line(xRef + dir * 1 * k, y2, x + dir * OVERSHOOT * k, y2, 'dim'));
  out.push(line(x, y1 - OVERSHOOT * k, x, y2 + OVERSHOOT * k, 'dim'));
  for (const y of [y1, y2]) out.push(line(x - TICK * k, y + TICK * k, x + TICK * k, y - TICK * k, 'dim'));
  const textX = dir < 0 ? x - 1 * k : x + TEXT_SIZE * k * 1.1;
  out.push(text(textX, (y1 + y2) / 2, label, TEXT_SIZE * k, { anchor: 'middle', rot: -90, layer: 'dim' }));
}
