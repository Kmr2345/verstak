// Фурнитура: считаем по составу изделия.

import { findHinge, findSlide, findHandle } from './lookup.js';

// Сколько петель нужно двери такой высоты
export function hingesPerDoor(height) {
  if (height <= 900) return 2;
  if (height <= 1600) return 3;
  if (height <= 2000) return 4;
  return 5;
}

export function buildHardware(project, layout, catalog) {
  const { parts, units, fixtures } = layout;
  const list = [];
  const push = (item, qty, unit = 'шт') => {
    if (qty > 0 && item) list.push({ id: item.id, name: item.name, qty, unit, price: item.price });
  };

  const doors = parts.filter((p) => p.role === 'front' && units.find((u) => u.id === p.unit)?.kind === 'door');
  const drawers = units.filter((u) => u.kind === 'drawer');
  const fronts = parts.filter((p) => p.role === 'front');

  const hinges = doors.reduce((sum, d) => sum + hingesPerDoor(d.size[1]), 0);
  push(findHinge(catalog, project.hardware.hinge), hinges);
  push(findSlide(catalog, project.hardware.slide), drawers.length, 'компл.');

  const handle = findHandle(catalog, project.hardware.handle);
  if (handle && handle.shape !== 'none') push(handle, fronts.length);

  push(catalog.leg, fixtures.filter((f) => f.kind === 'leg').length);

  // Полкодержатели: четыре на полку
  const shelves = parts.filter((p) => p.name === 'Полка').length;
  push(catalog.shelfPin, shelves * 4);

  // Евровинты: углы корпуса, стойки и коробки ящиков
  const dividers = parts.filter((p) => p.name === 'Стойка').length;
  push(catalog.confirmat, 8 + dividers * 4 + drawers.length * 8 + (project.plinth > 0 ? 4 : 0));

  return list;
}
