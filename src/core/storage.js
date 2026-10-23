// Сохранение проектов и настроек в localStorage, ссылки-«поделиться» и импорт/экспорт JSON.
// Если localStorage недоступен (приватный режим), данные живут в памяти до закрытия вкладки.

import { STORAGE } from '../config.js';

function pickBackend() {
  try {
    const ls = globalThis.localStorage;
    const probe = '__verstak_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  }
}

export function createStorage(backend = pickBackend()) {
  const read = (key, fallback) => {
    try {
      const raw = backend.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      backend.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false; // переполнено хранилище
    }
  };

  return {
    read,
    write,

    listProjects() {
      const list = read(STORAGE.projects, []);
      return Array.isArray(list) ? list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : [];
    },

    getProject(id) {
      return this.listProjects().find((p) => p.id === id) || null;
    },

    saveProject(project) {
      const list = this.listProjects().filter((p) => p.id !== project.id);
      list.push(project);
      return write(STORAGE.projects, list);
    },

    deleteProject(id) {
      write(STORAGE.projects, this.listProjects().filter((p) => p.id !== id));
    },

    getCurrentId: () => read(STORAGE.current, null),
    setCurrentId: (id) => write(STORAGE.current, id),
  };
}

// ---- Ссылка на проект: параметры кодируются в адрес после #p= ----

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeShare(project) {
  const { id, updatedAt, ...rest } = project;
  return toBase64Url(JSON.stringify(rest));
}

// Возвращает объект проекта или null, если ссылка повреждена
export function decodeShare(code) {
  try {
    const data = JSON.parse(fromBase64Url(code));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function shareUrl(project, base = location.href.split('#')[0]) {
  return `${base}#p=${encodeShare(project)}`;
}

// Достаёт код проекта из адреса страницы
export function shareCodeFromHash(hash) {
  const m = /^#p=([\w-]+)/.exec(hash || '');
  return m ? m[1] : null;
}

export function projectToJson(project) {
  return JSON.stringify(project, null, 2);
}

export function projectFromJson(text) {
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}
