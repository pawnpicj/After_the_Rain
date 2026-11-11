import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(1, 12, 8);
const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, ...options });
const glow = color => new THREE.MeshBasicMaterial({ color });

const metal = material(0x304242, { roughness: 0.72, metalness: 0.26 });
const trim = material(0x1d2929, { roughness: 0.7 });
const concrete = material(0x485957, { roughness: 0.96 });
const orange = material(0xa66432, { roughness: 0.72 });
const amberLight = glow(0xffd79a);
const coolLight = glow(0xa5cbd1);

export function block(parent, x, y, z, w, h, d, surface) {
  const mesh = new THREE.Mesh(box, surface);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  parent.add(mesh);
  return mesh;
}

function batchScenery(scene) {
  const byMaterial = new Map();
  for (const mesh of scene.children) {
    if (mesh.geometry !== box) continue;
    if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
    byMaterial.get(mesh.material).push(mesh);
  }
  for (const [surface, meshes] of byMaterial) {
    if (meshes.length < 2) continue;
    const batch = new THREE.InstancedMesh(box, surface, meshes.length);
    meshes.forEach((mesh, i) => {
      mesh.updateMatrix();
      batch.setMatrixAt(i, mesh.matrix);
      scene.remove(mesh);
    });
    batch.computeBoundingSphere();
    scene.add(batch);
  }
}

function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function signFace(parent, text, x, y, z, width, height) {
  const texture = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#192522';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#a4aa91';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 82, 232, 92);
    ctx.fillStyle = '#eee1bd';
    ctx.font = 'bold ' + Math.min(47, Math.floor(360 / text.length)) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);
  });
  const sign = new THREE.Mesh(flatPlane, new THREE.MeshBasicMaterial({ map: texture }));
  sign.position.set(x, y, z);
  sign.scale.set(width, height, 1);
  parent.add(sign);
}

