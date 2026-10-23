import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultCatalog, DEFAULT_SETTINGS } from '../src/data/catalog.js';
import { createProject, normalizeProject, TEMPLATES } from '../src/core/project.js';
import { buildModel } from '../src/core/model.js';
import { panelDims } from '../src/core/spec.js';
import { parseDims } from '../src/core/parseDims.js';

const catalog = defaultCatalog();
const settings = { ...DEFAULT_SETTINGS };
const model = (project) => buildModel(normalizeProject(project, catalog), catalog, settings);

test('parseDims: разные записи размеров', () => {
  assert.deepEqual(parseDims('600x800x400'), { width: 600, height: 800, depth: 400 });
  assert.deepEqual(parseDims('600 * 800 × 400'), { width: 600, height: 800, depth: 400 });
  assert.deepEqual(parseDims('ш900 в2100 г550'), { width: 900, height: 2100, depth: 550 });
  assert.deepEqual(parseDims('в1200'), { height: 1200 });
  assert.equal(parseDims('600x800'), null);
  assert.equal(parseDims('abc'), null);
  assert.equal(parseDims(''), null);
});

test('normalizeProject: приводит значения к допустимым', () => {
  const p = normalizeProject({ width: 99999, height: 'abc', depth: -5, plinth: 10, columns: [] }, catalog);
  assert.equal(p.width, 3000);
  assert.equal(p.height, 800);
  assert.equal(p.depth, 200);
  assert.equal(p.plinth, 30);
  assert.equal(p.columns.length, 1);
});

test('normalizeProject: число секций ограничено шириной', () => {
  const cols = Array.from({ length: 6 }, () => ({ front: 'door' }));
  assert.equal(normalizeProject({ width: 600, columns: cols }, catalog).columns.length, 3);
  assert.equal(normalizeProject({ width: 1400, columns: cols }, catalog).columns.length, 6);
});

test('normalizeProject: неизвестный материал заменяется', () => {
  const p = normalizeProject({ materials: { carcass: 'нет-такого' } }, catalog);
  assert.equal(p.materials.carcass, 'ldsp-white-18');
});

test('все детали лежат внутри габаритов изделия', () => {
  for (const tpl of TEMPLATES) {
    const m = model(tpl.make());
    const { width: W, height: H, depth: D } = m.project;
    for (const p of m.parts) {
      const [sx, sy, sz] = p.size;
      const [x, y, z] = p.pos;
      const eps = 0.51;
      assert.ok(x - sx / 2 >= -W / 2 - eps && x + sx / 2 <= W / 2 + eps, `${tpl.id}/${p.id}: выход по ширине`);
      assert.ok(y - sy / 2 >= -eps && y + sy / 2 <= H + eps, `${tpl.id}/${p.id}: выход по высоте`);
      assert.ok(z - sz / 2 >= -D / 2 - eps && z + sz / 2 <= D / 2 + eps, `${tpl.id}/${p.id}: выход по глубине`);
    }
  }
});

test('тумба по умолчанию: состав деталей', () => {
  const m = model(createProject());
  const count = (name) => m.parts.filter((p) => p.name === name).length;
  assert.equal(count('Боковина'), 2);
  assert.equal(count('Дно'), 1);
  assert.equal(count('Крышка'), 1);
  assert.equal(count('Дверь'), 1);
  assert.equal(count('Задняя стенка'), 1);
  assert.equal(count('Цоколь'), 1);
  assert.equal(count('Полка'), 1);
  assert.equal(m.units.length, 1);
});

test('боковины склеиваются в одну строку спецификации', () => {
  const m = model(createProject());
  const side = m.spec.rows.find((r) => r.name === 'Боковина');
  assert.equal(side.qty, 2);
  // высота 800, ножки 100: боковина 700 × 382 (глубина 400 минус фасад 18)
  assert.equal(side.length, 700);
  assert.equal(side.width, 382);
  assert.equal(side.thickness, 18);
  // кромка по одной длинной стороне
  assert.equal(side.edgeL, 1);
  assert.equal(side.edgeW, 0);
});

test('panelDims: кромка по длине и по ширине', () => {
  const door = { axis: 'z', size: [596, 698, 18], edges: ['top', 'bottom', 'left', 'right'] };
  const d = panelDims(door);
  assert.equal(d.length, 698);
  assert.equal(d.width, 596);
  assert.equal(d.edgeL, 2);
  assert.equal(d.edgeW, 2);
  assert.equal(d.edgeLength, 2 * 698 + 2 * 596);
});

test('ящики: у комода есть коробки, направляющие и ручки', () => {
  const dresser = TEMPLATES.find((t) => t.id === 'dresser').make();
  const m = model(dresser);
  assert.equal(m.units.filter((u) => u.kind === 'drawer').length, 4);
  assert.equal(m.parts.filter((p) => p.name === 'Бок ящика').length, 8);
  assert.equal(m.parts.filter((p) => p.name === 'Дно ящика').length, 4);
  const slides = m.hardware.find((h) => h.id === 'slide-ball');
  assert.equal(slides.qty, 4);
  assert.equal(m.fixtures.filter((f) => f.kind === 'handle').length, 4);
});

