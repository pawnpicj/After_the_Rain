import * as THREE from 'three';
import { block, groundShadow } from './world.js';

const outline = [
  [0, -1], [0.73, -0.89], [1, -0.32], [0.94, 0.55], [0.57, 0.9],
  [0, 1], [-0.57, 0.9], [-0.94, 0.55], [-1, -0.32], [-0.73, -0.89],
];
const up = new THREE.Vector3(0, 1, 0);
const detail = new THREE.IcosahedronGeometry(1, 0);

const surface = (color, options = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.91, flatShading: true, ...options,
});
const shaped = (color, options) => surface(color, { vertexColors: true, ...options });
const wardrobe = {
  logan: {
    jacket: shaped(0x414342, { roughness: 0.71 }),
    seam: surface(0x303332),
    shirt: shaped(0x77736c),
    trousers: shaped(0x303742),
  },
  megan: {
    jacket: shaped(0x3b5158, { roughness: 0.82 }),
    seam: surface(0x2b3c43),
    shirt: shaped(0x7d746c),
    trousers: shaped(0x282d36),
  },
};
const skin = shaped(0xc39370, { side: THREE.DoubleSide });
const ear = surface(0xb68465);
const dark = surface(0x222521);
const boots = shaped(0x302c28);
const hairTie = shaped(0x2d3028);
const cord = surface(0x242222);
const gold = surface(0xe5aa4c, { metalness: 0.42, roughness: 0.47, emissive: 0x55320b, emissiveIntensity: 0.35 });
const enamel = surface(0x283951);
const hair = shaped(0x29231e, { side: THREE.DoubleSide });
const hairShade = shaped(0x211e1a, { side: THREE.DoubleSide });
const eyelid = surface(0x40312a);
const sclera = surface(0xd1b9a1);
const iris = surface(0x211b17);
const lips = surface(0x93654f);
const pistol = surface(0x292e2e, { roughness: 0.44, metalness: 0.35 });

