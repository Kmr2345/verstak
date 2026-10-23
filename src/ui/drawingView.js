// Режим «Чертёж» на сцене: тот же лист общего вида, что попадёт в PDF

import { overviewPage, buildAllPages } from '../drawing/sheets.js';
import { itemsToSvg } from '../drawing/renderSvg.js';

export function renderDrawing(host, model) {
  const total = buildAllPages(model).length;
  const page = overviewPage(model, { number: 1, total });
  host.innerHTML = itemsToSvg(page.items, page.width, page.height, { paper: true, className: 'paper' });
}
