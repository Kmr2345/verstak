// Мышь и касания на 3D: подсказка с размерами детали при наведении, клик открывает дверь или ящик.

import { panelDims } from '../core/spec.js';
import { mmText } from '../core/format.js';
import { sheetTitle } from '../core/lookup.js';

export function attachInteraction({ canvas, view, tooltip, getModel, onToggle }) {
  let downAt = null;
  let pending = null;

  const ndcOf = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
  };

  function showTip(mesh, e) {
    if (!mesh) {
      tooltip.hidden = true;
      return;
    }
    const part = mesh.userData.part;
    const d = panelDims(part);
    const mat = getModel().catalog.sheets.find((m) => m.id === part.materialId);
    tooltip.innerHTML = `<strong>${part.name}</strong><span>${mmText(d.length)} × ${mmText(d.width)} × ${mmText(d.thickness)} мм</span><span>${mat ? sheetTitle(mat) : ''}</span>`;
    const r = canvas.getBoundingClientRect();
    tooltip.style.left = `${Math.min(e.clientX - r.left + 14, r.width - 200)}px`;
    tooltip.style.top = `${Math.max(e.clientY - r.top - 12, 8)}px`;
    tooltip.hidden = false;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons) return; // идёт вращение камеры
    pending = e;
    requestAnimationFrame(() => {
      if (!pending) return;
      const mesh = view.pick(ndcOf(pending));
      view.setHover(mesh);
      showTip(mesh, pending);
      canvas.style.cursor = mesh && mesh.userData.part.unit ? 'pointer' : '';
      pending = null;
    });
  });

  canvas.addEventListener('pointerleave', () => {
    pending = null;
    view.setHover(null);
    tooltip.hidden = true;
  });

  canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));

  // Клик, а не перетаскивание: сдвиг меньше 5 пикселей
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const mesh = view.pick(ndcOf(e));
    const unit = mesh && mesh.userData.part.unit;
    if (unit) {
      view.toggleUnit(unit);
      if (onToggle) onToggle();
    }
    downAt = null;
  });
}
