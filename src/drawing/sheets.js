// Сборка листов чертежа: общий вид, спецификация, смета, карты раскроя.
// Результат — списки примитивов (см. layers.js) в миллиметрах бумаги, дальше их рисуют SVG, PDF и DXF.

import { line, rect, text, fit, translate } from './layers.js';
import { dimHorizontal, dimVertical } from './dims.js';
import { collectBoxes, visibleSegments, viewExtent, VIEW_NAMES } from './views.js';
import { mmText, money, plainNumber, percent, dateText } from '../core/format.js';
import { findEdge, sheetTitle } from '../core/lookup.js';
import { APP_NAME } from '../config.js';

export const A3 = { width: 420, height: 297 };
const FRAME = { left: 20, top: 5, right: 415, bottom: 292 };
const STANDARD_DENOMINATORS = [1, 2, 2.5, 4, 5, 10, 15, 20, 25, 50, 75, 100];

// ---------- Виды ----------

const VIEW_ORDER = ['front', 'side', 'top'];

// Размер чертежа видов в единицах чертежа при масштабе s
function layoutSize(extents, s, k) {
  const margin = 16 * k;
  const gap = 34 * k;
  const maxH = Math.max(...extents.map((e) => e.h * s));
  const width = margin * 2 + extents.reduce((sum, e) => sum + e.w * s, 0) + gap * (extents.length - 1);
  const height = 14 * k + maxH + 30 * k;
  return { width, height, margin, gap, maxH };
}

// Самый крупный стандартный масштаб, при котором виды влезают в область
export function chooseScale(model, availW, availH) {
  const extents = VIEW_ORDER.map((v) => viewExtent(model, v));
  for (const den of STANDARD_DENOMINATORS) {
    const size = layoutSize(extents, 1 / den, 1);
    if (size.width <= availW && size.height <= availH) return den;
  }
  return STANDARD_DENOMINATORS[STANDARD_DENOMINATORS.length - 1];
}

export const scaleLabel = (den) => `1:${String(den).replace('.', ',')}`;

// Три вида с размерами. scale — отношение размера на чертеже к реальному, ann — множитель подписей.
export function buildViewsDrawing(model, { scale, ann = 1 }) {
  const k = ann;
  const s = scale;
  const { width: W, height: H, depth: D, plinth: P } = model.project;
  const boxes = collectBoxes(model);
  const extents = VIEW_ORDER.map((v) => viewExtent(model, v));
  const size = layoutSize(extents, s, k);
  const yBase = 14 * k + size.maxH;
  const items = [];

  let x = size.margin;
  VIEW_ORDER.forEach((view, i) => {
    const ext = extents[i];
    const toX = (u) => x + (u - ext.u0) * s;
    const toY = (v) => yBase - (v - ext.v0) * s;

    for (const seg of visibleSegments(boxes, view)) {
      items.push(line(toX(seg.u0), toY(seg.v0), toX(seg.u1), toY(seg.v1), 'outline'));
    }

    if (view === 'front') {
      dimHorizontal(items, toX(-W / 2), toX(W / 2), yBase, 8, mmText(W), k);
      dimVertical(items, toY(H), toY(0), toX(-W / 2), -8, mmText(H), k);
      if (P > 0) dimVertical(items, toY(P), toY(0), toX(W / 2), 8, mmText(P), k);
      if (model.cells.length > 1) {
        for (const c of model.cells) {
          dimHorizontal(items, toX(c.cellX - c.cellWidth / 2), toX(c.cellX + c.cellWidth / 2), toY(H), -6, mmText(c.cellWidth), k);
        }
      }
    }
    if (view === 'side') {
      dimHorizontal(items, toX(-D / 2), toX(D / 2), yBase, 8, mmText(D), k);
    }
    if (view === 'top') {
      dimHorizontal(items, toX(-W / 2), toX(W / 2), yBase, 8, mmText(W), k);
      dimVertical(items, toY(D / 2), toY(-D / 2), toX(W / 2), 8, mmText(D), k);
    }

    items.push(text(x + (ext.w * s) / 2, yBase + 24 * k, VIEW_NAMES[view], 4 * k, { anchor: 'middle', bold: true }));
    x += ext.w * s + size.gap;
  });

  return { items, width: size.width, height: yBase + 30 * k };
}

