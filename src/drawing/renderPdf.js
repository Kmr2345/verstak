// Рисует страницы чертежа в PDF через jsPDF.
// Шрифты передаём снаружи в base64: стандартные шрифты PDF не умеют кириллицу.

import { LAYERS } from './layers.js';
import { APP_NAME } from '../config.js';

const MM_TO_PT = 72 / 25.4;

function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// JsPDF — конструктор из библиотеки jspdf (его подгружаем лениво, чтобы не раздувать основной бандл)
export function renderPdf(JsPDF, pages, fonts, meta = {}) {
  const doc = new JsPDF({ unit: 'mm', format: [pages[0].width, pages[0].height], orientation: 'landscape', compress: true });

  doc.addFileToVFS('Plex-Regular.ttf', fonts.regular);
  doc.addFont('Plex-Regular.ttf', 'Plex', 'normal');
  doc.addFileToVFS('Plex-SemiBold.ttf', fonts.bold);
  doc.addFont('Plex-SemiBold.ttf', 'Plex', 'bold');
  doc.setLineCap('round');
  doc.setProperties({ title: meta.title || 'Чертёж', author: APP_NAME, creator: APP_NAME });

  pages.forEach((page, i) => {
    if (i > 0) doc.addPage([page.width, page.height], 'landscape');

    for (const it of page.items) {
      const style = LAYERS[it.layer] || LAYERS.outline;
      if (it.t === 'line') {
        doc.setDrawColor(...rgb(style.color));
        doc.setLineWidth(style.w);
        doc.line(it.x1, it.y1, it.x2, it.y2);
      } else {
        doc.setFont('Plex', it.bold ? 'bold' : 'normal');
        doc.setFontSize(it.size * MM_TO_PT);
        doc.setTextColor(...rgb(style.color));
        const opts = { align: it.anchor === 'middle' ? 'center' : it.anchor === 'end' ? 'right' : 'left' };
        if (it.rot) opts.angle = -it.rot; // у SVG поворот по часовой, у PDF против
        doc.text(it.text, it.x, it.y, opts);
      }
    }
  });
  return doc;
}
