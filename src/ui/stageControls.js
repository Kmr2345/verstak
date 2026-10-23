// Переключатель 3D / чертёж и панель инструментов под 3D

import { el } from './dom.js';
import { icon } from './icons.js';

export function createStageControls({ modeHost, toolbarHost, actions }) {
  let mode = '3d';

  // ---- режимы ----
  const modes = [
    { id: '3d', label: '3D', icon: 'cube' },
    { id: 'drawing', label: 'Чертёж', icon: 'ruler' },
  ];
  const modeButtons = modes.map((m) => el('button', { type: 'button', role: 'tab', onClick: () => setMode(m.id) }, m.label));
  modeHost.append(el('div', { class: 'seg', role: 'tablist' }, modeButtons));

  // ---- инструменты ----
  const toggles = {};
  const toggle = (id, iconName, label, title, fn) => {
    const btn = el('button', { class: 'btn', type: 'button', title, 'aria-pressed': 'false' }, icon(iconName), label);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      fn(on);
    });
    toggles[id] = btn;
    return btn;
  };
  const view = (name, label) => el('button', { class: 'btn', type: 'button', onClick: () => actions.flyTo(name) }, label);

  toolbarHost.append(
    view('front', 'Спереди'),
    view('left', 'Слева'),
    view('top', 'Сверху'),
    view('iso', 'Объём'),
    el('span', { class: 'sep' }),
    toggle('dims', 'ruler', 'Размеры', 'Размерные линии', actions.setDims),
    toggle('explode', 'layers', 'Разнести', 'Разнесённый вид сборки', actions.setExploded),
    toggle('xray', 'ghost', 'Рентген', 'Прозрачные детали', actions.setXray),
    toggle('open', 'door', 'Открыть', 'Открыть или закрыть все двери и ящики', (on) => actions.setOpen(on))
  );
  toggles.dims.setAttribute('aria-pressed', 'true');

  function setMode(next) {
    mode = next;
    modeButtons.forEach((b, i) => b.setAttribute('aria-selected', String(modes[i].id === mode)));
    toolbarHost.hidden = mode !== '3d';
    actions.setMode(mode);
  }
  setMode('3d');

  return {
    get mode() {
      return mode;
    },
    // кнопка «Открыть» показывает реальное состояние, даже если дверь открыли кликом
    setOpenPressed(on) {
      toggles.open.setAttribute('aria-pressed', String(on));
    },
    setOpenAvailable(has) {
      toggles.open.hidden = !has;
    },
  };
}
