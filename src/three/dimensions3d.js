// Размерные линии и подписи вокруг изделия в 3D

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SCENE_UNIT } from '../config.js';
import { mmText } from '../core/format.js';

export function createDimensions3d(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const material = new THREE.LineBasicMaterial({ color: 0x2f6bff });

  const makeLabel = () => {
    const el = document.createElement('div');
    el.className = 'dim-label';
    const obj = new CSS2DObject(el);
    group.add(obj);
    return obj;
  };
  const labels = { width: makeLabel(), height: makeLabel(), depth: makeLabel() };
  let lines = null;

  function update({ width, height, depth }) {
    const w = width / SCENE_UNIT;
    const h = height / SCENE_UNIT;
    const d = depth / SCENE_UNIT;
    const off = 0.7;
    const y0 = 0.01;
    const pts = [];
    const seg = (a, b) => pts.push(...a, ...b);

    // ширина — вдоль переднего нижнего края
    seg([-w / 2, y0, d / 2 + off], [w / 2, y0, d / 2 + off]);
    seg([-w / 2, y0, d / 2], [-w / 2, y0, d / 2 + off + 0.15]);
    seg([w / 2, y0, d / 2], [w / 2, y0, d / 2 + off + 0.15]);
    // высота — слева от передней грани
    seg([-w / 2 - off, 0, d / 2], [-w / 2 - off, h, d / 2]);
    seg([-w / 2, 0, d / 2], [-w / 2 - off - 0.15, 0, d / 2]);
    seg([-w / 2, h, d / 2], [-w / 2 - off - 0.15, h, d / 2]);
    // глубина — справа вдоль пола
    seg([w / 2 + off, y0, -d / 2], [w / 2 + off, y0, d / 2]);
    seg([w / 2, y0, -d / 2], [w / 2 + off + 0.15, y0, -d / 2]);
    seg([w / 2, y0, d / 2], [w / 2 + off + 0.15, y0, d / 2]);

    if (lines) {
      group.remove(lines);
      lines.geometry.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    lines = new THREE.LineSegments(geo, material);
    group.add(lines);

    labels.width.position.set(0, y0, d / 2 + off);
    labels.height.position.set(-w / 2 - off, h / 2, d / 2);
    labels.depth.position.set(w / 2 + off, y0, 0);
    labels.width.element.textContent = mmText(width);
    labels.height.element.textContent = mmText(height);
    labels.depth.element.textContent = mmText(depth);
  }

  return {
    update,
    setVisible(on) {
      group.visible = on;
      Object.values(labels).forEach((l) => (l.visible = on)); // у HTML-подписей видимость своя
    },
  };
}
