// Спецификация в CSV: разделитель «;» и BOM, чтобы Excel сразу открыл русский текст

import { sheetTitle, findEdge } from '../core/lookup.js';

const cell = (v) => {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function specToCsv(model) {
  const lines = [];
  const row = (...cells) => lines.push(cells.map(cell).join(';'));

  row('№', 'Наименование', 'Материал', 'Длина, мм', 'Ширина, мм', 'Толщина, мм', 'Кол-во', 'Кромка по длине', 'Кромка по ширине', 'Тип кромки');
  for (const r of model.spec.rows) {
    const mat = model.catalog.sheets.find((m) => m.id === r.materialId);
    row(r.no, r.name, mat ? sheetTitle(mat) : r.materialId, r.length, r.width, r.thickness, r.qty, r.edgeL, r.edgeW, r.edgeId ? findEdge(model.catalog, r.edgeId)?.name : '');
  }

  lines.push('');
  row('Фурнитура', 'Кол-во', 'Ед.');
  for (const h of model.hardware) row(h.name, h.qty, h.unit);

  return '\uFEFF' + lines.join('\r\n');
}
