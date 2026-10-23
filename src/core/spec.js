// Спецификация деталей: из параллелепипедов делаем «длина × ширина × толщина» и считаем кромку.

const AXIS_INDEX = { x: 0, y: 1, z: 2 };
const SIDE_AXIS = { left: 'x', right: 'x', top: 'y', bottom: 'y', front: 'z', rear: 'z' };

// Размеры панели в привычном для цеха виде.
// Длина — большая из двух сторон, ширина — меньшая, толщина — по оси axis.
export function panelDims(part) {
  const [p, q] = ['x', 'y', 'z'].filter((a) => a !== part.axis);
  const sp = part.size[AXIS_INDEX[p]];
  const sq = part.size[AXIS_INDEX[q]];
  const lengthAxis = sp >= sq ? p : q;
  const widthAxis = lengthAxis === p ? q : p;

  // Сторона перпендикулярна оси ширины — значит, кромка идёт вдоль длины, и наоборот
  let edgeL = 0;
  let edgeW = 0;
  for (const side of part.edges) {
    const axis = SIDE_AXIS[side];
    if (axis === widthAxis) edgeL += 1;
    else if (axis === lengthAxis) edgeW += 1;
  }

  const length = Math.max(sp, sq);
  const width = Math.min(sp, sq);
  return {
    length,
    width,
    thickness: part.size[AXIS_INDEX[part.axis]],
    edgeL,
    edgeW,
    edgeLength: edgeL * length + edgeW * width, // мм кромки на одну деталь
  };
}

// Какая кромка клеится на деталь этой роли
function edgeFor(role, edging) {
  if (role === 'carcass') return edging.carcass;
  if (role === 'front') return edging.front;
  return null;
}

// Одинаковые детали сводим в одну строку с количеством
export function buildSpec(parts, mats, edging) {
  const rows = new Map();

  for (const part of parts) {
    const d = panelDims(part);
    const key = [part.name, part.role, part.materialId, d.length, d.width, d.edgeL, d.edgeW].join('|');
    let row = rows.get(key);
    if (!row) {
      row = {
        name: part.name,
        role: part.role,
        materialId: part.materialId,
        length: d.length,
        width: d.width,
        thickness: d.thickness,
        edgeL: d.edgeL,
        edgeW: d.edgeW,
        edgeLength: d.edgeLength,
        edgeId: d.edgeL + d.edgeW > 0 ? edgeFor(part.role, edging) : null,
        qty: 0,
        partIds: [],
      };
      rows.set(key, row);
    }
    row.qty += 1;
    row.partIds.push(part.id);
  }

  const list = [...rows.values()].sort(
    (a, b) => a.materialId.localeCompare(b.materialId) || b.length - a.length || b.width - a.width
  );
  list.forEach((row, i) => (row.no = i + 1));

  // для подсказок в 3D: деталь -> строка спецификации
  const byPart = new Map();
  for (const row of list) for (const id of row.partIds) byPart.set(id, row);

  return { rows: list, byPart };
}

// Итоги по спецификации
export function specTotals(rows) {
  let count = 0;
  let area = 0;
  let edge = 0;
  for (const r of rows) {
    count += r.qty;
    area += (r.length * r.width * r.qty) / 1e6;
    edge += (r.edgeLength * r.qty) / 1000;
  }
  return { count, area, edge };
}
