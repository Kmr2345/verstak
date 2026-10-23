// Скачивание файлов: PDF-чертёж, DXF, CSV, PNG и JSON проекта

import { buildAllPages, buildViewsDrawing, buildCuttingSheet, chooseScale } from '../drawing/sheets.js';
import { itemsToDxf } from '../drawing/renderDxf.js';
import { renderPdf } from '../drawing/renderPdf.js';
import { specToCsv } from './csv.js';
import { translate } from '../drawing/layers.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Имя файла из названия проекта: без символов, которые ломают файловую систему
export function safeName(name) {
  return String(name || 'проект').replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-') || 'проект';
}

function toBase64(buffer) {
  let bin = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function loadFont(file) {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  if (!res.ok) throw new Error('Не удалось загрузить шрифт для PDF');
  return toBase64(await res.arrayBuffer());
}

export async function exportPdf(model) {
  const [{ jsPDF }, regular, bold] = await Promise.all([
    import('jspdf'),
    loadFont('IBMPlexSans-Regular.ttf'),
    loadFont('IBMPlexSans-SemiBold.ttf'),
  ]);
  const doc = renderPdf(jsPDF, buildAllPages(model), { regular, bold }, { title: model.project.name });
  downloadBlob(doc.output('blob'), `${safeName(model.project.name)}.pdf`);
}

// Виды в натуральную величину 1:1, подписи увеличены по масштабу листа
export function viewsDxf(model) {
  const den = chooseScale(model, 375, 232);
  const drawing = buildViewsDrawing(model, { scale: 1, ann: den });
  return itemsToDxf(drawing.items, drawing.height);
}

// Листы раскроя в натуральную величину, друг под другом
export function cuttingDxf(model) {
  const items = [];
  let y = 0;
  for (const mat of model.cutting.materials) {
    for (const sheet of mat.sheets) {
      const d = buildCuttingSheet(mat, sheet, { scale: 1, ann: 10 });
      items.push(...translate(d.items, 0, y));
      y += d.height + 300;
    }
  }
  return itemsToDxf(items, y);
}

const textBlob = (text, type) => new Blob([text], { type: `${type};charset=utf-8` });

export const exportViewsDxf = (model) => downloadBlob(textBlob(viewsDxf(model), 'application/dxf'), `${safeName(model.project.name)}-виды.dxf`);
export const exportCuttingDxf = (model) => downloadBlob(textBlob(cuttingDxf(model), 'application/dxf'), `${safeName(model.project.name)}-раскрой.dxf`);
export const exportCsv = (model) => downloadBlob(textBlob(specToCsv(model), 'text/csv'), `${safeName(model.project.name)}-спецификация.csv`);
export const exportJson = (text, name) => downloadBlob(textBlob(text, 'application/json'), `${safeName(name)}.json`);