function poolTexture() {
  return canvasTexture(128, (ctx, size) => {
    const middle = size / 2;
    const gradient = ctx.createRadialGradient(middle, middle, 0, middle, middle, middle);
    gradient.addColorStop(0, '#ffffffff');
    gradient.addColorStop(0.55, '#ffffff77');
    gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

const pool = poolTexture();
const flatPlane = new THREE.PlaneGeometry(1, 1);
const shadowMaterial = new THREE.MeshBasicMaterial({
  map: pool, color: 0x060a09, transparent: true, opacity: 0.72, depthWrite: false,
});

export function groundShadow(parent, width, length) {
  const mesh = new THREE.Mesh(flatPlane, shadowMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.019;
  mesh.scale.set(width, length, 1);
  parent.add(mesh);
  return mesh;
}

function rng(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function floorTexture() {
  const random = rng(71);
  const texture = canvasTexture(512, (ctx, size) => {
    const data = ctx.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      const x = (i / 4) % size;
      const y = Math.floor(i / 4 / size);
      const value = 58 + Math.sin(x / 53 + y / 68) * 5 + random() * 15;
      data.data.set([value - 9, value + 2, value, 255], i);
    }
    ctx.putImageData(data, 0, 0);
    ctx.fillStyle = '#252f2e';
    ctx.fillRect(0, 0, size, 3);
    ctx.fillRect(0, 0, 3, size);
    for (let i = 0; i < 60; i++) {
      const x = random() * size;
      const y = random() * size;
      ctx.strokeStyle = i % 4 === 0 ? '#a5b2aa33' : '#111c1a44';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + random() * 35, y + random() * 5);
      ctx.stroke();
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 11);
  texture.anisotropy = 4;
  return texture;
}

function buildDockEntrance(scene, addObstacle, lamp) {
  const gateZ = 16.9;
  const opening = 3.2;
  const height = 2.84;
  const bottom = 0.24;
  const frame = material(0x627171, { metalness: 0.47, roughness: 0.55 });
  const wire = new THREE.LineBasicMaterial({ color: 0x8a9a98, transparent: true, opacity: 0.67 });
  const alarmOff = material(0x592f2b);
  const alarmOn = glow(0xff4a35);
  const alarmLenses = [];
  const warningLights = new THREE.Group();
  scene.add(warningLights);
  const leaves = [];
  const leafWidth = 2.93;
  const restAngle = 0.22;
  const openAngle = 1.16;
  const sections = 6;
  const sectionWidth = leafWidth / sections;
  const thickness = 0.13;

  function panel(parent, width) {
    const span = height - bottom;
    const vertices = [];
    for (const slope of [-1, 1]) {
      for (let offset = -span; offset < width + span; offset += 0.25) {
        const edgeA = -offset / slope;
        const edgeB = (width - offset) / slope;
        const low = Math.max(0, Math.min(edgeA, edgeB));
        const high = Math.min(span, Math.max(edgeA, edgeB));
        if (low >= high) continue;
        vertices.push(offset + low * slope - width / 2, bottom + low, 0);
        vertices.push(offset + high * slope - width / 2, bottom + high, 0);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    parent.add(new THREE.LineSegments(geometry, wire));
    for (const y of [bottom, height]) block(parent, 0, y, 0, width + 0.04, 0.085, 0.091, frame);
    for (const x of [-width / 2, width / 2]) {
      block(parent, x, (height + bottom) / 2, 0, 0.095, span, 0.091, frame);
    }
  }

  for (const side of [-1, 1]) {
    const bayWidth = (15.85 - opening) / 3;
    for (let i = 0; i < 3; i++) {
      const bay = new THREE.Group();
      bay.position.set(side * (opening + (i + 0.5) * bayWidth), 0, gateZ);
      panel(bay, bayWidth);
      scene.add(bay);
      addObstacle(bay.position.x, gateZ, bayWidth, 0.14, height);
    }
    const hingeX = side * opening;
    block(scene, hingeX, 1.65, gateZ, 0.22, 3.3, 0.22, frame);
    addObstacle(hingeX, gateZ, 0.22, 0.22, 3.3);
    block(scene, hingeX, 0.145, gateZ, 0.55, 0.29, 0.55, concrete);
    alarmLenses.push(block(warningLights, hingeX, 3.39, gateZ, 0.33, 0.19, 0.3, alarmOff));

    const hinge = new THREE.Group();
    hinge.position.set(hingeX, 0, gateZ);
    scene.add(hinge);
    const leaf = new THREE.Group();
    leaf.position.x = -side * leafWidth / 2;
    hinge.add(leaf);
    panel(leaf, leafWidth);
    block(leaf, -side * (leafWidth / 2 - 0.085), 1.25, 0.058, 0.15, 0.23, 0.11, orange);
    const bounds = Array.from({ length: sections }, (_, i) =>
      addObstacle(hingeX - side * sectionWidth * (i + 0.5), gateZ, sectionWidth, thickness, height));
    leaves.push({ side, hinge, bounds });
  }

  block(scene, 0, 3.01, gateZ, 6.55, 0.16, 0.19, frame);
  block(scene, 0, 3.23, gateZ, 3.6, 0.45, 0.14, trim);
  signFace(scene, 'PORT ACCESS', 0, 3.23, gateZ + 0.081, 3.65, 1.23);
  lamp(-4.5, 4.65, 19.7, 0xffbd78, amberLight, 15);
  lamp(4.85, 4.35, 15.6, 0x9bc8cd, coolLight, 16);
  const alarmLight = new THREE.PointLight(0xff4737, 0, 13);
  alarmLight.position.set(0, 3.13, gateZ + 0.75);
  scene.add(alarmLight);
  let triggered = false;
  let progress = 0;
  let alarmPhase = 0;

  function setLeaves(amount) {
    const angle = THREE.MathUtils.lerp(restAngle, openAngle, amount);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfWidth = (sectionWidth * cos + thickness * sin) / 2;
    const halfDepth = (sectionWidth * sin + thickness * cos) / 2;
    for (const { side, hinge, bounds } of leaves) {
      hinge.rotation.y = -side * angle;
      bounds.forEach((box, i) => {
        const offset = sectionWidth * (i + 0.5);
        const x = hinge.position.x - side * offset * cos;
        const z = gateZ - offset * sin;
        box.min.set(x - halfWidth, 0, z - halfDepth);
        box.max.set(x + halfWidth, height, z + halfDepth);
      });
    }
  }

  function flash(active) {
    alarmLight.intensity = active ? 135 : 0;
    for (const lens of alarmLenses) lens.material = active ? alarmOn : alarmOff;
  }

  return {
    z: gateZ,
    get triggered() { return triggered; },
    activate() {
      triggered = true;
      alarmPhase = 0;
      flash(true);
    },
    reset() {
      triggered = false;
      progress = alarmPhase = 0;
      setLeaves(0);
      flash(false);
    },
    update(elapsed, alarmActive) {
      if (triggered && progress < 1) {
        progress = Math.min(1, progress + elapsed / 0.94);
        setLeaves(progress * progress * (3 - 2 * progress));
      }
      alarmPhase += elapsed;
      flash(alarmActive && alarmPhase % 0.62 < 0.3);
    },
  };
}

function buildInterior(scene, pumping, solid, crate, lamp) {
  block(scene, 0, 6.55, -5, 32, 0.35, 44, trim);
  for (const z of [12, 3, -6, -15, -24]) {
    block(scene, 0, 6.03, z, 31.5, 0.28, 0.38, metal);
    for (const x of [-14.8, 14.8]) {
      solid(x, z, 0.68, 0.76, 6.07, metal);
    }
  }

  if (!pumping) {
    const shelf = material(0x3a4248);
    const cartons = material(0x77664c);
    for (const [x, z, w, d] of [
      [-8.6, 8.0, 3.9, 6.5], [8.3, 8.6, 3.5, 6.4],
      [-8.15, -5.6, 3.8, 7.4], [7.9, -4.0, 3.6, 7.1],
      [-8.2, -18, 4.0, 7.3], [8.1, -18.6, 3.5, 6.9],
    ]) {
      solid(x, z, w, d, 2.7, shelf);
      for (const side of [-1, 1]) {
        const face = x + side * (w / 2 + 0.04);
        for (const y of [0.24, 1.05, 1.88, 2.71]) block(scene, face, y, z, 0.14, 0.08, d, orange);
        for (let offset = -d / 2 + 0.23; offset < d / 2; offset += 1.4) {
          block(scene, face, 1.36, z + offset, 0.15, 2.73, 0.095, metal);
          block(scene, face, 0.65, z + offset + 0.55, 0.1, 0.58, 0.72, cartons);
          block(scene, face, 1.46, z + offset + 0.63, 0.1, 0.57, 0.91, cartons);
        }
      }
    }
    solid(0, -11, 6.25, 0.82, 2.85, metal);
    block(scene, 0, 2.7, -10.56, 6.16, 0.1, 0.04, orange);
    crate(2.65, 4.2, 2.05, 1.4, 1.0);
    crate(-2.8, -4.25, 2.05, 1.65, 1.15);
    crate(3.15, -18.3, 2.15, 1.5, 1.1);
    lamp(-3.7, 5.7, 9.4, 0xc9dae2, coolLight, 17);
    lamp(4.1, 5.7, -1.2, 0xc6dce8, coolLight, 18);
    lamp(-4.2, 5.7, -13.6, 0xaac5df, coolLight, 18);
    lamp(0.0, 5.6, -22.8, 0xf3b77f, amberLight, 15);
    return;
  }

  const pumpMetal = material(0x3c5753, { metalness: 0.4, roughness: 0.49 });
  const pipeMetal = material(0x45605d, { metalness: 0.48, roughness: 0.55 });
  const pipeShape = new THREE.CylinderGeometry(1, 1, 1, 12);
  function pipe(x, y, z, radius, length, across) {
    const mesh = new THREE.Mesh(pipeShape, pipeMetal);
    mesh.scale.set(radius, length, radius);
    mesh.position.set(x, y, z);
    if (across) mesh.rotation.z = Math.PI / 2;
    else mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  }
  for (const [x, z] of [[-8, 6], [8, 5], [-8, -10.5], [8, -12.2]]) {
    solid(x, z, 3.9, 5.65, 2.35, pumpMetal);
    block(scene, x, 0.2, z, 4.03, 0.4, 5.82, trim);
    block(scene, x, 2.43, z, 3.55, 0.18, 5.15, metal);
    for (const offset of [-1.9, 0, 1.9]) {
      pipe(x, 2.78, z + offset, 0.46, 4.25, true);
      block(scene, x + Math.sign(-x) * 1.97, 1.48, z + offset, 0.08, 0.18, 0.26, coolLight);
    }
  }
  for (const x of [-12, 12]) {
    pipe(x, 4.65, -5, 0.63, 43, false);
    for (const z of [13, 3, -7, -17, -24]) {
      pipe(x, 4.65, z, 0.75, 0.34, false);
      block(scene, x, 5.39, z, 0.27, 1.41, 0.24, metal);
    }
  }
  for (const z of [3.3, -12.9, -21.1]) pipe(0, 4.78, z, 0.52, 24, true);
  crate(-2.8, -4.8, 2.6, 2.05, 1.12);
  crate(2.4, -13.7, 2.5, 1.9, 1.15);
  crate(-4.4, -20.1, 2.55, 1.45, 1.16);
  crate(4.4, -19.15, 2.55, 1.45, 1.16);
  lamp(0, 5.7, 10, 0x83bdbe, coolLight, 18);
  lamp(-3.3, 5.7, -3, 0x8dc3c0, coolLight, 18);
  lamp(3.8, 5.7, -11, 0xef9b61, amberLight, 16);
  lamp(0, 5.6, -22, 0xf5ae77, amberLight, 17);
}

export function makeWorld(mission) {
  const outdoor = mission.environment === 'dock';
  const pumping = mission.environment === 'pump';
  const scene = new THREE.Scene();
  const air = outdoor ? 0x182625 : pumping ? 0x172321 : 0x22282d;
  scene.background = new THREE.Color(air);
  scene.fog = new THREE.FogExp2(air, outdoor ? 0.026 : 0.019);
  scene.add(new THREE.HemisphereLight(0xc6ded9, 0x4c3e30, outdoor ? 1.64 : 1.12));
  const moon = new THREE.DirectionalLight(0xb2dce3, outdoor ? 1.9 : 0.66);
  moon.position.set(-9, 14, -16);
  scene.add(moon);

  const random = rng(184);
  const obstacles = [];
  function addObstacle(x, z, w, d, h, base = 0) {
    const min = new THREE.Vector3(x - w / 2, base, z - d / 2);
    const max = new THREE.Vector3(x + w / 2, base + h, z + d / 2);
    const bounds = new THREE.Box3(min, max);
    obstacles.push(bounds);
    return bounds;
  }
  function solid(x, z, w, d, h, surface, base = 0) {
    block(scene, x, base + h / 2, z, w, h, d, surface);
    addObstacle(x, z, w, d, h, base);
  }

  const back = outdoor ? 26.5 : 17;
  const center = (back - 27) / 2;
  const length = back + 27;
  const floor = new THREE.Mesh(flatPlane, material(0xffffff, {
    map: floorTexture(), roughness: 0.62, metalness: 0.1,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = center;
  floor.scale.set(34, length + 2, 1);
  scene.add(floor);

  const painted = material(0x8c744b);
  for (const x of [-3.1, 3.1]) {
    for (let z = -23; z <= (outdoor ? 24.5 : 14); z += 2.5) {
      block(scene, x, 0.008, z, 0.095, 0.014, 1.1, painted);
    }
  }
  for (let i = 0; i < 15; i++) {
    const x = -5.25 + i * 0.75;
    const stripe = block(scene, x, 0.008, -20.6, 0.24, 0.014, 0.9, painted);
    stripe.rotation.y = -0.55;
  }

  const wallHeight = outdoor ? 2.8 : 6.5;
  solid(-16, center, 0.65, length, wallHeight, concrete);
  solid(16, center, 0.65, length, wallHeight, concrete);
  solid(0, back, 32, 0.65, wallHeight, concrete);
  solid(0, -27, 32, 0.8, 7, metal);
  for (let z = -25; z < back; z += 4) {
    for (const x of [-15.65, 15.65]) {
      block(scene, x, 1.36, z, 0.39, 2.72, 0.35, trim);
      block(scene, x, 2.91, z, 0.77, 0.15, 4, trim);
    }
  }

  const containerPaint = [
    material(0x334d4b), material(0x6b4c36), material(0x405153), material(0x4a5550),
  ];
  function container(x, z, w, d, variant, base = 0) {
    const h = 2.72;
    solid(x, z, w, d, h, containerPaint[variant], base);
    for (const side of [-1, 1]) {
      for (let offset = -d / 2 + 0.26; offset < d / 2; offset += 0.35) {
        block(scene, x + side * w / 2, base + 1.36, z + offset, 0.09, 2.48, 0.08, trim);
      }
      for (const end of [-1, 1]) {
        block(scene, x + side * w / 2, base + 1.36, z + end * d / 2, 0.15, h, 0.15, trim);
      }
      block(scene, x + side * (w / 2 - 0.08), base + h, z, 0.17, 0.14, d, trim);
    }
    for (const offset of [-0.63, -0.13, 0.13, 0.63]) {
      block(scene, x + offset, base + 1.36, z + d / 2 + 0.048, 0.036, 2.44, 0.09, metal);
    }
    block(scene, x - 0.66, base + 1.97, z + d / 2 + 0.045, 0.51, 0.19, 0.08, painted);
  }

  function crate(x, z, w, d, h) {
    solid(x, z, w, d, h, concrete);
    for (const side of [-1, 1]) {
      block(scene, x + side * (w / 2 - 0.14), h / 2, z, 0.23, h + 0.04, d + 0.06, metal);
    }
    block(scene, x, h - 0.2, z + d / 2 + 0.01, w - 0.49, 0.09, 0.025, orange);
  }

  function lamp(x, y, z, color, lightSurface, spread) {
    if (outdoor) block(scene, x, y / 2, z, 0.12, y, 0.12, trim);
    else block(scene, x, (y + 6.4) / 2, z, 0.12, 6.4 - y, 0.12, trim);
    const width = outdoor ? 0.55 : 2.6;
    block(scene, x, y, z, width, 0.19, 0.34, trim);
    block(scene, x, y - 0.104, z, width - 0.12, 0.03, 0.25, lightSurface);
    const light = new THREE.PointLight(color, 82, spread);
    light.position.set(x, y - 0.45, z);
    scene.add(light);
    const spill = new THREE.Mesh(flatPlane, new THREE.MeshBasicMaterial({
      color, map: pool, opacity: 0.16, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(x, 0.025, z);
    spill.scale.set(spread * 0.9, spread * 1.15, 1);
    scene.add(spill);
  }
  const entrance = outdoor ? buildDockEntrance(scene, addObstacle, lamp) : null;
  if (outdoor) {
    container(-10, 8.3, 3.5, 8, 1);
    container(-10, 8.3, 3.5, 8, 0, 2.72);
    container(9.6, 5.5, 3.5, 8.7, 0);
    container(-8, -6.8, 3.65, 9, 2);
    container(7.7, -12.8, 3.5, 8.2, 1);
    container(7.7, -12.8, 3.5, 8.2, 3, 2.72);
    container(-11, -19.8, 4.2, 8, 3);
    container(12, -18.5, 3.1, 7.5, 2);
    crate(-4.4, 8, 2.2, 1.6, 1.05);
    crate(4.4, 1.7, 2.35, 1.6, 1.2);
    crate(-3.3, -6.4, 2.15, 1.65, 1.05);
    crate(3.4, -17.3, 1.9, 1.5, 1.25);
    lamp(-5.6, 5, 12.7, 0xffb965, amberLight, 15);
    lamp(5.8, 5.6, 2.1, 0x88b6bd, coolLight, 16);
    lamp(-5.6, 5.2, -11.9, 0xffbd77, amberLight, 16);
    lamp(5.6, 5, -22.2, 0x9dced6, coolLight, 16);
  } else {
    buildInterior(scene, pumping, solid, crate, lamp);
  }

  const gate = new THREE.Group();
  gate.position.set(0, 0, -26.48);
  scene.add(gate);
  block(gate, 0, 2.02, 0, 4.8, 4.04, 0.16, trim);
  for (let y = 0.25; y < 3.7; y += 0.26) {
    block(gate, 0, y, 0.11, 4.48, 0.19, 0.1, metal);
  }
  const red = glow(0xef603b);
  const green = glow(0x94e6b1);
  const beacon = block(gate, 0, 4.1, 0.26, 1.05, 0.18, 0.13, red);
  block(gate, -2.52, 1.91, 0.14, 0.21, 3.82, 0.36, orange);
  block(gate, 2.52, 1.91, 0.14, 0.21, 3.82, 0.36, orange);
  block(scene, 0, 5.37, -26.52, 8.1, 0.15, 0.23, trim);
  signFace(scene, mission.sign, 0, 5.05, -26.49, 4.2, 1.95);

  const distant = [material(0x283636), material(0x34413e), material(0x263335)];
  const windowLight = [glow(0x6e8d8f), glow(0x967b51), glow(0x415d5f)];
  for (let i = 0; outdoor && i < 21; i++) {
    const x = -65 + i * 6.5;
    const z = -37 - random() * 33;
    const h = 4 + random() * 19;
    const w = 3 + random() * 6;
    block(scene, x, h / 2, z, w, h, 4, distant[i % distant.length]);
    for (let y = 4; y < h - 1; y += 1.7) {
      for (let dx = -w / 2 + 0.85; dx < w / 2 - 0.3; dx += 1.1) {
        if (random() > 0.52) {
          block(scene, x + dx, y, z + 2.018, 0.45, 0.63, 0.04, windowLight[i % 3]);
        }
      }
    }
  }
  const puddle = new THREE.MeshBasicMaterial({
    color: 0x76908b, map: pool, transparent: true, opacity: 0.24, depthWrite: false,
  });
  for (let i = 0; (outdoor || pumping) && i < 46; i++) {
    const mark = new THREE.Mesh(flatPlane, puddle);
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = random() * 0.45;
    mark.position.set(random() * 28 - 14, 0.013, random() * 40 - 25);
    mark.scale.set(0.3 + random() * 2.1, 0.9 + random() * 4, 1);
    scene.add(mark);
  }

  const [proofX, proofZ] = mission.terminal;
  solid(proofX, proofZ, 1.82, 0.76, 0.94, trim);
  block(scene, proofX, 0.96, proofZ, 1.89, 0.08, 0.8, metal);
  if (outdoor) {
    block(scene, proofX, 1.023, proofZ, 0.69, 0.049, 0.4, painted);
    block(scene, proofX + 0.09, 1.058, proofZ, 0.52, 0.023, 0.31, amberLight);
  } else {
    block(scene, proofX, 1.24, proofZ, 0.88, 0.52, 0.23, trim);
    block(scene, proofX, 1.25, proofZ + 0.12, 0.75, 0.39, 0.025, coolLight);
    block(scene, proofX, 1.045, proofZ + 0.24, 0.64, 0.05, 0.18, metal);
  }
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.21), red);
  marker.position.set(proofX, 1.94, proofZ);
  scene.add(marker);
  const rainCount = outdoor ? 650 : 0;
  const rainPositions = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainPositions.length; i += 6) {
    rainPositions[i] = random() * 36 - 18;
    rainPositions[i + 1] = random() * 12;
    rainPositions[i + 2] = random() * 56 - 28;
  }
  const rainGeometry = new THREE.BufferGeometry();
  const rainAttribute = new THREE.BufferAttribute(rainPositions, 3).setUsage(THREE.DynamicDrawUsage);
  rainGeometry.setAttribute('position', rainAttribute);
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({
    color: 0xacc8c9, transparent: true, opacity: 0.28, depthWrite: false,
  }));
  rain.frustumCulled = false;
  if (rainCount) scene.add(rain);
  function animateRain(dt) {
    for (let i = 0; i < rainPositions.length; i += 6) {
      rainPositions[i] -= dt * 1.6;
      rainPositions[i + 1] -= dt * 11;
      if (rainPositions[i] < -18) rainPositions[i] += 36;
      if (rainPositions[i + 1] < 0.15) rainPositions[i + 1] += 12;
      rainPositions[i + 3] = rainPositions[i] - 0.033;
      rainPositions[i + 4] = rainPositions[i + 1] - 0.32;
      rainPositions[i + 5] = rainPositions[i + 2];
    }
    rainAttribute.needsUpdate = true;
  }
  animateRain(0);
  batchScenery(scene);
  let elapsed = 0;
  return {
    scene, obstacles, entrance,
    animate(dt) {
      elapsed += dt;
      marker.position.y = 1.94 + Math.sin(elapsed * 2.7) * 0.09;
      marker.rotation.y += dt;
      if (rainCount) animateRain(dt);
    },
    setEvidenceReady(ready) { beacon.material = marker.material = ready ? green : red; },
  };
}

const enemyCoat = material(0x5f4939);
const enemyTrim = material(0x322c25);
const guardCoat = material(0x394c61);
const guardTrim = material(0x202a3a);
const guardBadge = material(0xc6bf9e);
const skin = material(0xa78163);
const pistol = material(0x181f1e, { metalness: 0.65, roughness: 0.32 });
const eye = glow(0xfba96b);
const guardPatch = new THREE.MeshBasicMaterial({
  map: canvasTexture(128, (ctx, size) => {
    ctx.fillStyle = '#182331';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#e7e4d3';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SECURITY', 64, 64);
  }),
});

export function makeEnemy(parent, security) {
  const root = new THREE.Group();
  parent.add(root);
  groundShadow(root, 1.32, 0.9);
  const pose = new THREE.Group();
  root.add(pose);
  const coat = security ? guardCoat : enemyCoat;
  const lining = security ? guardTrim : enemyTrim;
  block(pose, 0, 1.16, 0, 0.48, 0.6, 0.28, coat);
  block(pose, 0, 0.81, 0.013, 0.43, 0.2, 0.29, lining);
  block(pose, 0, 1.46, 0.015, 0.29, 0.12, 0.27, lining);
  const head = new THREE.Mesh(sphere, security ? skin : lining);
  head.position.set(0, 1.63, -0.006);
  head.scale.set(0.147, 0.18, 0.145);
  pose.add(head);
  block(pose, 0, 1.744, 0.015, 0.232, 0.091, 0.224, lining);
  if (security) {
    block(pose, 0, 1.728, -0.122, 0.24, 0.033, 0.145, lining);
    block(pose, -0.16, 1.36, -0.145, 0.073, 0.045, 0.019, guardBadge);
    const patch = new THREE.Mesh(flatPlane, guardPatch);
    patch.position.set(0, 1.32, 0.145);
    patch.scale.set(0.4, 0.22, 1);
    pose.add(patch);
  } else {
    block(pose, 0, 1.03, -0.15, 0.18, 0.42, 0.04, orange);
    block(pose, 0, 1.638, -0.131, 0.213, 0.044, 0.018, eye);
  }

  const legs = [-1, 1].map(side => {
    const leg = new THREE.Group();
    pose.add(leg);
    leg.position.set(side * 0.134, 0.82, 0);
    block(leg, 0, -0.32, 0, 0.163, 0.66, 0.18, lining);
    block(leg, 0, -0.73, -0.053, 0.187, 0.15, 0.31, pistol);
    return leg;
  });
  const arm = new THREE.Group();
  arm.position.set(0, 1.34, 0);
  pose.add(arm);
  const right = block(arm, 0.294, -0.072, -0.197, 0.148, 0.16, 0.47, coat);
  right.rotation.y = 0.18;
  const left = block(arm, -0.196, -0.102, -0.205, 0.144, 0.149, 0.47, coat);
  left.rotation.y = 0.79;
  block(arm, 0.177, -0.06, -0.415, 0.143, 0.14, 0.18, skin);
  block(arm, 0.177, 0.005, -0.565, 0.10, 0.10, 0.32, pistol);
  block(arm, 0.177, -0.08, -0.478, 0.08, 0.18, 0.10, pistol);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.177, 0.005, -0.735);
  arm.add(muzzle);
  return { root, pose, arm, legs, muzzle };
}
