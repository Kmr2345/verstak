// Сцена: рендерер, камера, управление, свет и пол. Ничего не знает про тумбу.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SCENE_UNIT } from '../config.js';

const THEMES = {
  light: { bg: 0xe9ebee, floor: 0xdfe2e6, grid: 0xc3c8cf },
  dark: { bg: 0x14171c, floor: 0x1c2026, grid: 0x2f353d },
};

export function createStage(container) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(THEMES.light.bg, 30, 90);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  camera.position.set(9, 6.5, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Второй рендерер рисует HTML-подписи размеров поверх 3D
  const labelRenderer = new CSS2DRenderer();
  Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI / 2 - 0.01;

  // ---- свет ----
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8bdc6, 0.7));

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const key = new THREE.DirectionalLight(0xfff4e5, 2.4);
  key.position.set(7, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 4;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdfe9ff, 0.7);
  fill.position.set(-9, 5, -5);
  scene.add(fill);

  // ---- пол: принимает тень, сверху сетка 1 м ----
  const floorMat = new THREE.MeshStandardMaterial({ color: THEMES.light.floor, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // цвета сетки зашиты в вершины, поэтому при смене темы строим её заново
  let grid = null;
  function makeGrid(color) {
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose();
      grid.material.dispose();
    }
    grid = new THREE.GridHelper(120, 120, color, color);
    grid.position.y = 0.002;
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    scene.add(grid);
  }
  makeGrid(THEMES.light.grid);

  // ---- состояние ----
  const frameCallbacks = [];
  const targetGoal = new THREE.Vector3(0, 4, 0);
  controls.target.copy(targetGoal);
  let cameraGoal = null;
  controls.addEventListener('start', () => (cameraGoal = null)); // пользователь взял камеру сам

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 38 + (1 - camera.aspect) * 40 : 38; // на вертикальном экране шире угол
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  let prev = 0;
  function loop(time = 0) {
    requestAnimationFrame(loop);
    const dt = Math.min((time - prev) / 1000, 0.1);
    prev = time;

    frameCallbacks.forEach((fn) => fn(dt));

    // камера плавно едет к цели, пока пользователь её не перехватил
    const ease = 1 - Math.exp(-dt * 7);
    controls.target.lerp(targetGoal, ease);
    if (cameraGoal) {
      camera.position.lerp(cameraGoal, ease);
      if (camera.position.distanceTo(cameraGoal) < 0.02) cameraGoal = null;
    }
    controls.update();

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  loop();

  // Расстояние, с которого изделие целиком в кадре
  function fitDistance(dims) {
    const radius = (0.5 * Math.hypot(dims.width, dims.height, dims.depth)) / SCENE_UNIT;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    return (radius / Math.sin(fov / 2)) * 1.4; // запас на открытые двери и панель инструментов
  }

  const DIRECTIONS = {
    front: [0, 0.05, 1],
    left: [-1, 0.05, 0],
    top: [0.0001, 1, 0.06],
    iso: [0.62, 0.42, 0.78],
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    onFrame: (fn) => frameCallbacks.push(fn),
    resize,

    // Центр взгляда следует за серединой изделия
    setTarget(dims) {
      targetGoal.set(0, dims.height / SCENE_UNIT / 2, 0);
    },

    // Облёт камеры к стандартному виду
    flyTo(name, dims) {
      const dir = new THREE.Vector3(...DIRECTIONS[name]).normalize();
      const center = new THREE.Vector3(0, dims.height / SCENE_UNIT / 2, 0);
      targetGoal.copy(center);
      cameraGoal = center.clone().addScaledVector(dir, fitDistance(dims));
    },

    // Тень должна накрывать всё изделие, но не быть слишком размытой на мелком
    fitShadow(dims) {
      const r = Math.max(8, (Math.hypot(dims.width, dims.depth) / SCENE_UNIT) * 0.9);
      const cam = key.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.updateProjectionMatrix();
    },

    setTheme(name) {
      const t = THEMES[name] || THEMES.light;
      scene.background = new THREE.Color(t.bg);
      scene.fog.color.setHex(t.bg);
      floorMat.color.setHex(t.floor);
      makeGrid(t.grid);
    },

    // Снимок для PNG
    capture() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
  };
}
