// Форматирование чисел для интерфейса, чертежей и таблиц

const nbsp = '\u00A0';

// Размеры в мм: целые без хвоста, дробные с одним знаком
export function mmText(v) {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

// 1234567 -> «1 234 567 ₸»
export function money(v) {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, nbsp) + nbsp + '₸';
}

export function plainNumber(v, digits = 1) {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return String(r).replace('.', ',');
}

export function percent(v) {
  return Math.round(v * 100) + '%';
}

export function dateText(ts = Date.now()) {
  return new Date(ts).toLocaleDateString('ru-RU');
}

// Кромка в спецификации: «Д 1 · Ш 0» → понятнее словами
export function edgeText(row) {
  if (!row.edgeL && !row.edgeW) return '—';
  const parts = [];
  if (row.edgeL) parts.push(`${row.edgeL} по длине`);
  if (row.edgeW) parts.push(`${row.edgeW} по ширине`);
  return parts.join(', ');
}
