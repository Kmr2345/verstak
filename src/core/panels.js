// Генерация деталей по параметрам проекта.
//
// Система координат (мм): x вправо, y вверх от пола, z к зрителю.
// Центр тумбы по x и z в нуле, перед тумбы смотрит в +z.
//
// Каждая деталь — это параллелепипед:
//   size  — размеры по x, y, z
//   pos   — центр детали
//   axis  — ось, вдоль которой у детали толщина
//   edges — стороны, на которые клеится кромка
// Из этого списка потом строятся 3D, чертёж, спецификация и раскрой.

import {
  GAP, BACK_SETBACK, BACK_GROOVE, SHELF_SETBACK, PLINTH_SETBACK, PLINTH_FLOOR_GAP,
  SLIDE_CLEARANCE, SLIDE_LENGTHS, DRAWER_BOX_LOSS, DRAWER_BOX_LIFT, DOOR_OPEN_ANGLE,
  MAX_SHELF_SPAN, MAX_DOOR_WIDTH, MAX_DOOR_HEIGHT, MIN_SHELF_GAP, MIN_DRAWER_FRONT,
} from '../config.js';

const round1 = (v) => Math.round(v * 10) / 10;

// Размер детали по трём осям: толщина идёт вдоль axis, a и b — остальные две оси по порядку
function sizeFor(axis, t, a, b) {
  if (axis === 'x') return [t, a, b];
  if (axis === 'y') return [a, t, b];
  return [a, b, t];
}

function makePart({ id, name, role, mat, axis, a, b, pos, edges = [], unit = null }) {
  return {
    id,
    name,
    role, // carcass, front, back или drawer: от роли зависят материал и кромка
    materialId: mat.id,
    axis,
    size: sizeFor(axis, mat.thickness, a, b).map(round1),
    pos: pos.map(round1),
    edges,
    unit,
  };
}

// Ближайшая стандартная длина направляющих, которая помещается в глубину корпуса
export function pickSlideLength(innerDepth) {
  const fit = SLIDE_LENGTHS.filter((l) => l <= innerDepth - 2);
  return fit.length ? fit[fit.length - 1] : null;
}