test('раскрой: все детали размещены, без пересечений и в пределах листа', () => {
  for (const tpl of TEMPLATES) {
    const m = model(tpl.make());
    for (const mat of m.cutting.materials) {
      const [sheetL, sheetW] = mat.material.sheet;
      const trim = mat.trim;
      const placed = mat.sheets.flatMap((s) => s.placements);
      const expected = m.spec.rows.filter((r) => r.materialId === mat.material.id).reduce((s, r) => s + r.qty, 0);
      assert.equal(placed.length + mat.oversize.length, expected, `${tpl.id}: потеряны детали`);

      for (const sheet of mat.sheets) {
        const list = sheet.placements;
        for (const p of list) {
          assert.ok(p.x >= 0 && p.y >= 0, 'отрицательная координата');
          assert.ok(p.x + p.w <= sheetL - 2 * trim + 1e-6, `${tpl.id}: выход по длине`);
          assert.ok(p.y + p.h <= sheetW - 2 * trim + 1e-6, `${tpl.id}: выход по ширине`);
        }
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            assert.ok(!overlap, `${tpl.id}: детали пересекаются`);
          }
        }
      }
    }
  }
});

test('раскрой: текстурные материалы не поворачиваются', () => {
  const p = createProject({ materials: { carcass: 'ldsp-oak-18', front: 'ldsp-oak-18', back: 'hdf-white-3', drawer: 'ldsp-white-16' } });
  const m = model(p);
  const oak = m.cutting.materials.find((x) => x.material.id === 'ldsp-oak-18');
  for (const pl of oak.sheets.flatMap((s) => s.placements)) {
    assert.equal(pl.rotated, false);
    assert.equal(pl.w, pl.piece.length);
  }
});

test('деталь больше листа попадает в замечания', () => {
  const m = model(createProject({ width: 3000, height: 2700, depth: 600, plinth: 0 }));
  // боковина 2700 мм при листе 2800 − 2×10 = 2780 помещается, но крышка 2964 мм — нет
  assert.ok(m.warnings.some((w) => w.level === 'error' && w.text.includes('не помещается')));
});

test('смета: итоги сходятся', () => {
  const m = model(createProject());
  const sum = m.cost.lines.reduce((s, l) => s + l.sum, 0);
  assert.equal(sum, m.cost.subtotal);
  assert.equal(m.cost.total, m.cost.subtotal + m.cost.margin);
  assert.equal(Object.values(m.cost.groups).reduce((a, b) => a + b, 0), m.cost.subtotal);
  assert.ok(m.cost.total > 0);
});

test('замечания: широкая дверь и длинная полка', () => {
  const m = model(createProject({ width: 1000, columns: [{ front: 'door', shelves: 2 }] }));
  const texts = m.warnings.map((w) => w.text).join('\n');
  assert.match(texts, /Дверь шириной/);
  assert.match(texts, /пролёт полки/);
});

// ---- хранилище, история, ссылки ----
import { createStore } from '../src/core/store.js';
import { createStorage, encodeShare, decodeShare, shareCodeFromHash } from '../src/core/storage.js';
import { createLibrary } from '../src/core/library.js';

const memoryBackend = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('store: undo и redo, серия правок с одним key — один шаг', () => {
  const store = createStore(createProject(), (p) => normalizeProject(p, catalog));
  store.update((p) => (p.width = 700), { key: 'w' });
  store.update((p) => (p.width = 720), { key: 'w' });
  store.update((p) => (p.width = 740), { key: 'w' });
  assert.equal(store.state.width, 740);
  store.undo();
  assert.equal(store.state.width, 600);
  assert.ok(store.canRedo());
  store.redo();
  assert.equal(store.state.width, 740);
});

test('store: недопустимое значение подгоняется под границы', () => {
  const store = createStore(createProject(), (p) => normalizeProject(p, catalog));
  store.update((p) => (p.width = 99999));
  assert.equal(store.state.width, 3000);
});

test('storage: сохранение и список проектов', () => {
  const storage = createStorage(memoryBackend());
  const a = createProject({ name: 'A', updatedAt: 1 });
  const b = createProject({ name: 'B', updatedAt: 2 });
  storage.saveProject(a);
  storage.saveProject(b);
  storage.saveProject({ ...a, name: 'A2', updatedAt: 3 });
  const list = storage.listProjects();
  assert.deepEqual(list.map((p) => p.name), ['A2', 'B']);
  storage.deleteProject(a.id);
  assert.equal(storage.listProjects().length, 1);
});

test('ссылка: проект переживает кодирование вместе с кириллицей', () => {
  const p = createProject({ name: 'Тумба в прихожую', width: 750 });
  const code = encodeShare(p);
  assert.match(code, /^[\w-]+$/);
  const back = decodeShare(code);
  assert.equal(back.name, 'Тумба в прихожую');
  assert.equal(back.width, 750);
  assert.equal(shareCodeFromHash(`#p=${code}`), code);
  assert.equal(decodeShare('###'), null);
});

test('library: свои цены и материалы попадают в каталог', () => {
  const lib = createLibrary(createStorage(memoryBackend()));
  lib.setPrice('ldsp-white-18', 20000);
  assert.equal(lib.catalog.sheets.find((s) => s.id === 'ldsp-white-18').price, 20000);
  const res = lib.addSheet({ name: 'Мой дуб', thickness: 18, length: 2750, width: 1830, price: 25000, pattern: 'wood' });
  assert.ok(res.sheet);
  assert.ok(lib.catalog.sheets.some((s) => s.id === res.sheet.id));
  assert.ok(lib.addSheet({ name: '', thickness: 18, length: 2800, width: 2070, price: 1 }).error);
  lib.removeSheet(res.sheet.id);
  assert.ok(!lib.catalog.sheets.some((s) => s.id === res.sheet.id));
});
