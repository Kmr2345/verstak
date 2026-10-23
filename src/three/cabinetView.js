// Тумба в 3D: собирает сцену из списка деталей модели и анимирует двери, ящики и «разнесённый» вид.

import * as THREE from 'three';
import { SCENE_UNIT } from '../config.js';
import { findSheet } from '../core/lookup.js';
import { sheetMaterial, handleMaterial, legMaterial, edgeLineMaterial, applyPhysicalUVs, highlightOf } from './materials.js';

const S = 1 / SCENE_UNIT; // мм -> единицы сцены

export function createCabinetView(stage) {
  const root = new THREE.Group();
  stage.scene.add(root);

  let nodes = [];          // что двигается при разнесении: { object, home, offset }
  let unitEntries = new Map(); // id -> { group, unit, amount, target }
  let pickables = [];
  let hovered = null;
  const openTargets = new Map(); // состояние дверей переживает пересборку
  const openAmounts = new Map();
  const explode = { target: 0, value: 0 };

  function clear() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    root.clear();
    nodes = [];
    unitEntries = new Map();
    pickables = [];
    hovered = null;
  }

  function partMesh(part, model) {
    const sheet = findSheet(model.catalog, part.materialId);
    const [sx, sy, sz] = part.size;
    const geo = new THREE.BoxGeometry(sx * S, sy * S, sz * S);
    if (sheet.pattern === 'wood') applyPhysicalUVs(geo, part.size, part.axis, part.id);

    const mesh = new THREE.Mesh(geo, sheetMaterial(sheet));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeLineMaterial));
    mesh.userData = { part, baseMaterial: mesh.material };
    return mesh;
  }

  function fixtureMesh(f) {
    const [sx, sy, sz] = f.size;
    let geo;
    let mat = handleMaterial;
    if (f.kind === 'leg') {
      geo = new THREE.CylinderGeometry((sx / 2) * S, (sx / 2) * S, sy * S, 16);
      mat = legMaterial;
    } else if (f.shape === 'knob') {
      geo = new THREE.CylinderGeometry((sx / 2) * S, (sx / 2) * S, sz * S, 20);
      geo.rotateX(Math.PI / 2); // ось ручки смотрит на зрителя
    } else {
      geo = new THREE.BoxGeometry(sx * S, sy * S, sz * S);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  function rebuild(model) {
    clear();
    const { width: W, height: H, depth: D } = model.project;
    const center = new THREE.Vector3(0, (H / 2) * S, 0);

    // Подвижные узлы: у каждой двери и ящика своя группа
    for (const unit of model.units) {
      const group = new THREE.Group();
      group.position.set(unit.pivot[0] * S, unit.pivot[1] * S, unit.pivot[2] * S);
      root.add(group);
      const amount = openAmounts.get(unit.id) || 0;
      unitEntries.set(unit.id, { group, unit, amount, target: openTargets.get(unit.id) || 0, center: null, home: group.position.clone() });
    }

    // Фасады слегка выносим вперёд: плоскости фасада и корпуса совпадают и мерцают (z-fighting)
    const FRONT_BIAS = 0.5;
    const attach = (mesh, pos, unitId) => {
      const entry = unitId ? unitEntries.get(unitId) : null;
      if (entry) {
        mesh.position.set(pos[0] * S - entry.group.position.x, pos[1] * S - entry.group.position.y, pos[2] * S - entry.group.position.z);
        entry.group.add(mesh);
      } else {
        mesh.position.set(pos[0] * S, pos[1] * S, pos[2] * S);
        root.add(mesh);
        nodes.push({ object: mesh, home: mesh.position.clone(), center: new THREE.Vector3(...pos).multiplyScalar(S) });
      }
    };

    for (const part of model.parts) {
      const mesh = partMesh(part, model);
      const pos = part.role === 'front' ? [part.pos[0], part.pos[1], part.pos[2] + FRONT_BIAS] : part.pos;
      attach(mesh, pos, part.unit);
      pickables.push(mesh);
      // центр узла-двери берём по фасаду
      if (part.unit && part.role === 'front') unitEntries.get(part.unit).center = new THREE.Vector3(...part.pos).multiplyScalar(S);
    }
    for (const f of model.fixtures) attach(fixtureMesh(f), f.pos, f.unit);

    for (const entry of unitEntries.values()) {
      nodes.push({ object: entry.group, home: entry.home, center: entry.center, unit: entry });
    }

    // На сколько каждый узел разъезжается при «разнесении»
    for (const node of nodes) {
      const c = node.center;
      const front = node.unit ? 1 : 0;
      node.offset = new THREE.Vector3(
        (c.x - center.x) * 0.45,
        (c.y - center.y) * 0.4,
        (c.z - center.z) * 0.8 + front * D * S * 0.6
      );
    }

    stage.fitShadow(model.project);
    stage.setTarget(model.project);
    applyPose();
  }

  // Ставит узлы в позу: разнесение + открытие
  function applyPose() {
    for (const node of nodes) {
      node.object.position.copy(node.home).addScaledVector(node.offset, explode.value);
      const entry = node.unit;
      if (!entry) continue;
      const k = easeInOut(entry.amount);
      if (entry.unit.kind === 'door') {
        const angle = THREE.MathUtils.degToRad(entry.unit.angle) * k;
        entry.group.rotation.y = entry.unit.hinge === 'left' ? -angle : angle;
      } else {
        entry.group.position.z += entry.unit.travel * S * k;
      }
    }
  }

  const easeInOut = (t) => t * t * (3 - 2 * t);

  stage.onFrame((dt) => {
    let moving = false;
    const diff = explode.target - explode.value;
    if (Math.abs(diff) > 0.001) {
      explode.value += diff * (1 - Math.exp(-dt * 6));
      moving = true;
    }
    for (const entry of unitEntries.values()) {
      const d = entry.target - entry.amount;
      if (Math.abs(d) > 0.001) {
        entry.amount += d * (1 - Math.exp(-dt * 7));
        moving = true;
      } else if (entry.amount !== entry.target) {
        entry.amount = entry.target;
        moving = true;
      }
      openAmounts.set(entry.unit.id, entry.amount);
    }
    if (moving) applyPose();
  });

  return {
    root,
    rebuild,

    setExploded(on) {
      explode.target = on ? 1 : 0;
    },

    setAllOpen(on) {
      for (const entry of unitEntries.values()) {
        entry.target = on ? 1 : 0;
        openTargets.set(entry.unit.id, entry.target);
      }
    },

    toggleUnit(id) {
      const entry = unitEntries.get(id);
      if (!entry) return;
      entry.target = entry.target ? 0 : 1;
      openTargets.set(id, entry.target);
    },

    anyOpen: () => [...unitEntries.values()].some((e) => e.target > 0),
    hasUnits: () => unitEntries.size > 0,

    // Деталь под курсором: ndc — координаты в диапазоне -1..1
    pick(ndc) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, stage.camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      return hit ? hit.object : null;
    },

    setHover(mesh) {
      if (mesh === hovered) return;
      if (hovered) hovered.material = hovered.userData.baseMaterial;
      hovered = mesh;
      if (hovered) hovered.material = highlightOf(hovered.userData.baseMaterial);
    },
  };
}
