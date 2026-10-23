// Точка входа: собирает ядро, 3D и интерфейс и связывает их между собой.
//
// Поток данных простой: любое действие меняет проект в store,
// store сообщает об этом, и мы один раз за кадр пересчитываем модель и обновляем все части экрана.

import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { STORAGE, APP_NAME } from './config.js';
import { createStorage, shareUrl, shareCodeFromHash, decodeShare, projectToJson, projectFromJson } from './core/storage.js';
import { createLibrary } from './core/library.js';
import { createStore } from './core/store.js';
import { normalizeProject, newId, cloneProject, TEMPLATES } from './core/project.js';
import { buildModel } from './core/model.js';

import { createStage } from './three/stage.js';
import { createCabinetView } from './three/cabinetView.js';
import { createDimensions3d } from './three/dimensions3d.js';
import { attachInteraction } from './three/interaction.js';
import { setXray } from './three/materials.js';

import { $, debounce } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { createTopbar } from './ui/topbar.js';
import { createParamsPanel } from './ui/paramsPanel.js';
import { createResultsPanel } from './ui/resultsPanel.js';
import { createStageControls } from './ui/stageControls.js';
import { createProjectsDialog, createCatalogDialog } from './ui/dialogs.js';
import { renderDrawing } from './ui/drawingView.js';
import { exportPdf, exportViewsDxf, exportCuttingDxf, exportCsv, exportJson, downloadBlob, safeName } from './export/files.js';

// ---------- данные ----------

const storage = createStorage();
const library = createLibrary(storage);
const normalize = (p) => normalizeProject(p, library.catalog);

// Проект при запуске: из ссылки, из последнего сеанса или шаблон «Тумба»
function startProject() {
  const code = shareCodeFromHash(location.hash);
  if (code) {
    const shared = decodeShare(code);
    history.replaceState(null, '', location.pathname + location.search);
    if (shared) return { ...shared, id: newId() };
  }
  return storage.getProject(storage.getCurrentId()) || TEMPLATES[0].make();
}

const store = createStore(startProject(), normalize);
let model = null;
let savedText = '';

// ---------- тема ----------

let theme = storage.read(STORAGE.theme, null) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1a1e24' : '#fbfbfa');
  stage.setTheme(theme);
}

// ---------- 3D ----------

const stage = createStage($('#viewport'));
const view = createCabinetView(stage);
const dims3d = createDimensions3d(stage.scene);

attachInteraction({
  canvas: stage.renderer.domElement,
  view,
  tooltip: $('#tooltip'),
  getModel: () => model,
  onToggle: () => controls.setOpenPressed(view.anyOpen()),
});

// ---------- сохранение ----------

const save = debounce(() => {
  storage.saveProject(store.state);
  storage.setCurrentId(store.state.id);
  savedText = 'Сохранено';
  syncTopbar();
}, 400);

function saveNow() {
  storage.saveProject(store.state);
  storage.setCurrentId(store.state.id);
}

// ---------- действия ----------

const viewport = $('#viewport');
const drawingHost = $('#drawing');

async function guarded(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(err);
    toast(`${label}: ${err.message || 'ошибка'}`, { error: true, ms: 4000 });
  }
}

const topbarActions = {
  rename: (name) => store.update((p) => (p.name = name.trim() || 'Без названия'), { key: 'name' }),
  undo: () => store.undo(),
  redo: () => store.redo(),
  openProjects: () => projectsDialog.open(),
  openCatalog: () => catalogDialog.open(),
  toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    storage.write(STORAGE.theme, theme);
    applyTheme();
    syncTopbar();
  },
  async share() {
    const url = shareUrl(store.state);
    try {
      await navigator.clipboard.writeText(url);
      toast('Ссылка на проект скопирована');
    } catch {
      prompt('Скопируйте ссылку на проект:', url);
    }
  },
  exportPdf: () =>
    guarded('PDF', async () => {
      toast('Готовлю PDF…');
      await exportPdf(model);
      toast('PDF готов');
    }),
  exportViewsDxf: () => guarded('DXF', () => exportViewsDxf(model)),
  exportCuttingDxf: () => guarded('DXF', () => exportCuttingDxf(model)),
  exportCsv: () => guarded('CSV', () => exportCsv(model)),
  exportPng: () =>
    guarded('PNG', async () => {
      if (controls.mode !== '3d') return toast('Снимок делается в режиме 3D', { error: true });
      const blob = await (await fetch(stage.capture())).blob();
      downloadBlob(blob, `${safeName(store.state.name)}.png`);
    }),
  exportJson: () => exportJson(projectToJson(store.state), store.state.name),
};

