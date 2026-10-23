// Собирает всю расчётную модель проекта: детали, спецификацию, фурнитуру, раскрой, смету, замечания.
// Функция чистая: на вход проект и каталог, на выход данные. Поэтому её легко тестировать.

import { buildPanels } from './panels.js';
import { buildSpec } from './spec.js';
import { buildHardware } from './hardware.js';
import { buildCutting } from './cutting.js';
import { estimateCost } from './pricing.js';
import { findSheet, findHandle } from './lookup.js';

export function resolveMaterials(project, catalog) {
  const m = project.materials;
  return {
    carcass: findSheet(catalog, m.carcass),
    front: findSheet(catalog, m.front),
    back: findSheet(catalog, m.back),
    drawer: findSheet(catalog, m.drawer),
  };
}

export function buildModel(project, catalog, settings) {
  const mats = resolveMaterials(project, catalog);
  const handle = findHandle(catalog, project.hardware.handle);

  const layout = buildPanels(project, mats, handle);
  const spec = buildSpec(layout.parts, mats, project.edging);
  const hardware = buildHardware(project, layout, catalog);
  const cutting = buildCutting(spec.rows, catalog, settings);
  const cost = estimateCost({ cutting, spec, hardware, catalog, settings, edging: project.edging });

  // Одинаковые замечания не повторяем
  const seen = new Set();
  const warnings = [...layout.warnings, ...cutting.warnings].filter((w) => !seen.has(w.text) && seen.add(w.text));

  return { project, catalog, settings, mats, handle, ...layout, spec, hardware, cutting, cost, warnings };
}