// ---------- Рамка и штамп ----------

function frameAndTitle(page, { project, title, number, total, scale }) {
  const items = [];
  const { left, top, right, bottom } = FRAME;
  items.push(...rect(left, top, right - left, bottom - top, 'frame'));

  // штамп в правом нижнем углу
  const bx = right - 185;
  const by = bottom - 40;
  items.push(...rect(bx, by, 185, 40, 'frame'));
  items.push(line(bx + 100, by, bx + 100, bottom, 'frame'));
  items.push(line(bx, by + 24, bx + 100, by + 24, 'frame'));
  for (const dy of [13.3, 26.6]) items.push(line(bx + 100, by + dy, right, by + dy, 'frame'));

  items.push(text(bx + 4, by + 10, fit(project.name, 92, 6), 6, { bold: true }));
  items.push(text(bx + 4, by + 17.5, `${project.width} × ${project.height} × ${project.depth} мм`, 3.6));
  items.push(text(bx + 4, by + 34, fit(title, 92, 4.2), 4.2));

  items.push(text(bx + 104, by + 9, `Масштаб: ${scale || '—'}`, 3.6));
  items.push(text(bx + 104, by + 22.3, `Лист: ${number} из ${total}`, 3.6));
  items.push(text(bx + 104, by + 35.6, `${dateText()}  ·  ${APP_NAME}`, 3.6));

  return items;
}

// ---------- Общий вид ----------

function materialNotes(model) {
  const { project, mats, hardware } = model;
  const edgeName = (id) => findEdge(model.catalog, id)?.name || id;
  const notes = [
    'Материалы:',
    `Корпус: ${sheetTitle(mats.carcass)}, кромка ${edgeName(project.edging.carcass)}`,
    `Фасады: ${sheetTitle(mats.front)}, кромка ${edgeName(project.edging.front)}`,
    `Задняя стенка: ${sheetTitle(mats.back)}`,
  ];
  if (model.units.some((u) => u.kind === 'drawer')) notes.push(`Коробки ящиков: ${sheetTitle(mats.drawer)}`);
  const hw = hardware.filter((h) => h.id !== 'confirmat' && h.id !== 'shelf-pin').map((h) => `${h.name} — ${h.qty} ${h.unit}`);
  if (hw.length) notes.push('Фурнитура: ' + hw.join('; '));
  notes.push('Размеры указаны в миллиметрах.');
  return notes;
}

export function overviewPage(model, { number, total }) {
  const availW = 375;
  const availH = 232;
  const den = chooseScale(model, availW, availH);
  const drawing = buildViewsDrawing(model, { scale: 1 / den });
  const dx = 28 + (availW - drawing.width) / 2;
  const items = translate(drawing.items, dx, 10 + (availH - drawing.height) / 2);

  // примечания слева от штампа
  const notes = materialNotes(model);
  notes.forEach((n, i) => items.push(text(26, 256 + i * 4.6, fit(n, 195, 3.3), 3.3, { bold: i === 0 })));

  items.push(...frameAndTitle(A3, { project: model.project, title: 'Чертёж общего вида', number, total, scale: scaleLabel(den) }));
  return { ...A3, title: 'Общий вид', items };
}

// ---------- Таблицы ----------

// cols: [{ title, w, align, get(row) }]
function tableItems(x, y, cols, rows, { rowH = 6.4, size = 3.4 } = {}) {
  const items = [];
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  let cx = x;
  const cellText = (col, str, ty, bold) => {
    const pad = 2;
    const ax = col.align === 'end' ? cx + col.w - pad : col.align === 'middle' ? cx + col.w / 2 : cx + pad;
    items.push(text(ax, ty, fit(str, col.w - pad * 2, size), size, { anchor: col.align || 'start', bold }));
  };

  items.push(line(x, y, x + totalW, y, 'frame'));
  for (const col of cols) {
    cellText(col, col.title, y + rowH * 0.7, true);
    cx += col.w;
  }
  items.push(line(x, y + rowH, x + totalW, y + rowH, 'frame'));

  rows.forEach((row, i) => {
    const ry = y + rowH * (i + 1);
    cx = x;
    for (const col of cols) {
      cellText(col, col.get(row), ry + rowH * 0.7, row.bold);
      cx += col.w;
    }
    items.push(line(x, ry + rowH, x + totalW, ry + rowH, 'table'));
  });
  return items;
}

