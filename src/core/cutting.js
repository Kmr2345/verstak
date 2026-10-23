// Раскрой листов: упаковка деталей полосами (guillotine, как режет форматно-раскроечный станок).
// Это оценка расхода материала, а не замена программе оптимизации.

// Раскладывает детали на листы одним способом.
// L и W — рабочие размеры листа, w вдоль L, h вдоль W.
function packStrips(pieces, L, W, kerf, allowRotate) {
  const sorted = [...pieces].sort((a, b) => b.width - a.width || b.length - a.length);
  const sheets = [];
  const oversize = [];

  for (const piece of sorted) {
    let w = piece.length;
    let h = piece.width;
    let rotated = false;

    if (w > L || h > W) {
      if (allowRotate && h <= L && w <= W) {
        [w, h] = [h, w];
        rotated = true;
      } else {
        oversize.push(piece);
        continue;
      }
    }

    let placed = null;
    for (const sheet of sheets) {
      // Сначала ищем подходящую полосу
      const strip = sheet.strips.find((s) => h <= s.h && s.used + w <= L);
      if (strip) {
        placed = { sheet, strip };
        break;
      }
      // Потом пробуем открыть новую полосу на этом листе
      if (sheet.usedH + h <= W) {
        const fresh = { y: sheet.usedH, h, used: 0 };
        sheet.strips.push(fresh);
        sheet.usedH += h + kerf;
        placed = { sheet, strip: fresh };
        break;
      }
    }

    if (!placed) {
      const sheet = { strips: [], placements: [], usedH: 0 };
      const fresh = { y: 0, h, used: 0 };
      sheet.strips.push(fresh);
      sheet.usedH = h + kerf;
      sheets.push(sheet);
      placed = { sheet, strip: fresh };
    }

    const { sheet, strip } = placed;
    sheet.placements.push({ piece, x: strip.used, y: strip.y, w, h, rotated });
    strip.used += w + kerf;
  }

  return { sheets, oversize };
}

// Поворачивает результат, если лист укладывали «боком» (полосы вдоль короткой стороны)
function transpose(result) {
  for (const sheet of result.sheets) {
    sheet.placements = sheet.placements.map((p) => ({
      piece: p.piece,
      x: p.y,
      y: p.x,
      w: p.h,
      h: p.w,
      rotated: !p.rotated,
    }));
  }
  return result;
}

// Меньше листов — лучше; при равенстве выигрывает вариант с более пустым последним листом
function score(result) {
  const last = result.sheets[result.sheets.length - 1];
  const lastFill = last ? last.placements.reduce((s, p) => s + p.w * p.h, 0) : 0;
  return result.sheets.length * 1e9 + lastFill;
}

// Раскрой одного материала. pieces — отдельные детали (по одной штуке).
export function packMaterial(pieces, sheetMat, { kerf, trim }) {
  const [sheetL, sheetW] = sheetMat.sheet;
  const L = sheetL - 2 * trim;
  const W = sheetW - 2 * trim;
  const allowRotate = !sheetMat.grain; // текстуру нельзя поворачивать

  const candidates = [packStrips(pieces, L, W, kerf, allowRotate)];
  if (allowRotate) candidates.push(transpose(packStrips(pieces, W, L, kerf, true)));
  const best = candidates.reduce((a, b) => (score(b) < score(a) ? b : a));

  const partsArea = best.sheets.reduce((s, sh) => s + sh.placements.reduce((t, p) => t + p.w * p.h, 0), 0);
  const sheetArea = best.sheets.length * sheetL * sheetW;

  return {
    material: sheetMat,
    trim,
    sheets: best.sheets.map((sh, i) => ({ index: i + 1, placements: sh.placements })),
    oversize: best.oversize,
    partsArea: partsArea / 1e6,
    sheetArea: sheetArea / 1e6,
    efficiency: sheetArea ? partsArea / sheetArea : 0,
  };
}

// Раскрой всех материалов проекта по строкам спецификации
export function buildCutting(specRows, catalog, settings) {
  const groups = new Map();
  for (const row of specRows) {
    if (!groups.has(row.materialId)) groups.set(row.materialId, []);
    for (let k = 1; k <= row.qty; k++) {
      groups.get(row.materialId).push({
        no: row.no,
        name: row.name,
        length: row.length,
        width: row.width,
        edgeL: row.edgeL,
        edgeW: row.edgeW,
      });
    }
  }

  const materials = [];
  const warnings = [];
  for (const [materialId, pieces] of groups) {
    const sheetMat = catalog.sheets.find((s) => s.id === materialId);
    if (!sheetMat) continue;
    const result = packMaterial(pieces, sheetMat, settings);
    materials.push(result);
    for (const p of result.oversize) {
      warnings.push({ level: 'error', text: `Деталь «${p.name}» ${p.length}×${p.width} мм не помещается на лист ${sheetMat.sheet[0]}×${sheetMat.sheet[1]} мм (${sheetMat.name}).` });
    }
  }
  return { materials, warnings };
}
