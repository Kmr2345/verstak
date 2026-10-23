// Левая панель: быстрый ввод, размеры, секции, материалы и фурнитура.
// Поля создаются один раз; при изменении проекта их значения только обновляются (sync),
// поэтому фокус и курсор не теряются во время набора.

import { LIMITS } from '../config.js';
import { FRONT_TYPES, FRONT_LABELS, maxColumns } from '../core/project.js';
import { parseDims } from '../core/parseDims.js';
import { bodySheets, backSheets, sheetTitle } from '../core/lookup.js';
import { money, mmText } from '../core/format.js';
import { el } from './dom.js';
import { toast } from './toast.js';

const clamp = (v, [min, max]) => Math.min(max, Math.max(min, v));

function group(title, hint, ...children) {
  return el('section', { class: 'group' }, el('h2', { class: 'group__title' }, title, hint ? el('small', {}, hint) : null), ...children);
}

// Переключатель из нескольких вариантов
function segmented(options, onPick, full = true) {
  const buttons = options.map((o) => el('button', { type: 'button', 'aria-pressed': 'false', onClick: () => onPick(o.value) }, o.label));
  return {
    el: el('div', { class: 'seg' + (full ? ' seg--full' : '') }, buttons),
    set(value) {
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === value)));
    },
  };
}

function stepper({ min, max, onChange, label }) {
  const out = el('output', { 'aria-live': 'polite' }, '0');
  const dec = el('button', { type: 'button', 'aria-label': `${label}: меньше` }, '−');
  const inc = el('button', { type: 'button', 'aria-label': `${label}: больше` }, '+');
  let value = 0;
  let hi = max;
  dec.addEventListener('click', () => onChange(value - 1));
  inc.addEventListener('click', () => onChange(value + 1));
  return {
    el: el('div', { class: 'stepper' }, dec, out, inc),
    set(v, newMax = max) {
      value = v;
      hi = newMax;
      out.textContent = v;
      dec.disabled = v <= min;
      inc.disabled = v >= hi;
    },
  };
}

