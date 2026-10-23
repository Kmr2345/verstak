// Смета: листы, кромка, фурнитура, работа и наценка.
// Листы считаем целиком, как их придётся купить.

import { findEdge, sheetTitle } from './lookup.js';

const round = (v) => Math.round(v);

export function estimateCost({ cutting, spec, hardware, catalog, settings, edging }) {
  const lines = [];

  // Листовые материалы
  for (const m of cutting.materials) {
    if (!m.sheets.length) continue;
    lines.push({
      group: 'Материалы',
      name: sheetTitle(m.material),
      qty: m.sheets.length,
      unit: 'лист',
      price: m.material.price,
      sum: round(m.sheets.length * m.material.price),
    });
  }

  // Кромка: метры по каждому типу плюс запас
  const edgeMeters = new Map();
  for (const row of spec.rows) {
    if (!row.edgeId) continue;
    edgeMeters.set(row.edgeId, (edgeMeters.get(row.edgeId) || 0) + (row.edgeLength * row.qty) / 1000);
  }
  for (const [id, meters] of edgeMeters) {
    const edge = findEdge(catalog, id);
    if (!edge) continue;
    const total = meters * (1 + settings.edgeReserve / 100);
    lines.push({
      group: 'Кромка',
      name: `Кромка ${edge.name}`,
      qty: Math.round(total * 10) / 10,
      unit: 'м',
      price: edge.price,
      sum: round(total * edge.price),
    });
  }

  // Фурнитура
  for (const h of hardware) {
    lines.push({ group: 'Фурнитура', name: h.name, qty: h.qty, unit: h.unit, price: h.price, sum: round(h.qty * h.price) });
  }

  // Работа
  const partCount = spec.rows.reduce((s, r) => s + r.qty, 0);
  lines.push({
    group: 'Работа',
    name: 'Раскрой, кромление, присадка, сборка',
    qty: partCount,
    unit: 'дет.',
    price: settings.laborPerPart,
    sum: round(partCount * settings.laborPerPart),
  });

  const sumOf = (group) => lines.filter((l) => l.group === group).reduce((s, l) => s + l.sum, 0);
  const subtotal = lines.reduce((s, l) => s + l.sum, 0);
  const margin = round((subtotal * settings.margin) / 100);

  return {
    lines,
    groups: {
      Материалы: sumOf('Материалы'),
      Кромка: sumOf('Кромка'),
      Фурнитура: sumOf('Фурнитура'),
      Работа: sumOf('Работа'),
    },
    subtotal,
    margin,
    total: subtotal + margin,
  };
}
