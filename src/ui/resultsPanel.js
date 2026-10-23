// Правая панель: проверки конструкции, спецификация, раскрой и смета

import { el } from './dom.js';
import { money, mmText, plainNumber, percent } from '../core/format.js';
import { specTotals } from '../core/spec.js';
import { sheetTitle, findEdge } from '../core/lookup.js';
import { buildCuttingSheet } from '../drawing/sheets.js';
import { itemsToSvg } from '../drawing/renderSvg.js';

const TABS = [
  { id: 'spec', label: 'Детали' },
  { id: 'cut', label: 'Раскрой' },
  { id: 'cost', label: 'Смета' },
];

export function createResultsPanel(host, ctx) {
  let tab = 'spec';
  let model = null;

  const tabButtons = TABS.map((t) =>
    el('button', { type: 'button', role: 'tab', onClick: () => ((tab = t.id), render(model)) }, t.label)
  );
  const tabs = el('div', { class: 'results__tabs' }, el('div', { class: 'seg seg--full', role: 'tablist' }, tabButtons));
  const checks = el('details', { class: 'checks' });
  const body = el('div', { class: 'results__body' });
  const total = el('div', { class: 'results__total' });
  host.append(tabs, el('div', { style: 'padding-top:10px;flex:none' }, checks), body, total);

  // ---------- замечания ----------
  function renderChecks() {
    const list = model.warnings;
    const hasError = list.some((w) => w.level === 'error');
    checks.className = 'checks' + (hasError ? ' checks--error' : list.length ? '' : ' checks--ok');
    checks.open = hasError;
    if (!list.length) {
      checks.replaceChildren(el('summary', { style: 'list-style:none;cursor:default' }, 'Проверка конструкции: замечаний нет'));
      return;
    }
    const word = list.length === 1 ? 'замечание' : list.length < 5 ? 'замечания' : 'замечаний';
    checks.replaceChildren(el('summary', {}, `Проверка конструкции: ${list.length} ${word}`), el('ul', {}, list.map((w) => el('li', {}, w.text))));
  }

  // ---------- спецификация ----------
  function renderSpec() {
    const { rows } = model.spec;
    const t = specTotals(rows);
    const stats = el(
      'div',
      { class: 'stats' },
      el('span', {}, 'Деталей ', el('b', {}, t.count)),
      el('span', {}, 'Площадь ', el('b', {}, plainNumber(t.area, 2)), ' м²'),
      el('span', {}, 'Кромка ', el('b', {}, plainNumber(t.edge, 1)), ' м')
    );

    const table = el(
      'table',
      { class: 'data' },
      el('thead', {}, el('tr', {}, el('th', {}, '№'), el('th', {}, 'Деталь'), el('th', { class: 'r' }, 'Длина × ширина'), el('th', { class: 'r' }, 'Шт'), el('th', { class: 'r', title: 'Кромка по длине / по ширине' }, 'Кромка'))),
      el(
        'tbody',
        {},
        rows.map((r) => {
          const mat = model.catalog.sheets.find((m) => m.id === r.materialId);
          const edge = r.edgeId ? findEdge(model.catalog, r.edgeId) : null;
          return el(
            'tr',
            {},
            el('td', { class: 'r' }, r.no),
            el('td', {}, r.name, el('small', {}, sheetTitle(mat))),
            el('td', { class: 'r' }, `${mmText(r.length)} × ${mmText(r.width)}`),
            el('td', { class: 'r' }, r.qty),
            el('td', { class: 'r', title: edge ? `${edge.name}: по длине ${r.edgeL}, по ширине ${r.edgeW}` : 'без кромки' }, edge ? `${r.edgeL} / ${r.edgeW}` : '—')
          );
        })
      )
    );

    const hw = el(
      'table',
      { class: 'data', style: 'margin-top:16px' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Фурнитура'), el('th', { class: 'r' }, 'Кол-во'))),
      el('tbody', {}, model.hardware.map((h) => el('tr', {}, el('td', {}, h.name), el('td', { class: 'r' }, `${h.qty} ${h.unit}`))))
    );

    body.replaceChildren(stats, table, hw, el('p', { class: 'note' }, 'Кромка: число сторон по длине / по ширине детали. Размеры чистовые, без припусков.'));
  }

  // ---------- раскрой ----------
  function renderCutting() {
    const nodes = [];
    for (const mat of model.cutting.materials) {
      nodes.push(
        el('div', { class: 'mat-head' }, el('span', {}, sheetTitle(mat.material)), el('small', {}, `${mat.sheets.length} лист. · заполнено ${percent(mat.efficiency)}`)),
        el('small', { class: 'note', style: 'display:block;margin:-2px 0 8px' }, `Лист ${mat.material.sheet[0]} × ${mat.material.sheet[1]} мм${mat.material.grain ? ', текстура вдоль листа' : ''}`)
      );
      for (const sheet of mat.sheets) {
        const d = buildCuttingSheet(mat, sheet, { scale: 0.1, ann: 3 });
        const card = el('div', { class: 'sheet-card' }, el('small', {}, `Лист ${sheet.index} · ${sheet.placements.length} дет.`));
        card.insertAdjacentHTML('beforeend', itemsToSvg(d.items, d.width, d.height));
        nodes.push(card);
      }
    }
    nodes.push(el('p', { class: 'note' }, `Пропил ${model.settings.kerf} мм, подрезка кромки листа ${model.settings.trim} мм. Красная линия — кромка. Это расчёт расхода листов, для станка проверьте раскрой в своей программе.`));
    body.replaceChildren(...nodes);
  }

  // ---------- смета ----------
  function renderCost() {
    const { cost } = model;
    const rows = [];
    let last = null;
    for (const l of cost.lines) {
      if (l.group !== last) {
        rows.push(el('tr', { class: 'group' }, el('td', {}, l.group), el('td', { class: 'r' }, money(cost.groups[l.group]))));
        last = l.group;
      }
      rows.push(el('tr', {}, el('td', {}, l.name, el('small', {}, `${plainNumber(l.qty)} ${l.unit} × ${money(l.price)}`)), el('td', { class: 'r' }, money(l.sum))));
    }
    rows.push(el('tr', { class: 'sum' }, el('td', {}, 'Итого'), el('td', { class: 'r' }, money(cost.subtotal))));
    rows.push(el('tr', {}, el('td', {}, `Наценка ${model.settings.margin}%`), el('td', { class: 'r' }, money(cost.margin))));

    const link = el('button', { class: 'linklike', type: 'button', onClick: () => ctx.openCatalog() }, 'Каталог и цены');
    body.replaceChildren(
      el('table', { class: 'data' }, el('tbody', {}, rows)),
      el('p', { class: 'note' }, 'Цены ориентировочные. Листы считаются целиком по карте раскроя. Свои цены и наценку задайте в окне «', link, '».')
    );
  }

  function render(next) {
    if (next) model = next;
    if (!model) return;
    tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(TABS[i].id === tab)));
    renderChecks();
    ({ spec: renderSpec, cut: renderCutting, cost: renderCost })[tab]();

    total.replaceChildren(
      el('small', {}, `К оплате, наценка ${model.settings.margin}%`),
      el('strong', {}, money(model.cost.total))
    );
  }

  return { render };
}