export function buildPanels(project, mats, handle) {
  const { width: W, height: H, depth: D, plinth: P, columns } = project;
  const T = mats.carcass.thickness;
  const F = mats.front.thickness;
  const B = mats.back.thickness;
  const n = columns.length;

  const parts = [];
  const units = [];     // подвижные узлы: двери и ящики
  const fixtures = [];  // ножки и ручки (в спецификацию не попадают)
  const warnings = [];
  const cells = [];     // геометрия секций, нужна чертежу и интерфейсу

  const add = (p) => (parts.push(p), p);

  const bodyH = H - P;
  const bodyD = D - F;                     // фасады входят в общую глубину
  const zRear = -D / 2;
  const zFront = D / 2 - F;                // передняя плоскость корпуса
  const zBody = (zRear + zFront) / 2;
  const innerW = W - 2 * T;
  const innerH = bodyH - 2 * T;
  const innerD = bodyD - BACK_SETBACK - B; // от задней стенки до переда корпуса
  const yMid = P + bodyH / 2;
  const zFrontMid = D / 2 - F / 2;         // центр толщины фасада

  // Боковины, дно и крышка
  add(makePart({ id: 'side-l', name: 'Боковина', role: 'carcass', mat: mats.carcass, axis: 'x', a: bodyH, b: bodyD, pos: [-W / 2 + T / 2, yMid, zBody], edges: ['front'] }));
  add(makePart({ id: 'side-r', name: 'Боковина', role: 'carcass', mat: mats.carcass, axis: 'x', a: bodyH, b: bodyD, pos: [W / 2 - T / 2, yMid, zBody], edges: ['front'] }));
  add(makePart({ id: 'bottom', name: 'Дно', role: 'carcass', mat: mats.carcass, axis: 'y', a: innerW, b: bodyD, pos: [0, P + T / 2, zBody], edges: ['front'] }));
  add(makePart({ id: 'top', name: 'Крышка', role: 'carcass', mat: mats.carcass, axis: 'y', a: innerW, b: bodyD, pos: [0, H - T / 2, zBody], edges: ['front'] }));

  // Задняя стенка заходит в паз по периметру
  add(makePart({
    id: 'back', name: 'Задняя стенка', role: 'back', mat: mats.back, axis: 'z',
    a: innerW + 2 * BACK_GROOVE, b: innerH + 2 * BACK_GROOVE,
    pos: [0, yMid, zRear + BACK_SETBACK + B / 2],
  }));

  // Границы секций: фасады у всех одинаковой ширины, стойки стоят на границах
  const cellEdges = Array.from({ length: n + 1 }, (_, i) => -W / 2 + (i * W) / n);

  for (let i = 1; i < n; i++) {
    add(makePart({ id: `divider-${i}`, name: 'Стойка', role: 'carcass', mat: mats.carcass, axis: 'x', a: innerH, b: innerD, pos: [cellEdges[i], yMid, zFront - innerD / 2], edges: ['front'] }));
  }

  // Ручка для фасада; owner — дверь или ящик, к которому она крепится
  function handleFor(kind, x, y, w, h, owner) {
    if (!handle || handle.shape === 'none') return;
    const len = Math.min(handle.length, kind === 'door' ? h * 0.4 : w * 0.6);
    const depth = handle.shape === 'knob' ? 24 : 14;
    let pos;
    let size;
    if (handle.shape === 'knob') {
      size = [28, 28, depth];
    } else if (kind === 'door') {
      size = [10, len, depth];   // вертикальная скоба
    } else {
      size = [len, 10, depth];   // горизонтальная скоба
    }
    if (kind === 'door') {
      // у дверей ручка у свободного края, у высоких — на высоте около метра
      const hingeLeft = owner.hinge === 'left';
      const hx = hingeLeft ? x + w / 2 - 40 : x - w / 2 + 40;
      const hy = h > 1200 ? Math.min(y + h / 2 - 150, 1000) : y;
      pos = [hx, hy, D / 2 + depth / 2];
    } else {
      pos = [x, y + h / 2 - Math.min(40, h / 3), D / 2 + depth / 2];
    }
    fixtures.push({ kind: 'handle', shape: handle.shape, pos: pos.map(round1), size, unit: owner.id });
  }

  function addDoor(id, w, h, x, y, hinge) {
    const door = add(makePart({ id, name: 'Дверь', role: 'front', mat: mats.front, axis: 'z', a: w, b: h, pos: [x, y, zFrontMid], edges: ['top', 'bottom', 'left', 'right'], unit: id }));
    const pivotX = hinge === 'left' ? x - door.size[0] / 2 : x + door.size[0] / 2;
    units.push({ id, kind: 'door', hinge, pivot: [round1(pivotX), round1(y), round1(zFrontMid)], angle: DOOR_OPEN_ANGLE });
    handleFor('door', x, y, door.size[0], door.size[1], { id, hinge });
    if (door.size[0] > MAX_DOOR_WIDTH) warnings.push({ level: 'warn', text: `Дверь шириной ${door.size[0]} мм: больше ${MAX_DOOR_WIDTH} мм дверь будет вести. Добавьте секцию или сделайте две двери.` });
    if (door.size[1] > MAX_DOOR_HEIGHT) warnings.push({ level: 'warn', text: `Дверь высотой ${door.size[1]} мм: выше ${MAX_DOOR_HEIGHT} мм лучше делать составной фасад.` });
  }

  columns.forEach((col, i) => {
    const left = i === 0 ? -W / 2 + T : cellEdges[i] + T / 2;
    const right = i === n - 1 ? W / 2 - T : cellEdges[i + 1] - T / 2;
    const cw = right - left;
    const cx = (left + right) / 2;
    const cellW = cellEdges[i + 1] - cellEdges[i];
    const cellX = (cellEdges[i] + cellEdges[i + 1]) / 2;
    cells.push({ index: i, left, right, width: cw, cx, cellWidth: cellW, cellX });

    // Полки: ровно делят свободную высоту секции
    if (col.front !== 'drawers' && col.shelves > 0) {
      const k = col.shelves;
      const space = (innerH - k * T) / (k + 1);
      const shelfD = innerD - SHELF_SETBACK;
      if (space < MIN_SHELF_GAP) warnings.push({ level: 'warn', text: `Секция ${i + 1}: между полками ${Math.round(space)} мм, это меньше ${MIN_SHELF_GAP} мм.` });
      if (cw > MAX_SHELF_SPAN) warnings.push({ level: 'warn', text: `Секция ${i + 1}: пролёт полки ${Math.round(cw)} мм, полка прогнётся. Рекомендуем не больше ${MAX_SHELF_SPAN} мм, добавьте стойку.` });
      for (let j = 1; j <= k; j++) {
        const y = P + T + j * space + (j - 0.5) * T;
        add(makePart({ id: `c${i}-shelf-${j}`, name: 'Полка', role: 'carcass', mat: mats.carcass, axis: 'y', a: cw, b: shelfD, pos: [cx, y, zFront - SHELF_SETBACK - shelfD / 2], edges: ['front'] }));
      }
    }

    const doorH = bodyH - GAP;

    if (col.front === 'door') {
      addDoor(`c${i}-door`, cellW - GAP, doorH, cellX, yMid, col.hinge);
    }

    if (col.front === 'double') {
      const w = (cellW - 2 * GAP) / 2;
      addDoor(`c${i}-door-l`, w, doorH, cellEdges[i] + GAP / 2 + w / 2, yMid, 'left');
      addDoor(`c${i}-door-r`, w, doorH, cellEdges[i + 1] - GAP / 2 - w / 2, yMid, 'right');
    }

    if (col.front === 'drawers') {
      const d = col.drawers;
      const frontH = bodyH / d - GAP;
      const frontW = cellW - GAP;
      const slide = pickSlideLength(innerD);
      const boxD = slide || Math.max(100, Math.floor(innerD - 2));
      const td = mats.drawer.thickness;
      const boxW = cw - 2 * SLIDE_CLEARANCE;
      const boxH = Math.max(60, frontH - DRAWER_BOX_LOSS);

      if (!slide) warnings.push({ level: 'error', text: `Секция ${i + 1}: глубина ${D} мм слишком мала для направляющих (нужно от ${SLIDE_LENGTHS[0] + F + BACK_SETBACK + B + 2} мм).` });
      if (frontH < MIN_DRAWER_FRONT) warnings.push({ level: 'warn', text: `Секция ${i + 1}: фасад ящика ${Math.round(frontH)} мм, это очень низко. Уменьшите число ящиков.` });

      for (let k = 0; k < d; k++) {
        const id = `c${i}-drawer-${k + 1}`;
        const yBottom = P + GAP / 2 + (d - 1 - k) * (frontH + GAP); // первый ящик сверху
        const yFront = yBottom + frontH / 2;
        const front = add(makePart({ id: `${id}-front`, name: 'Фасад ящика', role: 'front', mat: mats.front, axis: 'z', a: frontW, b: frontH, pos: [cellX, yFront, zFrontMid], edges: ['top', 'bottom', 'left', 'right'], unit: id }));

        // Коробка ящика: два борта, передняя и задняя стенки, дно из ХДФ
        const boxY = yBottom + DRAWER_BOX_LIFT + boxH / 2;
        const boxZ = zFront - boxD / 2;
        const box = { mat: mats.drawer, role: 'drawer', unit: id };
        add(makePart({ ...box, id: `${id}-side-l`, name: 'Бок ящика', axis: 'x', a: boxH, b: boxD, pos: [cx - boxW / 2 + td / 2, boxY, boxZ] }));
        add(makePart({ ...box, id: `${id}-side-r`, name: 'Бок ящика', axis: 'x', a: boxH, b: boxD, pos: [cx + boxW / 2 - td / 2, boxY, boxZ] }));
        add(makePart({ ...box, id: `${id}-wall-f`, name: 'Стенка ящика', axis: 'z', a: boxW - 2 * td, b: boxH, pos: [cx, boxY, zFront - td / 2] }));
        add(makePart({ ...box, id: `${id}-wall-r`, name: 'Стенка ящика', axis: 'z', a: boxW - 2 * td, b: boxH, pos: [cx, boxY, zFront - boxD + td / 2] }));
        add(makePart({ id: `${id}-bottom`, name: 'Дно ящика', role: 'back', mat: mats.back, axis: 'y', a: boxW - 2 * td + 10, b: boxD - 2 * td + 10, pos: [cx, yBottom + DRAWER_BOX_LIFT + 10, boxZ], unit: id }));

        units.push({ id, kind: 'drawer', pivot: [0, 0, 0], travel: Math.round(boxD * 0.8) });
        handleFor('drawer', cellX, yFront, front.size[0], front.size[1], { id });
      }
    }
  });

  // Цоколь и ножки
  if (P > 0) {
    const plinthH = Math.max(20, P - PLINTH_FLOOR_GAP);
    add(makePart({
      id: 'plinth', name: 'Цоколь', role: 'carcass', mat: mats.carcass, axis: 'z',
      a: innerW, b: plinthH,
      pos: [0, PLINTH_FLOOR_GAP + plinthH / 2, zFront - PLINTH_SETBACK - T / 2],
      edges: ['top', 'bottom'],
    }));

    const legX = W / 2 - 50;
    const legZ = bodyD / 2 - 70; // ножки дальше, чем цоколь, чтобы он их закрывал
    const xs = W > 900 ? [-legX, 0, legX] : [-legX, legX];
    for (const x of xs) {
      for (const z of [zBody - legZ, zBody + legZ]) {
        fixtures.push({ kind: 'leg', shape: 'cylinder', pos: [round1(x), round1(P / 2), round1(z)], size: [36, P, 36], unit: null });
      }
    }
  }

  return { parts, units, fixtures, warnings, cells, geometry: { innerW, innerH, innerD, bodyH, bodyD, T, F, B } };
}
