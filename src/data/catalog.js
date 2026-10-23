// Каталог по умолчанию: листовые материалы, кромка, фурнитура.
// Цены ориентировочные (в тенге), их можно поменять в окне «Каталог и цены».

const LDSP = [2800, 2070];

export const SHEETS = [
  { id: 'ldsp-white-18', name: 'ЛДСП Белый', kind: 'ЛДСП', thickness: 18, sheet: LDSP, price: 14500, color: '#f1f0ec', pattern: 'plain', grain: false },
  { id: 'ldsp-grey-18', name: 'ЛДСП Светло-серый', kind: 'ЛДСП', thickness: 18, sheet: LDSP, price: 15200, color: '#a9adb2', pattern: 'plain', grain: false },
  { id: 'ldsp-graphite-18', name: 'ЛДСП Графит', kind: 'ЛДСП', thickness: 18, sheet: LDSP, price: 16800, color: '#3d4148', pattern: 'plain', grain: false },
  { id: 'ldsp-oak-18', name: 'ЛДСП Дуб Сонома', kind: 'ЛДСП', thickness: 18, sheet: LDSP, price: 17400, color: '#c8a679', pattern: 'wood', grain: true },
  { id: 'ldsp-walnut-18', name: 'ЛДСП Орех', kind: 'ЛДСП', thickness: 18, sheet: LDSP, price: 18200, color: '#6b4528', pattern: 'wood', grain: true },
  { id: 'ldsp-white-16', name: 'ЛДСП Белый', kind: 'ЛДСП', thickness: 16, sheet: LDSP, price: 12800, color: '#f1f0ec', pattern: 'plain', grain: false },
  { id: 'ldsp-white-22', name: 'ЛДСП Белый', kind: 'ЛДСП', thickness: 22, sheet: LDSP, price: 19800, color: '#f1f0ec', pattern: 'plain', grain: false },
  { id: 'mdf-white-18', name: 'МДФ крашеный белый', kind: 'МДФ', thickness: 18, sheet: [2800, 1220], price: 31000, color: '#f7f7f4', pattern: 'plain', grain: false },
  { id: 'mdf-sage-18', name: 'МДФ крашеный шалфей', kind: 'МДФ', thickness: 18, sheet: [2800, 1220], price: 34500, color: '#9aa690', pattern: 'plain', grain: false },
  { id: 'hdf-white-3', name: 'ХДФ белый', kind: 'ХДФ', thickness: 3, sheet: LDSP, price: 4200, color: '#ecebe6', pattern: 'plain', grain: false },
  { id: 'hdf-grey-3', name: 'ХДФ серый', kind: 'ХДФ', thickness: 3, sheet: LDSP, price: 4400, color: '#9a9ea3', pattern: 'plain', grain: false },
];

// Кромка в цвет детали, цена за погонный метр
export const EDGES = [
  { id: 'pvc-04', name: 'ПВХ 0,4 мм', thickness: 0.4, price: 55 },
  { id: 'pvc-1', name: 'ПВХ 1 мм', thickness: 1, price: 95 },
  { id: 'pvc-2', name: 'ПВХ 2 мм', thickness: 2, price: 160 },
  { id: 'abs-2', name: 'АБС 2 мм', thickness: 2, price: 210 },
];

export const HINGES = [
  { id: 'hinge-basic', name: 'Петля накладная 110°', price: 450 },
  { id: 'hinge-soft', name: 'Петля 110° с доводчиком', price: 1400 },
];

// Цена за комплект (пара направляющих)
export const SLIDES = [
  { id: 'slide-ball', name: 'Направляющие шариковые', price: 2200 },
  { id: 'slide-soft', name: 'Направляющие скрытые с доводчиком', price: 5200 },
];

// length — длина ручки по вертикали или горизонтали, мм
export const HANDLES = [
  { id: 'none', name: 'Без ручек', shape: 'none', length: 0, price: 0 },
  { id: 'bar-128', name: 'Ручка-скоба 128 мм', shape: 'bar', length: 128, price: 900 },
  { id: 'bar-192', name: 'Ручка-скоба 192 мм', shape: 'bar', length: 192, price: 1200 },
  { id: 'knob', name: 'Ручка-кнопка', shape: 'knob', length: 28, price: 600 },
];

export const LEG = { id: 'leg', name: 'Опора регулируемая', price: 350 };
export const CONFIRMAT = { id: 'confirmat', name: 'Евровинт 7×50', price: 25 };
export const SHELF_PIN = { id: 'shelf-pin', name: 'Полкодержатель', price: 40 };

export const DEFAULT_SETTINGS = {
  kerf: 4,           // ширина пропила, мм
  trim: 10,          // подрезка кромок листа с каждой стороны, мм
  edgeReserve: 5,    // запас кромки, %
  laborPerPart: 700, // работа за одну деталь, ₸
  margin: 25,        // наценка, %
};

export function defaultCatalog() {
  return {
    sheets: SHEETS.map((s) => ({ ...s })),
    edges: EDGES.map((e) => ({ ...e })),
    hinges: HINGES.map((h) => ({ ...h })),
    slides: SLIDES.map((s) => ({ ...s })),
    handles: HANDLES.map((h) => ({ ...h })),
    leg: { ...LEG },
    confirmat: { ...CONFIRMAT },
    shelfPin: { ...SHELF_PIN },
  };
}
