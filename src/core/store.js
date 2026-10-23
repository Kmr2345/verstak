// Хранилище текущего проекта с историей действий (Ctrl+Z / Ctrl+Y).
// Серия быстрых правок с одним key (набор числа, движение ползунка) попадает в историю одним шагом.

import { cloneProject } from './project.js';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 900;

// Для сравнения не учитываем время изменения
const fingerprint = (p) => JSON.stringify({ ...p, updatedAt: 0 });

export function createStore(initial, normalize) {
  let state = normalize(initial);
  const past = [];
  const future = [];
  const listeners = new Set();
  let lastKey = null;
  let lastTime = 0;

  const emit = (meta) => listeners.forEach((fn) => fn(state, meta));

  return {
    get state() {
      return state;
    },

    // mutator получает копию проекта и меняет её как угодно; результат проходит нормализацию
    update(mutator, { key = null } = {}) {
      const draft = cloneProject(state);
      mutator(draft);
      const next = normalize({ ...draft, updatedAt: Date.now() });
      if (fingerprint(next) === fingerprint(state)) {
        emit({ type: 'sync' }); // значение могло быть подправлено, интерфейсу надо вернуть его в поле
        return;
      }

      const now = Date.now();
      const merge = key !== null && key === lastKey && now - lastTime < COALESCE_MS;
      if (!merge) {
        past.push(state);
        if (past.length > HISTORY_LIMIT) past.shift();
      }
      future.length = 0;
      lastKey = key;
      lastTime = now;
      state = next;
      emit({ type: 'update' });
    },

    undo() {
      if (!past.length) return;
      future.push(state);
      state = past.pop();
      lastKey = null;
      emit({ type: 'history' });
    },

    redo() {
      if (!future.length) return;
      past.push(state);
      state = future.pop();
      lastKey = null;
      emit({ type: 'history' });
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    // Открыть другой проект: история начинается заново
    load(project) {
      state = normalize(project);
      past.length = 0;
      future.length = 0;
      lastKey = null;
      emit({ type: 'load' });
    },

    // Каталог изменился (например, удалили материал): заново проверяем проект, историю не трогаем
    refresh() {
      const next = normalize(state);
      if (fingerprint(next) !== fingerprint(state)) state = next;
      emit({ type: 'refresh' });
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