function meshFromTriangles(parent, triangles, material) {
  const position = [];
  const colors = [];
  const uv = [];
  triangles.forEach((triangle, index) => {
    const tone = 0.84 + ((index * 11 + Math.floor(index / 7) * 3) % 13) * 0.018;
    for (const vertex of triangle) {
      position.push(...vertex.point);
      colors.push(tone, tone, tone);
      uv.push(...vertex.uv);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}

// The profile runs from bottom to top. A ring can shift in depth to form bends and folds.
function profile(parent, rings, material) {
  const [bottom] = rings[0];
  const [top] = rings.at(-1);
  const sides = outline.length;
  const vertex = (ring, i) => {
    const [y, width, depth, offset = 0, xOffset = 0] = rings[ring];
    const [x, z] = outline[i % sides];
    return { point: [x * width + xOffset, y, z * depth + offset], uv: [i / sides, (y - bottom) / (top - bottom)] };
  };
  const center = ([y, , , z = 0, x = 0]) => ({ point: [x, y, z], uv: [0.5, 0.5] });
  const triangles = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const a = vertex(j, i);
      const b = vertex(j, i + 1);
      const c = vertex(j + 1, i);
      const d = vertex(j + 1, i + 1);
      triangles.push([a, c, b], [b, c, d]);
    }
  }
  for (let i = 0; i < sides; i++) {
    triangles.push([center(rings[0]), vertex(0, i), vertex(0, i + 1)]);
    triangles.push([center(rings.at(-1)), vertex(rings.length - 1, i + 1), vertex(rings.length - 1, i)]);
  }
  return meshFromTriangles(parent, triangles, material);
}

function segment(parent, start, end, startRadius, endRadius, material) {
  const from = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(from);
  const length = direction.length();
  const mesh = profile(parent, [
    [0, startRadius * 0.83, startRadius * 0.83],
    [length * 0.24, startRadius, startRadius],
    [length * 0.83, endRadius, endRadius],
    [length, endRadius * 0.88, endRadius * 0.88],
  ], material);
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  return mesh;
}

function angularDetail(parent, x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(detail, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  parent.add(mesh);
  return mesh;
}

function strip(parent, from, to, width, depth, material) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const midpoint = start.clone().lerp(end, 0.5);
  const bar = block(parent, midpoint.x, midpoint.y, midpoint.z, width, start.distanceTo(end), depth, material);
  bar.quaternion.setFromUnitVectors(up, end.sub(start).normalize());
}

function facialFeatures(head, logan) {
  for (const side of [-1, 1]) {
    const x = side * 0.046;
    const eye = new THREE.Group();
    eye.position.set(x, 0.008, -0.101);
    eye.rotation.y = -side * 0.19;
    head.add(eye);
    block(eye, 0, 0.002, -0.008, 0.047, 0.03, 0.01, eyelid);
    block(eye, 0, -0.003, -0.013, 0.04, 0.018, 0.005, sclera);
    block(eye, side * 0.004, -0.001, -0.017, 0.02, 0.022, 0.007, iris);
    const brow = block(eye, 0, 0.027, -0.009, 0.051, logan ? 0.014 : 0.01, 0.009, eyelid);
    brow.rotation.z = side * 0.14;
    angularDetail(head, side * 0.114, -0.028, 0.007, 0.027, 0.05, 0.033, ear);
  }
  const feature = (points, faces, material) => meshFromTriangles(head, faces.map(face =>
    face.map(index => ({ point: points[index], uv: [0, 0] }))), material);
  feature([
    [0, 0.02, -0.108], [-0.019, -0.052, -0.104], [0.018, -0.052, -0.104],
    [0.001, -0.039, -0.137], [0, -0.06, -0.115],
  ], [[0, 1, 3], [0, 3, 2], [1, 4, 3], [2, 3, 4]], skin);
  block(head, 0, -0.081, -0.104, 0.045, 0.006, 0.008, lips);
  if (logan) return;

  const lock = points => feature(points, [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]], hair);
  lock([[-0.116, 0.071, -0.054], [-0.048, 0.146, -0.096], [0.066, 0.102, -0.116],
    [-0.092, -0.102, -0.064], [-0.066, 0.037, -0.132]]);
  lock([[0.026, 0.136, -0.105], [0.103, 0.122, -0.071], [0.122, 0.051, -0.05],
    [0.103, -0.054, -0.08], [0.092, 0.071, -0.116]]);
  lock([[-0.142, 0.082, 0.009], [-0.092, 0.099, -0.071], [-0.099, -0.105, -0.053],
    [-0.13, -0.055, 0.024], [-0.132, 0.014, -0.057]]);
}

function makeHead(pose, logan) {
  const head = new THREE.Group();
  head.position.y = 1.616;
  pose.add(head);
  profile(head, [
    [-0.132, logan ? 0.082 : 0.058, 0.07, -0.017],
    [-0.095, logan ? 0.11 : 0.093, 0.092, -0.012],
    [-0.046, 0.113, 0.102, -0.004], [0.024, 0.119, 0.109, 0.002],
    [0.096, 0.112, 0.107, 0.009], [0.144, 0.084, 0.08, 0.017],
  ], skin);
  if (logan) {
    profile(head, [
      [-0.045, 0.109, 0.063, 0.061], [0.064, 0.122, 0.084, 0.041],
      [0.112, 0.134, 0.119, 0.012], [0.153, 0.117, 0.112, 0.009],
      [0.169, 0.074, 0.077, 0.011, 0.012],
    ], hairShade);
    facialFeatures(head, true);
    return null;
  }
  profile(head, [
    [-0.085, 0.103, 0.06, 0.066], [0.009, 0.132, 0.094, 0.037],
    [0.092, 0.142, 0.129, 0.014], [0.143, 0.123, 0.128, 0.012],
    [0.174, 0.092, 0.087, 0.008, -0.01], [0.184, 0.043, 0.05, 0.012, -0.018],
  ], hairShade);
  facialFeatures(head, false);
  const ponytail = new THREE.Group();
  ponytail.position.set(0, 0.102, 0.119);
  head.add(ponytail);
  segment(ponytail, [0, 0.006, -0.004], [0, 0.017, 0.046], 0.042, 0.045, hairTie);
  profile(ponytail, [
    [-0.313, 0.007, 0.012, 0.172, -0.021], [-0.235, 0.042, 0.043, 0.167, -0.011],
    [-0.124, 0.062, 0.063, 0.156], [-0.023, 0.072, 0.069, 0.129],
    [0.042, 0.061, 0.064, 0.09], [0.067, 0.039, 0.039, 0.058],
  ], hair);
  profile(ponytail, [
    [-0.271, 0.005, 0.009, 0.208, 0.043], [-0.173, 0.032, 0.038, 0.183, 0.031],
    [-0.071, 0.047, 0.054, 0.146, 0.018], [0.038, 0.029, 0.036, 0.107],
  ], hairShade);
  return ponytail;
}