export function createParamsPanel(host, ctx) {
  const { store, library } = ctx;
  const syncs = [];
  const track = (control) => (syncs.push(control.sync), control.el);

  // ---------- быстрый ввод ----------
  const quickInput = el('input', {
    type: 'text',
    id: 'quickInput',
    placeholder: '600x800x400',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Быстрый ввод размеров: ширина, высота, глубина',
  });
  quickInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const dims = parseDims(quickInput.value);
    if (!dims) {
      quickInput.classList.remove('shake');
      void quickInput.offsetWidth; // перезапуск анимации
      quickInput.classList.add('shake');
      toast('Не понял размеры. Пример: 600x800x400 или ш900 в2100 г550', { error: true, ms: 3200 });
      return;
    }
    store.update((p) => Object.assign(p, dims));
    quickInput.value = '';
    quickInput.blur();
    toast(`Размеры: ${mmText(store.state.width)} × ${mmText(store.state.height)} × ${mmText(store.state.depth)} мм`);
  });
  const quick = group('Быстрый ввод', null, el('div', { class: 'quick' }, quickInput, el('small', {}, 'Ширина × высота × глубина в мм. Enter — применить. Клавиша / — фокус сюда.')));

  // ---------- размеры ----------
  function numberField({ label, key, limits, hint }) {
    const [min, max] = limits;
    const id = `f-${key}`;
    const input = el('input', { id, type: 'number', inputmode: 'numeric', min, max, step: 10 });
    const range = el('input', { type: 'range', min, max, step: 10, 'aria-label': `${label}, ползунок` });
    const root = el('div', { class: 'field' }, el('label', { for: id }, label), input, range, el('small', {}, hint ?? `${min}–${max} мм`));

    const commit = (v) => store.update((p) => (p[key] = v), { key });

    input.addEventListener('input', () => {
      const v = Number(input.value);
      const ok = input.value !== '' && Number.isFinite(v) && v >= min && v <= max;
      input.classList.toggle('invalid', !ok);
      if (ok) commit(Math.round(v));
    });
    input.addEventListener('change', () => {
      const raw = Number(input.value);
      const v = input.value === '' || !Number.isFinite(raw) ? store.state[key] : clamp(Math.round(raw), limits);
      commit(v);
      input.value = store.state[key];
      input.classList.remove('invalid');
    });
    range.addEventListener('input', () => commit(Number(range.value)));

    return {
      el: root,
      sync({ project }) {
        if (document.activeElement !== input) {
          input.value = project[key];
          input.classList.remove('invalid');
        }
        range.value = project[key];
      },
    };
  }

  const dims = group(
    'Размеры, мм',
    null,
    track(numberField({ label: 'Ширина', key: 'width', limits: LIMITS.width })),
    track(numberField({ label: 'Высота', key: 'height', limits: LIMITS.height })),
    track(numberField({ label: 'Глубина', key: 'depth', limits: LIMITS.depth, hint: 'вместе с фасадом, 200–1000 мм' }))
  );

  // ---------- конструкция ----------
  const columnsStepper = stepper({
    min: LIMITS.columns[0],
    max: LIMITS.columns[1],
    label: 'Секций',
    onChange: (n) =>
      store.update((p) => {
        while (p.columns.length < n) p.columns.push({ ...p.columns[p.columns.length - 1] });
        p.columns.length = Math.min(p.columns.length, n);
      }),
  });

  const construction = group(
    'Конструкция',
    null,
    track(numberField({ label: 'Ножки или цоколь', key: 'plinth', limits: LIMITS.plinth, hint: '0 — на полу, иначе от 30 мм' })),
    el('div', { class: 'row' }, el('span', {}, 'Секций по ширине'), columnsStepper.el)
  );
  syncs.push(({ project }) => columnsStepper.set(project.columns.length, maxColumns(project.width)));

  // ---------- секции ----------
  const cardsHost = el('div');
  let cards = [];

  function columnCard(index) {
    const edit = (fn) => store.update((p) => fn(p.columns[index]));
    const width = el('small', { class: 'num' });
    const front = segmented(FRONT_TYPES.map((value) => ({ value, label: FRONT_LABELS[value] })), (v) => edit((c) => (c.front = v)));
    const hinge = segmented([{ value: 'left', label: 'Слева' }, { value: 'right', label: 'Справа' }], (v) => edit((c) => (c.hinge = v)), false);
    const drawers = stepper({ min: LIMITS.drawers[0], max: LIMITS.drawers[1], label: 'Ящиков', onChange: (n) => edit((c) => (c.drawers = n)) });
    const shelves = stepper({ min: LIMITS.shelves[0], max: LIMITS.shelves[1], label: 'Полок', onChange: (n) => edit((c) => (c.shelves = n)) });

    const hingeRow = el('div', { class: 'row' }, el('span', {}, 'Петли'), hinge.el);
    const drawersRow = el('div', { class: 'row' }, el('span', {}, 'Ящиков'), drawers.el);
    const shelvesRow = el('div', { class: 'row' }, el('span', {}, 'Полок'), shelves.el);

    return {
      el: el('div', { class: 'col-card' }, el('div', { class: 'col-card__head' }, el('span', {}, `Секция ${index + 1}`), width), front.el, el('div', { style: 'height:10px' }), hingeRow, drawersRow, shelvesRow),
      sync(model) {
        const col = model.project.columns[index];
        front.set(col.front);
        hinge.set(col.hinge);
        drawers.set(col.drawers);
        shelves.set(col.shelves);
        hingeRow.hidden = col.front !== 'door';
        drawersRow.hidden = col.front !== 'drawers';
        shelvesRow.hidden = col.front === 'drawers';
        width.textContent = `фасад ${mmText(model.cells[index].cellWidth)} мм`;
      },
    };
  }

  const sections = group('Секции', null, cardsHost);
  syncs.push((model) => {
    const n = model.project.columns.length;
    if (cards.length !== n) {
      cards = Array.from({ length: n }, (_, i) => columnCard(i));
      cardsHost.replaceChildren(...cards.map((c) => c.el));
    }
    cards.forEach((c) => c.sync(model));
  });

  // ---------- выбор из каталога ----------
  function selectRow({ label, options, get, set, swatch, visible }) {
    const select = el('select', { 'aria-label': label });
    const dot = swatch ? el('i', { class: 'swatch' }) : null;
    const wrap = el('div', { class: 'select' + (swatch ? '' : ' select--plain') }, dot, select);
    const root = el('div', { class: 'select-row' }, el('span', {}, label), wrap);
    let sig = '';

    select.addEventListener('change', () => store.update((p) => set(p, select.value)));

    return {
      el: root,
      sync(model) {
        const opts = options(model.catalog);
        const nextSig = opts.map((o) => o.value + o.label).join('|');
        if (nextSig !== sig) {
          sig = nextSig;
          select.replaceChildren(...opts.map((o) => el('option', { value: o.value }, o.label)));
        }
        const value = get(model.project);
        select.value = value;
        if (dot) dot.style.background = swatch(model.catalog, value) || 'transparent';
        root.hidden = visible ? !visible(model) : false;
      },
    };
  }

  const sheetOptions = (list) => list.map((s) => ({ value: s.id, label: sheetTitle(s) }));
  const sheetColor = (catalog, id) => catalog.sheets.find((s) => s.id === id)?.color;

  const materials = group(
    'Материалы',
    null,
    track(selectRow({ label: 'Корпус', options: (c) => sheetOptions(bodySheets(c)), get: (p) => p.materials.carcass, set: (p, v) => (p.materials.carcass = v), swatch: sheetColor })),
    track(selectRow({ label: 'Фасады', options: (c) => sheetOptions(bodySheets(c)), get: (p) => p.materials.front, set: (p, v) => (p.materials.front = v), swatch: sheetColor })),
    track(selectRow({ label: 'Задняя стенка', options: (c) => sheetOptions(backSheets(c)), get: (p) => p.materials.back, set: (p, v) => (p.materials.back = v), swatch: sheetColor })),
    track(selectRow({ label: 'Коробки ящиков', options: (c) => sheetOptions(bodySheets(c)), get: (p) => p.materials.drawer, set: (p, v) => (p.materials.drawer = v), swatch: sheetColor, visible: (m) => m.units.some((u) => u.kind === 'drawer') })),
    track(selectRow({ label: 'Кромка корпуса', options: (c) => c.edges.map((e) => ({ value: e.id, label: e.name })), get: (p) => p.edging.carcass, set: (p, v) => (p.edging.carcass = v) })),
    track(selectRow({ label: 'Кромка фасадов', options: (c) => c.edges.map((e) => ({ value: e.id, label: e.name })), get: (p) => p.edging.front, set: (p, v) => (p.edging.front = v) }))
  );

  const hardware = group(
    'Фурнитура',
    null,
    track(selectRow({ label: 'Ручки', options: (c) => c.handles.map((h) => ({ value: h.id, label: h.price ? `${h.name}, ${money(h.price)}` : h.name })), get: (p) => p.hardware.handle, set: (p, v) => (p.hardware.handle = v) })),
    track(selectRow({ label: 'Петли', options: (c) => c.hinges.map((h) => ({ value: h.id, label: `${h.name}, ${money(h.price)}` })), get: (p) => p.hardware.hinge, set: (p, v) => (p.hardware.hinge = v), visible: (m) => m.units.some((u) => u.kind === 'door') })),
    track(selectRow({ label: 'Направляющие', options: (c) => c.slides.map((s) => ({ value: s.id, label: `${s.name}, ${money(s.price)}` })), get: (p) => p.hardware.slide, set: (p, v) => (p.hardware.slide = v), visible: (m) => m.units.some((u) => u.kind === 'drawer') }))
  );

  const catalogButton = el('div', { class: 'group' }, el('button', { class: 'btn btn--line', type: 'button', style: 'width:100%', onClick: () => ctx.openCatalog() }, 'Каталог и цены…'));

  host.append(quick, dims, construction, sections, materials, hardware, catalogButton);

  return {
    sync(model) {
      syncs.forEach((fn) => fn(model));
    },
    focusQuick() {
      quickInput.focus();
      quickInput.select();
    },
  };
}