const ROWS_PER_PAGE = 31;

export function specPages(model, startNumber, total) {
  const rows = model.spec.rows.map((r) => ({
    ...r,
    material: sheetTitle(model.catalog.sheets.find((m) => m.id === r.materialId)),
    edgeType: r.edgeId ? findEdge(model.catalog, r.edgeId)?.name || '' : '—',
  }));

  const cols = [
    { title: '№', w: 12, align: 'middle', get: (r) => r.no },
    { title: 'Наименование', w: 78, get: (r) => r.name },
    { title: 'Материал', w: 96, get: (r) => r.material },
    { title: 'Длина, мм', w: 24, align: 'end', get: (r) => mmText(r.length) },
    { title: 'Ширина, мм', w: 26, align: 'end', get: (r) => mmText(r.width) },
    { title: 'Кол-во', w: 18, align: 'end', get: (r) => r.qty },
    { title: 'Кромка по длине', w: 32, align: 'end', get: (r) => (r.edgeL ? r.edgeL : '—') },
    { title: 'Кромка по ширине', w: 34, align: 'end', get: (r) => (r.edgeW ? r.edgeW : '—') },
    { title: 'Тип кромки', w: 36, get: (r) => r.edgeType },
  ];

  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  return Array.from({ length: pageCount }, (_, i) => {
    const slice = rows.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE);
    const items = tableItems(25, 12, cols, slice);
    const title = `Спецификация деталей${pageCount > 1 ? ` (${i + 1}/${pageCount})` : ''}`;
    items.push(...frameAndTitle(A3, { project: model.project, title, number: startNumber + i, total, scale: '' }));
    return { ...A3, title, items };
  });
}

export function costPage(model, number, total) {
  const { cost } = model;
  const rows = [];
  let lastGroup = null;
  for (const l of cost.lines) {
    if (l.group !== lastGroup) {
      rows.push({ bold: true, group: l.group, name: '', qty: '', unit: '', price: '', sum: money(cost.groups[l.group]) });
      lastGroup = l.group;
    }
    rows.push({ group: '', name: l.name, qty: plainNumber(l.qty), unit: l.unit, price: money(l.price), sum: money(l.sum) });
  }
  rows.push({ bold: true, group: 'Итого', name: '', qty: '', unit: '', price: '', sum: money(cost.subtotal) });
  rows.push({ group: 'Наценка', name: '', qty: '', unit: '', price: '', sum: money(cost.margin) });
  rows.push({ bold: true, group: 'К оплате', name: '', qty: '', unit: '', price: '', sum: money(cost.total) });

  const cols = [
    { title: 'Раздел', w: 38, get: (r) => r.group },
    { title: 'Наименование', w: 150, get: (r) => r.name },
    { title: 'Кол-во', w: 30, align: 'end', get: (r) => r.qty },
    { title: 'Ед.', w: 22, get: (r) => r.unit },
    { title: 'Цена', w: 55, align: 'end', get: (r) => r.price },
    { title: 'Сумма', w: 60, align: 'end', get: (r) => r.sum },
  ];

  const items = tableItems(25, 12, cols, rows);
  items.push(text(25, 245, 'Цены ориентировочные и берутся из каталога. Листы считаются целиком по карте раскроя.', 3.2));
  items.push(...frameAndTitle(A3, { project: model.project, title: 'Смета', number, total, scale: '' }));
  return { ...A3, title: 'Смета', items };
}

// ---------- Раскрой ----------

// Оценка занимаемой подписью ширины
const labelWidth = (str, size) => str.length * size * 0.55;

function bandedSides(piece, rotated) {
  // длинные кромки идут вдоль длины: у неповёрнутой детали это верх и низ
  const longSides = rotated ? ['left', 'right'] : ['top', 'bottom'];
  const shortSides = rotated ? ['top', 'bottom'] : ['left', 'right'];
  return [...longSides.slice(0, piece.edgeL), ...shortSides.slice(0, piece.edgeW)];
}