function makeBadge(pose) {
  for (const side of [-1, 1]) {
    const middle = [side * 0.062, 1.385, -0.126];
    strip(pose, [side * 0.066, 1.46, -0.048], middle, 0.019, 0.011, cord);
    strip(pose, middle, [0, 1.28, -0.179], 0.018, 0.012, cord);
  }
  const badge = new THREE.Group();
  badge.position.set(0, 1.212, -0.17);
  badge.rotation.y = Math.PI;
  pose.add(badge);
  const shield = new THREE.Shape();
  shield.moveTo(-0.056, 0.064);
  shield.lineTo(0, 0.073);
  shield.lineTo(0.056, 0.064);
  shield.lineTo(0.061, 0.022);
  shield.lineTo(0.047, -0.034);
  shield.lineTo(0, -0.073);
  shield.lineTo(-0.047, -0.034);
  shield.lineTo(-0.061, 0.022);
  shield.closePath();
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(shield, { depth: 0.008, bevelEnabled: false }), gold);
  const backing = new THREE.Mesh(plate.geometry, cord);
  backing.scale.set(1.2, 1.18, 1);
  backing.position.z = -0.007;
  badge.add(backing, plate);
  block(badge, 0, 0.081, 0.006, 0.025, 0.027, 0.014, gold);

  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.026, 12), enamel);
  emblem.position.set(0, -0.012, 0.009);
  badge.add(emblem);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? 0.007 : 0.016;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();
  const insignia = new THREE.Mesh(new THREE.ShapeGeometry(star), gold);
  insignia.position.set(0, -0.012, 0.011);
  badge.add(insignia);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  context.font = 'bold 31px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#241c15';
  context.fillText('POLICE', 64, 24);
  const label = new THREE.CanvasTexture(canvas);
  label.colorSpace = THREE.SRGBColorSpace;
  const lettering = new THREE.Mesh(new THREE.PlaneGeometry(0.103, 0.038),
    new THREE.MeshBasicMaterial({ map: label, transparent: true, depthWrite: false }));
  lettering.position.set(0, 0.038, 0.01);
  badge.add(lettering);
}

function makeClothes(pose, outfit) {
  profile(pose, [
    [0.79, 0.17, 0.121], [0.916, 0.194, 0.124],
  ], outfit.trousers);
  profile(pose, [
    [0.886, 0.194, 0.128, 0.006], [1.02, 0.173, 0.122],
    [1.177, 0.201, 0.136, -0.01], [1.334, 0.221, 0.126],
    [1.411, 0.177, 0.107], [1.456, 0.077, 0.067],
  ], outfit.jacket);
  profile(pose, [[1.404, 0.068, 0.057], [1.527, 0.063, 0.062]], skin);
  profile(pose, [
    [0.898, 0.038, 0.023, -0.112], [1.139, 0.058, 0.019, -0.134],
    [1.322, 0.092, 0.019, -0.125], [1.401, 0.081, 0.024, -0.09],
    [1.445, 0.066, 0.014, -0.063],
  ], outfit.shirt);
  for (const side of [-1, 1]) {
    strip(pose, [side * 0.058, 1.443, -0.065], [side * 0.107, 1.344, -0.119], 0.051, 0.024, outfit.seam);
    strip(pose, [side * 0.107, 1.344, -0.119], [side * 0.06, 1.174, -0.152], 0.031, 0.016, outfit.seam);
    strip(pose, [side * 0.06, 1.174, -0.151], [side * 0.041, 0.901, -0.133], 0.015, 0.01, outfit.seam);
    strip(pose, [side * 0.094, 1.036, -0.121], [side * 0.164, 1.106, -0.087], 0.019, 0.012, outfit.seam);
  }
  strip(pose, [-0.125, 1.308, 0.113], [0.125, 1.308, 0.113], 0.014, 0.015, outfit.seam);
  makeBadge(pose);
}

