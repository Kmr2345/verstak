// Константы конструкции. Все размеры в миллиметрах.

// Название продукта: меняется только здесь (и в index.html для вкладки браузера)
export const APP_NAME = 'Верстак';

// Допустимые значения параметров проекта
export const LIMITS = {
  width: [200, 3000],
  height: [200, 2700],
  depth: [200, 1000],
  plinth: [0, 200],
  columns: [1, 6],
  shelves: [0, 12],
  drawers: [1, 8],
};

export const MIN_PLINTH = 30;       // ножки ниже 30 мм не бывают, такие значения подтягиваем
export const MIN_CELL_WIDTH = 200;  // минимальная ширина одной секции по фасаду

// Конструктив
export const GAP = 2;               // зазор между фасадами и вокруг них
export const BACK_SETBACK = 10;     // задняя стенка утоплена от задней кромки боковин
export const BACK_GROOVE = 8;       // на сколько задняя стенка заходит в паз
export const SHELF_SETBACK = 2;     // полка не доходит до переда корпуса
export const PLINTH_SETBACK = 50;   // цоколь утоплен от фасада
export const PLINTH_FLOOR_GAP = 10; // зазор цоколя от пола
export const DOOR_OPEN_ANGLE = 105; // угол открытия двери в 3D, градусы

// Ящики
export const SLIDE_CLEARANCE = 13;  // зазор на направляющую с каждой стороны
export const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550];
export const DRAWER_BOX_LOSS = 70;  // насколько коробка ящика ниже фасада
export const DRAWER_BOX_LIFT = 30;  // отступ коробки от низа фасада

// Пороги проверок
export const MAX_SHELF_SPAN = 800;  // дальше полка из ЛДСП 16-18 мм начинает провисать
export const MAX_DOOR_WIDTH = 600;
export const MAX_DOOR_HEIGHT = 2100;
export const MIN_SHELF_GAP = 80;    // просвет между полками
export const MIN_DRAWER_FRONT = 130;

// Ключи localStorage
export const STORAGE = {
  projects: 'verstak:projects',
  current: 'verstak:current',
  catalog: 'verstak:catalog',
  settings: 'verstak:settings',
  theme: 'verstak:theme',
};

// Масштаб сцены: 1 единица three.js = 100 мм
export const SCENE_UNIT = 100;
