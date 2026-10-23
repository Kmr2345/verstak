// Поиск записей в каталоге по id

export const findSheet = (catalog, id) => catalog.sheets.find((s) => s.id === id) || null;
export const findEdge = (catalog, id) => catalog.edges.find((e) => e.id === id) || null;
export const findHinge = (catalog, id) => catalog.hinges.find((h) => h.id === id) || null;
export const findSlide = (catalog, id) => catalog.slides.find((s) => s.id === id) || null;
export const findHandle = (catalog, id) => catalog.handles.find((h) => h.id === id) || null;

// Листы по назначению: корпус и фасады берём любые, заднюю стенку — только ХДФ/ДВП
export const backSheets = (catalog) => catalog.sheets.filter((s) => s.kind === 'ХДФ');
export const bodySheets = (catalog) => catalog.sheets.filter((s) => s.kind !== 'ХДФ');

// Краткое название листа вместе с толщиной: «ЛДСП Белый 18 мм»
export const sheetTitle = (sheet) => `${sheet.name} ${sheet.thickness} мм`;
