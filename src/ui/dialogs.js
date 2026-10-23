// Окна: «Проекты» (шаблоны, сохранённые, импорт) и «Каталог и цены»

import { el } from './dom.js';
import { icon } from './icons.js';
import { TEMPLATES } from '../core/project.js';
import { sheetTitle } from '../core/lookup.js';
import { dateText, mmText } from '../core/format.js';
import { toast } from './toast.js';

function dialogHead(title, dialog) {
  return el('div', { class: 'dialog__head' }, el('h2', {}, title), el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Закрыть', onClick: () => dialog.close() }, icon('close')));
}

function wire(dialog) {
  // клик по затемнению закрывает окно
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

// ---------- Проекты ----------

export function createProjectsDialog(dialog, ctx) {
  wire(dialog);
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (ctx.importJson(await file.text())) dialog.close();
  });

  function render() {
    const currentId = ctx.currentId();
    const saved = ctx.listProjects();

    const templates = el(
      'div',
      { class: 'templates' },
      TEMPLATES.map((t) =>
        el('button', { class: 'template', type: 'button', onClick: () => (ctx.newFromTemplate(t), dialog.close()) }, el('b', {}, t.title), el('small', {}, t.note))
      )
    );

    const list = saved.length
      ? el(
          'ul',
          { class: 'plist' },
          saved.map((p) =>
            el(
              'li',
              { class: p.id === currentId ? 'is-current' : '' },
              el('button', { class: 'plist__name', type: 'button', onClick: () => (ctx.openProject(p.id), dialog.close()) }, el('b', {}, p.name), el('small', {}, `${mmText(p.width)} × ${mmText(p.height)} × ${mmText(p.depth)} · ${dateText(p.updatedAt)}`)),
              el('button', { class: 'btn btn--icon', type: 'button', title: 'Дублировать', 'aria-label': `Дублировать ${p.name}`, onClick: () => (ctx.duplicate(p.id), render()) }, icon('copy')),
              el('button', { class: 'btn btn--icon btn--danger', type: 'button', title: 'Удалить', 'aria-label': `Удалить ${p.name}`, onClick: () => confirm(`Удалить проект «${p.name}»?`) && (ctx.remove(p.id), render()) }, icon('trash'))
            )
          )
        )
      : el('p', { class: 'note' }, 'Пока пусто. Проект сохраняется сам, как только вы начнёте работать.');

    dialog.replaceChildren(
      dialogHead('Проекты', dialog),
      el(
        'div',
        { class: 'dialog__body' },
        el('section', {}, el('h3', {}, 'Новый проект из шаблона'), templates),
        el('section', {}, el('h3', {}, 'Сохранённые в этом браузере'), list),
        el(
          'section',
          {},
          el('h3', {}, 'Файл'),
          el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, el('button', { class: 'btn btn--line', type: 'button', onClick: ctx.exportJson }, icon('download'), 'Скачать проект'), el('button', { class: 'btn btn--line', type: 'button', onClick: () => fileInput.click() }, icon('plus'), 'Загрузить из файла'), fileInput)
        )
      )
    );
  }

  return {
    open() {
      render();
      dialog.showModal();
    },
  };
}

// ---------- Каталог и цены ----------