function makeLeg(pose, side, trousers) {
  const leg = new THREE.Group();
  leg.position.set(side * 0.113, 0.847, 0);
  pose.add(leg);
  profile(leg, [
    [-0.704, 0.068, 0.064, 0.012], [-0.6, 0.075, 0.072, 0.02],
    [-0.403, 0.081, 0.077, -0.019], [-0.238, 0.096, 0.096, 0.016],
    [-0.077, 0.107, 0.108, 0.006], [0.057, 0.102, 0.105, 0.012],
  ], trousers);
  profile(leg, [
    [-0.842, 0.078, 0.128, -0.038], [-0.809, 0.08, 0.13, -0.04],
    [-0.765, 0.075, 0.113, -0.033], [-0.707, 0.07, 0.077, 0.01],
    [-0.64, 0.074, 0.068, 0.012],
  ], boots);
  block(leg, 0, -0.829, -0.037, 0.135, 0.028, 0.224, dark);
  return leg;
}

function makeArms(pose, outfit) {
  const arm = new THREE.Group();
  arm.position.y = 1.34;
  pose.add(arm);
  const rightElbow = [0.275, -0.154, -0.208];
  const leftElbow = [-0.252, -0.173, -0.172];
  segment(arm, [0.198, 0.028, 0.014], rightElbow, 0.081, 0.067, outfit.jacket);
  segment(arm, [-0.198, 0.026, 0.014], leftElbow, 0.08, 0.065, outfit.jacket);
  segment(arm, rightElbow, [0.184, -0.092, -0.394], 0.065, 0.046, outfit.jacket);
  segment(arm, leftElbow, [0.063, -0.115, -0.393], 0.063, 0.045, outfit.jacket);
  segment(arm, [0.19, -0.095, -0.375], [0.183, -0.091, -0.404], 0.045, 0.047, outfit.seam);
  segment(arm, [0.048, -0.118, -0.383], [0.084, -0.109, -0.409], 0.043, 0.045, outfit.seam);
  segment(arm, [0.184, -0.092, -0.393], [0.172, -0.071, -0.491], 0.043, 0.05, skin);
  segment(arm, [0.05, -0.117, -0.4], [0.152, -0.089, -0.486], 0.043, 0.045, skin);
  block(arm, 0.177, 0.008, -0.585, 0.074, 0.067, 0.277, pistol);
  block(arm, 0.177, -0.024, -0.569, 0.065, 0.035, 0.23, dark);
  const grip = block(arm, 0.177, -0.08, -0.489, 0.065, 0.127, 0.077, pistol);
  grip.rotation.x = -0.21;
  block(arm, 0.177, 0.047, -0.683, 0.022, 0.016, 0.029, dark);
  block(arm, 0.177, 0.046, -0.476, 0.052, 0.014, 0.025, dark);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.177, 0.005, -0.735);
  arm.add(muzzle);
  return { arm, muzzle };
}

export function makePlayer(officer) {
  const logan = officer === 'logan';
  const root = new THREE.Group();
  const pose = new THREE.Group();
  const outfit = wardrobe[officer];
  root.add(pose);
  if (logan) pose.scale.x = 1.1;
  groundShadow(root, 1.32, 0.9);
  makeClothes(pose, outfit);
  const ponytail = makeHead(pose, logan);
  const legs = [-1, 1].map(side => makeLeg(pose, side, outfit.trousers));
  const { arm, muzzle } = makeArms(pose, outfit);
  return { root, pose, legs, arm, muzzle, ponytail };
}