// Один лист раскроя. scale — размер на чертеже к реальному, ann — множитель подписей.
export function buildCuttingSheet(cuttingMaterial, sheet, { scale, ann = 1 }) {
  const s = scale;
  const k = ann;
  const [L, W] = cuttingMaterial.material.sheet;
  const trim = cuttingMaterial.trim;
  const items = [];

  items.push(...rect(0, 0, L * s, W * s, 'sheet'));
  items.push(...rect(trim * s, trim * s, (L - 2 * trim) * s, (W - 2 * trim) * s, 'table'));

  for (const p of sheet.placements) {
    const x = (trim + p.x) * s;
    const y = (trim + p.y) * s;
    const w = p.w * s;
    const h = p.h * s;
    items.push(...rect(x, y, w, h, 'part'));

    for (const side of bandedSides(p.piece, p.rotated)) {
      if (side === 'top') items.push(line(x, y, x + w, y, 'edge'));
      if (side === 'bottom') items.push(line(x, y + h, x + w, y + h, 'edge'));
      if (side === 'left') items.push(line(x, y, x, y + h, 'edge'));
      if (side === 'right') items.push(line(x + w, y, x + w, y + h, 'edge'));
    }

    // Подпись: номер и размеры, если помещаются
    const size = 3 * k;
    const dims = `${mmText(p.piece.length)}×${mmText(p.piece.width)}`;
    const no = `№${p.piece.no}`;
    const cx = x + w / 2;
    const cy = y + h / 2;
    if (w > labelWidth(dims, size) + 2 * k && h > size * 2.6) {
      items.push(text(cx, cy - size * 0.1, no, size, { anchor: 'middle', bold: true }));
      items.push(text(cx, cy + size * 1.1, dims, size, { anchor: 'middle' }));
    } else if (h > labelWidth(dims, size) + 2 * k && w > size * 2.6) {
      items.push(text(cx - size * 0.1, cy, `${no}  ${dims}`, size, { anchor: 'middle', rot: -90 }));
    } else if (w > labelWidth(no, size) + k && h > size * 1.4) {
      items.push(text(cx, cy + size * 0.35, no, size, { anchor: 'middle', bold: true }));
    }
  }

  return { items, width: L * s, height: W * s };
}

export function cuttingPages(model, startNumber, total) {
  const pages = [];
  let n = startNumber;
  for (const mat of model.cutting.materials) {
    for (const sheet of mat.sheets) {
      const [L, W] = mat.material.sheet;
      const s = Math.min(0.1, 372 / L, 222 / W);
      const drawing = buildCuttingSheet(mat, sheet, { scale: s });
      const items = translate(drawing.items, 28, 12);

      const sx = 28 + drawing.width + 8;
      const used = sheet.placements.reduce((sum, p) => sum + p.w * p.h, 0) / (L * W);
      const info = [
        sheetTitle(mat.material),
        `Лист ${sheet.index} из ${mat.sheets.length}`,
        `${L} × ${W} мм`,
        `Деталей: ${sheet.placements.length}`,
        `Заполнение: ${percent(used)}`,
        `Пропил ${model.settings.kerf} мм`,
        'Красная линия: кромка',
      ];
      info.forEach((str, i) => items.push(text(sx, 20 + i * 5.5, fit(str, 405 - sx, 3.6), 3.6, { bold: i === 0 })));

      const title = `Раскрой: ${mat.material.name} ${mat.material.thickness} мм, лист ${sheet.index}/${mat.sheets.length}`;
      items.push(...frameAndTitle(A3, { project: model.project, title, number: n, total, scale: scaleLabel(Math.round(1 / s * 10) / 10) }));
      pages.push({ ...A3, title, items });
      n += 1;
    }
  }
  return pages;
}

// Все страницы PDF по порядку
export function buildAllPages(model) {
  const specCount = Math.max(1, Math.ceil(model.spec.rows.length / ROWS_PER_PAGE));
  const cutCount = model.cutting.materials.reduce((s, m) => s + m.sheets.length, 0);
  const total = 1 + specCount + 1 + cutCount;
  return [
    overviewPage(model, { number: 1, total }),
    ...specPages(model, 2, total),
    costPage(model, 2 + specCount, total),
    ...cuttingPages(model, 3 + specCount, total),
  ];
}