export function createCatalogDialog(dialog, ctx) {
  wire(dialog);
  const { library } = ctx;

  const priceInput = (id, value) => {
    const input = el('input', { type: 'number', min: 0, step: 50, value, 'aria-label': 'Цена, ₸' });
    input.addEventListener('change', () => {
      library.setPrice(id, input.value);
      input.value = library.priceOf(id);
    });
    return input;
  };

  const priceRows = (items, describe) =>
    items.map((item) => el('tr', {}, el('td', {}, item.name, describe ? el('small', {}, describe(item)) : null), el('td', { class: 'r' }, priceInput(item.id, item.price)), el('td', { class: 'r' }, item.custom ? el('button', { class: 'btn btn--icon btn--danger', type: 'button', 'aria-label': `Удалить ${item.name}`, onClick: () => (library.removeSheet(item.id), ctx.onCatalogChange(), render()) }, icon('trash')) : '')));

  const priceTable = (title, items, describe) =>
    el('section', {}, el('h3', {}, title), el('table', { class: 'data price-table' }, el('tbody', {}, priceRows(items, describe))));

  const settingInput = (key, label, min, max, step = 1) => {
    const input = el('input', { type: 'number', min, max, step, value: library.settings[key] });
    input.addEventListener('change', () => {
      const v = Math.min(max, Math.max(min, Number(input.value) || 0));
      input.value = v;
      library.updateSettings({ [key]: v });
    });
    return el('label', {}, label, input);
  };

  function render() {
    const c = library.catalog;

    // форма нового материала
    const f = {
      name: el('input', { type: 'text', placeholder: 'Например, ЛДСП Дуб Крафт' }),
      kind: el('select', {}, ['ЛДСП', 'МДФ', 'ХДФ'].map((k) => el('option', { value: k }, k))),
      thickness: el('input', { type: 'number', value: 18, min: 1, max: 60, step: 1 }),
      length: el('input', { type: 'number', value: 2800, min: 500, step: 10 }),
      width: el('input', { type: 'number', value: 2070, min: 500, step: 10 }),
      price: el('input', { type: 'number', value: 15000, min: 0, step: 100 }),
      color: el('input', { type: 'color', value: '#d8d4cc' }),
      pattern: el('select', {}, el('option', { value: 'plain' }, 'Однотонный'), el('option', { value: 'wood' }, 'Дерево (с текстурой)')),
    };
    const error = el('p', { class: 'form-error', hidden: true });
    const add = () => {
      const res = library.addSheet(Object.fromEntries(Object.entries(f).map(([k, input]) => [k, input.value])));
      if (res.error) {
        error.textContent = res.error;
        error.hidden = false;
        return;
      }
      toast(`Материал «${res.sheet.name}» добавлен`);
      ctx.onCatalogChange();
      render();
    };

    const field = (label, input) => el('label', {}, label, input);

    dialog.replaceChildren(
      dialogHead('Каталог и цены', dialog),
      el(
        'div',
        { class: 'dialog__body' },
        el('p', { class: 'note' }, 'Цены в тенге. Изменения сохраняются в этом браузере и сразу попадают в смету.'),
        priceTable('Листовые материалы, цена за лист', c.sheets.map((s) => ({ ...s, name: sheetTitle(s) })), (s) => `${s.sheet[0]} × ${s.sheet[1]} мм${s.grain ? ', с текстурой' : ''}`),
        el(
          'section',
          {},
          el('h3', {}, 'Свой листовой материал'),
          el('div', { class: 'form-grid' }, field('Название', f.name), field('Тип', f.kind), field('Толщина, мм', f.thickness), field('Длина листа, мм', f.length), field('Ширина листа, мм', f.width), field('Цена за лист, ₸', f.price), field('Цвет', f.color), field('Вид', f.pattern)),
          error,
          el('button', { class: 'btn btn--line', type: 'button', style: 'margin-top:10px', onClick: add }, icon('plus'), 'Добавить материал')
        ),
        priceTable('Кромка, цена за метр', c.edges),
        priceTable('Петли и направляющие', [...c.hinges, ...c.slides]),
        priceTable('Ручки и крепёж', [...c.handles.filter((h) => h.id !== 'none'), c.leg, c.confirmat, c.shelfPin]),
        el(
          'section',
          {},
          el('h3', {}, 'Расчёт'),
          el('div', { class: 'form-grid' }, settingInput('kerf', 'Пропил пилы, мм', 0, 10), settingInput('trim', 'Подрезка листа, мм', 0, 30), settingInput('edgeReserve', 'Запас кромки, %', 0, 30), settingInput('laborPerPart', 'Работа за деталь, ₸', 0, 100000, 50), settingInput('margin', 'Наценка, %', 0, 300))
        ),
        el('section', {}, el('button', { class: 'btn btn--line btn--danger', type: 'button', onClick: () => confirm('Вернуть цены из каталога по умолчанию? Свои материалы останутся.') && (library.resetPrices(), render()) }, 'Сбросить цены'))
      )
    );
  }

  return {
    open() {
      render();
      dialog.showModal();
    },
  };
}
