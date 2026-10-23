import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { jsPDF } from 'jspdf';

import { defaultCatalog, DEFAULT_SETTINGS } from '../src/data/catalog.js';
import { normalizeProject, TEMPLATES } from '../src/core/project.js';
import { buildModel } from '../src/core/model.js';
import { buildAllPages, buildViewsDrawing, chooseScale } from '../src/drawing/sheets.js';
import { itemsToSvg } from '../src/drawing/renderSvg.js';
import { itemsToDxf } from '../src/drawing/renderDxf.js';
import { renderPdf } from '../src/drawing/renderPdf.js';
import { visibleSegments, collectBoxes } from '../src/drawing/views.js';
import { specToCsv } from '../src/export/csv.js';

const catalog = defaultCatalog();
const modelOf = (tpl) => buildModel(normalizeProject(tpl.make(), catalog), catalog, { ...DEFAULT_SETTINGS });

test('вид спереди закрытой тумбы: видны только фасад и цоколь', () => {
  const m = modelOf(TEMPLATES[0]);
  const segs = visibleSegments(collectBoxes(m), 'front');
  // внутренние полки и задняя стенка за дверью не рисуются
  const insideDoor = segs.filter((s) => s.v0 > 120 && s.v1 < 880 && Math.abs(s.u0) < 250 && Math.abs(s.u1) < 250 && s.v0 === s.v1);
  assert.equal(insideDoor.length, 0);
  assert.ok(segs.length >= 8);
});

test('масштаб подбирается так, чтобы виды влезли', () => {
  const small = modelOf(TEMPLATES[0]);
  const big = modelOf(TEMPLATES[2]);
  assert.ok(chooseScale(small, 375, 232) < chooseScale(big, 375, 232));
});

test('все страницы собираются для каждого шаблона', () => {
  for (const tpl of TEMPLATES) {
    const m = modelOf(tpl);
    const pages = buildAllPages(m);
    assert.ok(pages.length >= 4, tpl.id);
    for (const p of pages) assert.ok(p.items.length > 20);
    const svg = itemsToSvg(pages[0].items, pages[0].width, pages[0].height, { paper: true });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  }
});

test('DXF: структура и русский текст в виде \\U+', () => {
  const m = modelOf(TEMPLATES[1]);
  const d = buildViewsDrawing(m, { scale: 1, ann: 5 });
  const dxf = itemsToDxf(d.items, d.height);
  assert.ok(dxf.includes('ENTITIES') && dxf.trim().endsWith('EOF'));
  assert.ok(dxf.includes('\\U+0412')); // «В» из «Вид спереди»
  assert.ok(!/[\u0400-\u04FF]/.test(dxf), 'в файле не должно остаться «сырой» кириллицы');
  fs.writeFileSync('/tmp/test-views.dxf', dxf);
});

test('PDF: собирается и содержит кириллицу', () => {
  const m = modelOf(TEMPLATES[1]);
  const read = (f) => fs.readFileSync(new URL(`../public/fonts/${f}`, import.meta.url)).toString('base64');
  const doc = renderPdf(jsPDF, buildAllPages(m), { regular: read('IBMPlexSans-Regular.ttf'), bold: read('IBMPlexSans-SemiBold.ttf') });
  const bytes = Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  fs.writeFileSync('/tmp/test-out.pdf', bytes);
});

test('CSV: BOM, разделитель и строки', () => {
  const csv = specToCsv(modelOf(TEMPLATES[0]));
  assert.ok(csv.startsWith('\uFEFF№;Наименование'));
  assert.ok(csv.includes('Боковина'));
});