const stageActions = {
  flyTo: (name) => stage.flyTo(name, store.state),
  setDims: (on) => dims3d.setVisible(on),
  setExploded: (on) => view.setExploded(on),
  setXray: (on) => setXray(on),
  setOpen: (on) => view.setAllOpen(on),
  setMode(mode) {
    const is3d = mode === '3d';
    viewport.hidden = !is3d;
    drawingHost.hidden = is3d;
    if (is3d) stage.resize();
    else if (model) renderDrawing(drawingHost, model);
  },
};

const controls = createStageControls({ modeHost: $('#modeTabs'), toolbarHost: $('#toolbar'), actions: stageActions });

// Диалоги и действия над списком проектов
const projectActions = {
  currentId: () => store.state.id,
  listProjects: () => {
    saveNow(); // текущий проект тоже должен быть в списке
    return storage.listProjects();
  },
  newFromTemplate(t) {
    store.load(t.make());
    saveNow();
    stage.flyTo('iso', store.state);
  },
  openProject(id) {
    const p = storage.getProject(id);
    if (!p) return;
    saveNow();
    store.load(p);
    storage.setCurrentId(id);
    stage.flyTo('iso', store.state);
  },
  duplicate(id) {
    const p = storage.getProject(id);
    if (!p) return;
    storage.saveProject({ ...cloneProject(p), id: newId(), name: `${p.name} (копия)`, updatedAt: Date.now() });
    toast('Копия создана');
  },
  remove(id) {
    storage.deleteProject(id);
    if (id === store.state.id) projectActions.newFromTemplate(TEMPLATES[0]);
  },
  importJson(text) {
    const data = projectFromJson(text);
    if (!data) {
      toast('Файл не похож на проект «Верстака»', { error: true });
      return false;
    }
    store.load({ ...data, id: newId() });
    saveNow();
    toast('Проект загружен');
    return true;
  },
  exportJson: topbarActions.exportJson,
};

const projectsDialog = createProjectsDialog($('#projectsDialog'), projectActions);
const catalogDialog = createCatalogDialog($('#catalogDialog'), {
  library,
  onCatalogChange: () => store.refresh(),
});

const topbar = createTopbar($('#topbar'), topbarActions);
const params = createParamsPanel($('#paramsPanel'), { store, library, openCatalog: () => catalogDialog.open() });
const results = createResultsPanel($('#resultsPanel'), { openCatalog: () => catalogDialog.open() });

function syncTopbar() {
  topbar.sync({ project: store.state, canUndo: store.canUndo(), canRedo: store.canRedo(), theme, savedText });
}

// ---------- обновление экрана ----------

function refreshAll() {
  model = buildModel(store.state, library.catalog, library.settings);
  params.sync(model);
  results.render(model);
  view.rebuild(model);
  dims3d.update(store.state);
  controls.setOpenAvailable(view.hasUnits());
  controls.setOpenPressed(view.anyOpen());
  if (controls.mode === 'drawing') renderDrawing(drawingHost, model);
  document.title = `${store.state.name} — ${APP_NAME}`;
  syncTopbar();
}

// Несколько изменений подряд (ползунок) сворачиваем в одно обновление за кадр
let queued = false;
function scheduleRefresh() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    refreshAll();
  });
}

store.subscribe((_, meta) => {
  savedText = '';
  scheduleRefresh();
  if (meta.type !== 'sync' && meta.type !== 'refresh') save();
});
library.subscribe(() => store.refresh());

// ---------- мобильная навигация ----------

const app = $('#app');
const tabs = [
  { id: 'params', label: 'Параметры', icon: 'params' },
  { id: 'view', label: 'Модель', icon: 'cube' },
  { id: 'results', label: 'Итоги', icon: 'list' },
];
const nav = $('#mobileNav');
tabs.forEach((t) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.append(icon(t.icon), t.label);
  btn.addEventListener('click', () => {
    app.dataset.tab = t.id;
    nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    if (t.id === 'view') requestAnimationFrame(() => stage.resize());
  });
  btn.setAttribute('aria-selected', String(t.id === 'view'));
  nav.append(btn);
});

// ---------- горячие клавиши ----------

document.addEventListener('keydown', (e) => {
  const typing = e.target.matches?.('input[type="text"], textarea');
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (mod && key === 'z' && !typing) {
    e.preventDefault();
    e.shiftKey ? store.redo() : store.undo();
  } else if (mod && key === 'y' && !typing) {
    e.preventDefault();
    store.redo();
  } else if (mod && key === 's') {
    e.preventDefault();
    saveNow();
    toast('Проект сохранён');
  } else if (e.key === '/' && !typing && !e.target.matches?.('input, select, textarea')) {
    e.preventDefault();
    app.dataset.tab = 'params';
    params.focusQuick();
  }
});

// ---------- запуск ----------

applyTheme();
refreshAll();
stage.flyTo('iso', store.state);
saveNow();
