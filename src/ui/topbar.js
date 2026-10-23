// Верхняя панель: название проекта, отмена/возврат, проекты, ссылка, экспорт, каталог, тема

import { el } from './dom.js';
import { icon } from './icons.js';
import { APP_NAME } from '../config.js';

const labeled = (name, label, onClick, extra = {}) =>
  el('button', { class: 'btn', type: 'button', title: label, 'aria-label': label, onClick, ...extra }, icon(name), el('span', { class: 'btn__label' }, label));

export function createTopbar(host, actions) {
  const nameInput = el('input', { class: 'topbar__name', type: 'text', maxlength: 80, 'aria-label': 'Название проекта' });
  nameInput.addEventListener('input', () => actions.rename(nameInput.value));
  nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && nameInput.blur());

  const undo = el('button', { class: 'btn btn--icon', type: 'button', title: 'Отменить (Ctrl+Z)', 'aria-label': 'Отменить', onClick: actions.undo }, icon('undo'));
  const redo = el('button', { class: 'btn btn--icon', type: 'button', title: 'Вернуть (Ctrl+Shift+Z)', 'aria-label': 'Вернуть', onClick: actions.redo }, icon('redo'));
  const saved = el('span', { class: 'saved', role: 'status' }, '');
  const themeBtn = el('button', { class: 'btn btn--icon', type: 'button', title: 'Тема', 'aria-label': 'Сменить тему', onClick: actions.toggleTheme });

  // Меню экспорта
  const menu = el('div', { class: 'menu', hidden: true, role: 'menu' });
  const item = (iconName, title, note, fn) =>
    el('button', { type: 'button', role: 'menuitem', onClick: () => ((menu.hidden = true), fn()) }, icon(iconName), el('span', {}, title, el('small', {}, note)));
  menu.append(
    item('file', 'Чертёж и спецификация, PDF', 'Виды, детали, смета и карты раскроя', actions.exportPdf),
    item('ruler', 'Виды, DXF', 'В натуральную величину для CAD', actions.exportViewsDxf),
    item('sheet', 'Раскрой, DXF', 'Листы с деталями для станка', actions.exportCuttingDxf),
    item('table', 'Спецификация, CSV', 'Открывается в Excel', actions.exportCsv),
    item('image', 'Снимок 3D, PNG', 'Как сейчас видно на экране', actions.exportPng),
    el('hr'),
    item('download', 'Проект, JSON', 'Резервная копия, можно загрузить обратно', actions.exportJson)
  );
  const exportBtn = el('button', { class: 'btn btn--line', type: 'button', 'aria-haspopup': 'menu', onClick: () => (menu.hidden = !menu.hidden) }, icon('download'), el('span', { class: 'btn__label' }, 'Экспорт'));
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !e.target.closest('.menu-wrap')) menu.hidden = true;
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && (menu.hidden = true));

  host.append(
    el('div', { class: 'brand' }, el('span', { class: 'brand__mark', html: '<svg viewBox="0 0 24 24"><path d="M5 7h14v10H5z"/><path d="M12 7v10M5 12h7"/></svg>' }), el('span', { class: 'brand__text' }, APP_NAME)),
    nameInput,
    undo,
    redo,
    el('span', { class: 'spacer' }),
    saved,
    labeled('folder', 'Проекты', actions.openProjects),
    labeled('link', 'Ссылка', actions.share),
    el('div', { class: 'menu-wrap' }, exportBtn, menu),
    labeled('sliders', 'Каталог', actions.openCatalog),
    themeBtn
  );

  return {
    sync({ project, canUndo, canRedo, theme, savedText }) {
      if (document.activeElement !== nameInput) nameInput.value = project.name;
      undo.disabled = !canUndo;
      redo.disabled = !canRedo;
      saved.textContent = savedText || '';
      themeBtn.replaceChildren(icon(theme === 'dark' ? 'sun' : 'moon'));
    },
  };
}
