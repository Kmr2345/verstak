// Каталог материалов и фурнитуры, который мебельщик правит под себя:
// свои цены, свои листовые материалы, настройки расчёта.
// Базовый каталог лежит в data/catalog.js, здесь хранятся только отличия от него.

import { STORAGE } from '../config.js';
import { defaultCatalog, DEFAULT_SETTINGS } from '../data/catalog.js';

const EMPTY = { prices: {}, customSheets: [] };

export function createLibrary(storage) {
  let overrides = { ...EMPTY, ...storage.read(STORAGE.catalog, EMPTY) };
  let settings = { ...DEFAULT_SETTINGS, ...storage.read(STORAGE.settings, {}) };
  const listeners = new Set();
  let cached = null;

  const persist = () => {
    storage.write(STORAGE.catalog, overrides);
    storage.write(STORAGE.settings, settings);
    cached = null;
    listeners.forEach((fn) => fn());
  };

  function build() {
    const c = defaultCatalog();
    const withPrice = (item) => (overrides.prices[item.id] !== undefined ? { ...item, price: overrides.prices[item.id] } : item);
    c.sheets = [...c.sheets, ...overrides.customSheets].map(withPrice);
    c.edges = c.edges.map(withPrice);
    c.hinges = c.hinges.map(withPrice);
    c.slides = c.slides.map(withPrice);
    c.handles = c.handles.map(withPrice);
    c.leg = withPrice(c.leg);
    c.confirmat = withPrice(c.confirmat);
    c.shelfPin = withPrice(c.shelfPin);
    return c;
  }

  return {
    get catalog() {
      return cached || (cached = build());
    },
    get settings() {
      return settings;
    },

    // Текущая цена любой позиции каталога
    priceOf(id) {
      const c = this.catalog;
      const all = [...c.sheets, ...c.edges, ...c.hinges, ...c.slides, ...c.handles, c.leg, c.confirmat, c.shelfPin];
      return all.find((item) => item.id === id)?.price;
    },

    setPrice(id, price) {
      const v = Number(price);
      if (!Number.isFinite(v) || v < 0) return;
      overrides.prices[id] = Math.round(v);
      persist();
    },

    // Свой листовой материал; возвращает его или текст ошибки
    addSheet(data) {
      const thickness = Number(data.thickness);
      const L = Number(data.length);
      const W = Number(data.width);
      const price = Number(data.price);
      const name = String(data.name || '').trim();
      if (!name) return { error: 'Введите название материала' };
      if (!(thickness > 0 && thickness <= 60)) return { error: 'Толщина от 1 до 60 мм' };
      if (!(L >= 500 && W >= 500)) return { error: 'Размер листа не меньше 500 мм' };
      if (!(price >= 0)) return { error: 'Цена не может быть отрицательной' };

      const sheet = {
        id: 'custom-' + Date.now().toString(36),
        name,
        kind: data.kind || 'ЛДСП',
        thickness,
        sheet: [Math.max(L, W), Math.min(L, W)],
        price: Math.round(price),
        color: data.color || '#d8d4cc',
        pattern: data.pattern === 'wood' ? 'wood' : 'plain',
        grain: data.pattern === 'wood',
        custom: true,
      };
      overrides.customSheets.push(sheet);
      persist();
      return { sheet };
    },

    removeSheet(id) {
      overrides.customSheets = overrides.customSheets.filter((s) => s.id !== id);
      delete overrides.prices[id];
      persist();
    },

    updateSettings(patch) {
      settings = { ...settings, ...patch };
      persist();
    },

    resetPrices() {
      overrides.prices = {};
      persist();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
