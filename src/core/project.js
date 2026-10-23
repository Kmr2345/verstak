// Проект: значения по умолчанию, шаблоны и приведение данных к допустимым.
// Всё, что приходит снаружи (ввод, localStorage, ссылка), проходит через normalizeProject.

import { LIMITS, MIN_PLINTH, MIN_CELL_WIDTH } from '../config.js';
import { findSheet, findEdge, findHinge, findSlide, findHandle } from './lookup.js';

export const FRONT_TYPES = ['open', 'door', 'double', 'drawers'];

export const FRONT_LABELS = {
  open: 'Открытая',
  door: 'Дверь',
  double: 'Две двери',
  drawers: 'Ящики',
};

const DEFAULT_COLUMN = { front: 'door', hinge: 'left', shelves: 1, drawers: 3 };

export function newId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function createProject(overrides = {}) {
  return {
    id: newId(),
    name: 'Новый проект',
    width: 600,
    height: 800,
    depth: 400,
    plinth: 100,
    materials: {
      carcass: 'ldsp-white-18',
      front: 'ldsp-white-18',
      back: 'hdf-white-3',
      drawer: 'ldsp-white-16',
    },
    edging: { carcass: 'pvc-04', front: 'pvc-2' },
    hardware: { handle: 'bar-128', hinge: 'hinge-soft', slide: 'slide-ball' },
    columns: [{ ...DEFAULT_COLUMN }],
    updatedAt: Date.now(),
    ...overrides,
  };
}

// Шаблоны изделий для кнопки «Новый проект»
export const TEMPLATES = [
  {
    id: 'cabinet',
    title: 'Тумба',
    note: '600 × 800 × 400, дверь и полка',
    make: () => createProject({ name: 'Тумба' }),
  },
  {
    id: 'dresser',
    title: 'Комод',
    note: '800 × 900 × 450, четыре ящика',
    make: () =>
      createProject({
        name: 'Комод',
        width: 800,
        height: 900,
        depth: 450,
        plinth: 80,
        columns: [{ ...DEFAULT_COLUMN, front: 'drawers', drawers: 4, shelves: 0 }],
      }),
  },
  {
    id: 'wardrobe',
    title: 'Шкаф',
    note: '1000 × 2100 × 550, две секции с дверями',
    make: () =>
      createProject({
        name: 'Шкаф',
        width: 1000,
        height: 2100,
        depth: 550,
        plinth: 60,
        columns: [
          { ...DEFAULT_COLUMN, front: 'door', hinge: 'left', shelves: 5 },
          { ...DEFAULT_COLUMN, front: 'door', hinge: 'right', shelves: 5 },
        ],
      }),
  },
  {
    id: 'tv',
    title: 'ТВ-тумба',
    note: '1600 × 500 × 400, три секции',
    make: () =>
      createProject({
        name: 'ТВ-тумба',
        width: 1600,
        height: 500,
        depth: 400,
        plinth: 60,
        columns: [
          { ...DEFAULT_COLUMN, front: 'door', hinge: 'left', shelves: 0 },
          { ...DEFAULT_COLUMN, front: 'open', shelves: 1 },
          { ...DEFAULT_COLUMN, front: 'door', hinge: 'right', shelves: 0 },
        ],
      }),
  },
  {
    id: 'shelving',
    title: 'Стеллаж',
    note: '800 × 1800 × 350, открытые полки',
    make: () =>
      createProject({
        name: 'Стеллаж',
        width: 800,
        height: 1800,
        depth: 350,
        plinth: 0,
        hardware: { handle: 'none', hinge: 'hinge-soft', slide: 'slide-ball' },
        columns: [{ ...DEFAULT_COLUMN, front: 'open', shelves: 5 }],
      }),
  },
];

const clamp = (v, [min, max]) => Math.min(max, Math.max(min, v));

// Число из любого значения: мусор превращается в запасное
function num(value, fallback) {
  const v = Number(value);
  return Number.isFinite(v) ? Math.round(v) : fallback;
}

// Сколько секций помещается в такую ширину
export function maxColumns(width) {
  return clamp(Math.floor(width / MIN_CELL_WIDTH), LIMITS.columns);
}

function normalizeColumn(raw, base) {
  const c = { ...DEFAULT_COLUMN, ...base, ...(raw || {}) };
  return {
    front: FRONT_TYPES.includes(c.front) ? c.front : DEFAULT_COLUMN.front,
    hinge: c.hinge === 'right' ? 'right' : 'left',
    shelves: clamp(num(c.shelves, 0), LIMITS.shelves),
    drawers: clamp(num(c.drawers, 3), LIMITS.drawers),
  };
}

// Возвращает новый проект с допустимыми значениями. Каталог нужен, чтобы заменить удалённые материалы.
export function normalizeProject(raw, catalog) {
  const base = createProject();
  const src = raw || {};

  const width = clamp(num(src.width, base.width), LIMITS.width);
  const height = clamp(num(src.height, base.height), LIMITS.height);
  const depth = clamp(num(src.depth, base.depth), LIMITS.depth);

  let plinth = clamp(num(src.plinth, base.plinth), LIMITS.plinth);
  if (plinth > 0 && plinth < MIN_PLINTH) plinth = MIN_PLINTH;
  // ножки не могут быть выше самой тумбы
  plinth = Math.min(plinth, Math.floor(height / 3));
  if (plinth > 0 && plinth < MIN_PLINTH) plinth = 0;

  const rawColumns = Array.isArray(src.columns) && src.columns.length ? src.columns : base.columns;
  const columns = rawColumns.slice(0, maxColumns(width)).map((c) => normalizeColumn(c));

  // Выбор из каталога: если записи больше нет, берём значение по умолчанию
  const pick = (value, find, fallback) => (find(catalog, value) ? value : fallback);
  const m = src.materials || {};
  const e = src.edging || {};
  const h = src.hardware || {};

  return {
    id: typeof src.id === 'string' && src.id ? src.id : newId(),
    name: String(src.name || base.name).slice(0, 80),
    width,
    height,
    depth,
    plinth,
    materials: {
      carcass: pick(m.carcass, findSheet, base.materials.carcass),
      front: pick(m.front, findSheet, base.materials.front),
      back: pick(m.back, findSheet, base.materials.back),
      drawer: pick(m.drawer, findSheet, base.materials.drawer),
    },
    edging: {
      carcass: pick(e.carcass, findEdge, base.edging.carcass),
      front: pick(e.front, findEdge, base.edging.front),
    },
    hardware: {
      handle: pick(h.handle, findHandle, base.hardware.handle),
      hinge: pick(h.hinge, findHinge, base.hardware.hinge),
      slide: pick(h.slide, findSlide, base.hardware.slide),
    },
    columns,
    updatedAt: num(src.updatedAt, Date.now()),
  };
}

// Глубокая копия без общих ссылок
export const cloneProject = (p) => JSON.parse(JSON.stringify(p));
