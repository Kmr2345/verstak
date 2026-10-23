// Разбор быстрого ввода размеров: «600x800x400», «600 800 400», «ш600 в800 г400».

const LABELS = {
  ш: 'width', w: 'width',
  в: 'height', h: 'height',
  г: 'depth', d: 'depth', т: 'depth',
};

// Возвращает { width, height, depth } или null, если строку не поняли.
// Если подписей нет, порядок такой: ширина, высота, глубина.
export function parseDims(text) {
  const src = String(text || '')
    .toLowerCase()
    .replace(/,/g, '.')
    // «x», «×», «*» и русская «х» между числами — просто разделители
    .replace(/(\d)\s*[x×*х]\s*(?=\d)/g, '$1 ');
  const tokens = [...src.matchAll(/([a-zа-я]*)\s*[:=]?\s*(\d+(?:\.\d+)?)/g)];
  if (!tokens.length || tokens.length > 3) return null;

  const result = {};
  const labelled = tokens.every((t) => LABELS[t[1]]);

  if (labelled) {
    for (const t of tokens) result[LABELS[t[1]]] = Math.round(Number(t[2]));
    return result;
  }

  // Без подписей нужно ровно три числа
  if (tokens.some((t) => t[1]) || tokens.length !== 3) return null;
  const [w, h, d] = tokens.map((t) => Math.round(Number(t[2])));
  return { width: w, height: h, depth: d };
}
