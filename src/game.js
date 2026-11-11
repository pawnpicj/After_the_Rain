import * as THREE from 'three';
import { makeEnemy, makeWorld } from './world.js';
import { makePlayer } from './player-model.js';
import { makeSound } from './sound.js';
import { setupDisplayControls } from './display.js';
import { missionLabel, missions, opening } from './campaign.js';

const ui = Object.fromEntries([
  'game', 'scene', 'damage', 'hud', 'objective', 'remaining', 'alarm-status', 'health-value', 'health',
  'focus-value', 'focus', 'ammo', 'reload-status', 'reticle', 'time-status', 'prompt',
  'overlay', 'chapter', 'screen-title', 'description', 'story-lead', 'primary',
  'restart', 'controls', 'character-select', 'return-menu', 'mission-label',
].map(id => [id, document.getElementById(id)]));

const titleMarkup = ui['screen-title'].innerHTML;
const screens = {
  menu: ['คดีตระกูล WOLF', '', opening, 'เริ่มสืบคดี'],
  paused: ['หยุดชั่วคราว', 'หยุดเกม', 'กลับไปเล่นต่อจากตำแหน่งเดิม', 'เล่นต่อ'],
  lost: ['ภารกิจล้มเหลว', 'เสียแนวคุ้มกัน', 'ใช้ที่กำบังและสโลว์เวลาเพื่อรับมือกับคนของ JK', 'ลองด่านนี้อีกครั้ง'],
  error: ['เริ่มเกมไม่ได้', 'เปิดฉาก 3D ไม่สำเร็จ', 'ลองเปิดไฟล์นี้ใน Chrome หรือ Edge ที่รองรับ WebGL 2', 'ลองโหลดใหม่'],
};

function showScreen(mode, missionIndex = 0) {
  ui.overlay.dataset.mode = mode;
  ui.overlay.hidden = mode === 'playing';
  ui.hud.hidden = mode !== 'playing';
  if (mode === 'playing') return;
  const mission = missions[missionIndex];
  const debrief = mode === 'debrief' || mode === 'won';
  const [chapter, title, description, primary] = debrief ? [
    missionLabel(missionIndex) + ' / จบภารกิจ',
    mission.reveal,
    mission.debrief,
    mode === 'won' ? 'กลับหน้าเลือกตัวละคร' : 'ไปด่านถัดไป',
  ] : screens[mode];
  ui.chapter.textContent = chapter;
  if (mode === 'menu') ui['screen-title'].innerHTML = titleMarkup;
  else ui['screen-title'].textContent = title;
  ui.description.textContent = description;
  ui.primary.textContent = primary;
  ui['story-lead'].textContent = debrief ? mission.lead : '';
  ui['story-lead'].hidden = !debrief;
  ui['character-select'].hidden = mode !== 'menu';
  ui.controls.hidden = mode !== 'menu' && mode !== 'paused';
  ui.restart.hidden = mode !== 'paused';
  ui['return-menu'].hidden = mode !== 'paused' && mode !== 'lost';
  if (mode !== 'menu') ui.primary.focus();
}

setupDisplayControls();

try {
  startGame();
} catch (error) {
  console.error(error);
  showScreen('error');
  ui.primary.disabled = false;
  ui.primary.addEventListener('click', () => location.reload());
}

function startGame() {
  const renderer = new THREE.WebGLRenderer({ canvas: ui.scene, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  const gameplayFov = 61;
  const camera = new THREE.PerspectiveCamera(43, 1, 0.06, 135);
  const worlds = [makeWorld(missions[0])];
  let world = worlds[0];
  let { scene, obstacles } = world;
  const sound = makeSound();
  const officers = { logan: makePlayer('logan'), megan: makePlayer('megan') };
  let body = officers.megan;
  const portraitLights = new THREE.Group();
  const portraitKey = new THREE.PointLight(0xffd6a5, 34, 8);
  portraitKey.position.set(1.6, 2.62, 22.8);
  const portraitRim = new THREE.PointLight(0xb3ced6, 22, 6);
  portraitRim.position.set(4.1, 2.16, 19.5);
  portraitLights.add(portraitKey, portraitRim);
  scene.add(portraitLights);
  const player = {
    yaw: 0, pitch: -0.025, hp: 100, focus: 100, ammo: 12, reserve: 60,
    reload: 0, cooldown: 0, dive: 0, recover: 0, rest: 0, gait: 0,
    diveDirection: new THREE.Vector3(),
  };
  const magazineSize = 12;
  const defaultSpawn = [0, 12.4];
  const alarmSeconds = 5.6;
  const diveLength = 0.77;
  const keys = new Set();
  const enemies = [];
  const projectiles = [];
  const effects = [];
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const wallRay = new THREE.Ray();
  const wallPoint = new THREE.Vector3();
  const bulletGeometry = new THREE.SphereGeometry(0.049, 7, 5);
  const enemyBulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffa664 });
  const tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffdf9e, transparent: true, opacity: 0.85 });
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc83 });
  const particleGeometry = new THREE.BoxGeometry(0.046, 0.046, 0.046);
  const flashlight = new THREE.PointLight(0xffba71, 0, 8);
  scene.add(flashlight);

  let mode = 'menu';
  let missionIndex = 0;
  let mission = missions[0];
  let wave = 0;
  let nextWave = 0;
  let evidenceReady = false;
  let uploadRemaining = null;
  let alarmRemaining = 0;
  let stopAlarm;
  let hasLock = false;
  let fallback = false;
  let dragging = false;
  let slow = false;
  let exhausted = false;
  let hitTime = 0;
  let damageTime = 0;
  let muzzleTime = 0;
  let recoil = 0;

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function setMode(nextMode) {
    mode = nextMode;
    keys.clear();
    dragging = false;
    showScreen(mode, missionIndex);
    if (mode !== 'playing' && document.pointerLockElement === ui.scene) document.exitPointerLock();
    if (mode !== 'playing') {
      silenceAlarm();
      ui.game.dataset.slow = 'false';
      ui.damage.style.opacity = '0';
    }
  }

  function requestAim() {
    hasLock = false;
    fallback = !ui.scene.requestPointerLock;
    if (fallback) return;
    try {
      ui.scene.requestPointerLock()?.catch(() => { fallback = true; });
    } catch {
      fallback = true;
    }
  }

  function begin(index) {
    if (mode === 'menu') {
      portraitLights.visible = false;
      camera.fov = gameplayFov;
      camera.updateProjectionMatrix();
    }
    if (index !== undefined) resetMission(index);
    setMode('playing');
    ui.primary.blur();
    ui.restart.blur();
    sound.unlock();
    if (alarmRemaining > 0) stopAlarm = sound.playAlarm(alarmRemaining);
    updateCamera(0, true);
    updateHud();
    requestAim();
  }

  ui.primary.disabled = false;
  ui.primary.addEventListener('click', () => {
    if (mode === 'won') openMenu();
    else if (mode === 'paused') begin();
    else begin(mode === 'debrief' ? missionIndex + 1 : missionIndex);
  });
  ui.restart.addEventListener('click', () => begin(missionIndex));
  ui['return-menu'].addEventListener('click', openMenu);
  ui['character-select'].addEventListener('change', selectOfficer);
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === ui.scene) {
      if (mode !== 'playing') {
        document.exitPointerLock();
        return;
      }
      hasLock = true;
      fallback = false;
    } else if (hasLock) {
      hasLock = false;
      if (mode === 'playing') setMode('paused');
    }
  });
  document.addEventListener('pointerlockerror', () => { fallback = true; });
  window.addEventListener('blur', () => {
    if (mode === 'playing') setMode('paused');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') setMode('paused');
  });
  window.addEventListener('keydown', event => {
    if (mode !== 'playing') return;
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Escape') setMode('paused');
    if (event.code === 'KeyR') reload();
    if (event.code === 'Space') dive();
    if (event.code === 'KeyE') interact();
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  ui.scene.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('mousedown', event => {
    if (mode !== 'playing' || event.target !== ui.scene) return;
    if (event.button === 2 && fallback) dragging = true;
    if (event.button === 0) shoot();
  });
  document.addEventListener('mouseup', event => {
    if (event.button === 2) dragging = false;
  });
  document.addEventListener('mousemove', event => {
    if (mode !== 'playing' || (!hasLock && !dragging)) return;
    player.yaw -= event.movementX * 0.00245;
    player.pitch = THREE.MathUtils.clamp(player.pitch - event.movementY * 0.00245, -0.62, 0.56);
  });

  function resetMission(index) {
    silenceAlarm();
    for (const enemy of enemies) scene.remove(enemy.body.root);
    for (const shot of projectiles) scene.remove(shot.mesh);
    for (const effect of effects) removeEffect(effect);
    enemies.length = projectiles.length = effects.length = 0;
    missionIndex = index;
    mission = missions[index];
    world = worlds[index] ??= makeWorld(mission);
    ({ scene, obstacles } = world);
    scene.add(body.root, portraitLights, flashlight);
    ui['mission-label'].textContent = missionLabel(index);
    Object.assign(player, {
      yaw: 0, pitch: -0.025, hp: 100, focus: 100, ammo: magazineSize, reserve: 60,
      reload: 0, cooldown: 0, dive: 0, recover: 0, rest: 0, gait: 0,
    });
    const [spawnX, spawnZ] = mission.spawn ?? defaultSpawn;
    body.root.position.set(spawnX, 0, spawnZ);
    body.pose.position.set(0, 0, 0);
    body.pose.rotation.set(0, 0, 0);
    body.legs.forEach(leg => { leg.rotation.x = 0; });
    body.arm.rotation.x = player.pitch;
    body.ponytail?.rotation.set(0, 0, 0);
    recoil = hitTime = damageTime = muzzleTime = nextWave = 0;
    flashlight.intensity = 0;
    slow = exhausted = evidenceReady = false;
    uploadRemaining = null;
    alarmRemaining = 0;
    world.entrance?.reset();
    world.setEvidenceReady(false);
    wave = 0;
    if (!world.entrance) spawnWave(mission.waves[wave++]);
  }

  function selectOfficer() {
    const officer = ui['character-select'].querySelector(':checked').value;
    body.root.removeFromParent();
    body = officers[officer];
    scene.add(body.root);
    body.root.position.set(2.65, 0, 20.7);
    body.pose.position.set(0, 0, 0);
    body.pose.rotation.set(0, 2.04, 0);
    body.legs.forEach(leg => { leg.rotation.x = 0; });
    body.arm.rotation.x = -0.49;
    body.ponytail?.rotation.set(0, 0, 0);
  }

  function openMenu() {
    resetMission(0);
    setMode('menu');
    selectOfficer();
    portraitLights.visible = true;
    camera.fov = 43;
    camera.updateProjectionMatrix();
    camera.position.set(0.9, 1.33, 23.55);
    camera.lookAt(1.38, 1.01, 20.7);
  }

  function spawnWave(positions) {
    const [spawnX, spawnZ] = mission.spawn ?? defaultSpawn;
    for (const [index, [x, z]] of positions.entries()) {
      const actor = makeEnemy(scene, Boolean(world.entrance));
      actor.root.position.set(x, 0, z);
      actor.pose.rotation.y = Math.atan2(x - spawnX, z - spawnZ);
      enemies.push({
        body: actor, hp: 2, fire: 1.5 + index * 0.4, phase: index * 1.53,
        gait: 0, falling: 0, waypoint: null, routeTime: 0,
      });
    }
  }

  function basis() {
    forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const pitch = player.pitch + recoil * 0.06;
    aim.copy(forward).multiplyScalar(Math.cos(pitch));
    aim.y = Math.sin(pitch);
  }

  function readMovement() {
    const front = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const side = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    return movement.copy(forward).multiplyScalar(front).addScaledVector(right, side).normalize();
  }

  function blocked(x, z, radius) {
    return obstacles.some(({ min, max }) =>
      min.y < 1.7 && x > min.x - radius && x < max.x + radius &&
      z > min.z - radius && z < max.z + radius);
  }

  function move(position, x, z, radius) {
    if (!blocked(position.x + x, position.z, radius)) position.x += x;
    if (!blocked(position.x, position.z + z, radius)) position.z += z;
  }

  function wallDistance(origin, direction, limit) {
    wallRay.set(origin, direction);
    let distance = limit;
    for (const obstacle of obstacles) {
      if (wallRay.intersectBox(obstacle, wallPoint)) {
        distance = Math.min(distance, wallPoint.distanceTo(origin));
      }
    }
    if (direction.y < -0.0001) distance = Math.min(distance, origin.y / -direction.y);
    return distance;
  }

  function updateCamera(dt, snap = false) {
    basis();
    const eye = body.root.position.clone().add(new THREE.Vector3(0, 1.48 - (player.dive > 0 ? 0.48 : 0), 0));
    const offset = right.clone().multiplyScalar(0.88).addScaledVector(forward, -3.6);
    offset.y = 0.64;
    const length = offset.length();
    offset.divideScalar(length);
    const clear = wallDistance(eye, offset, length);
    const desired = eye.addScaledVector(offset, Math.max(0.11, clear - 0.17));
    camera.position.lerp(desired, snap || clear < length ? 1 : 1 - Math.exp(-dt * 18));
    camera.lookAt(camera.position.clone().add(aim));
  }

  function dive() {
    if (player.dive > 0 || player.recover > 0 || player.focus < 16) return;
    basis();
    const direction = readMovement();
    player.diveDirection.copy(direction.lengthSq() ? direction : forward);
    player.dive = diveLength;
    player.focus -= 16;
    player.rest = 1.1;
    sound.play('dive', true);
  }

  function reload() {
    if (player.reload > 0 || player.ammo === magazineSize || player.reserve === 0) return;
    player.reload = 0.95;
    sound.play('reload', slow);
  }

  function sphereDistance(origin, direction, center, radius) {
    const delta = center.clone().sub(origin);
    const along = delta.dot(direction);
    const discriminant = radius * radius - delta.lengthSq() + along * along;
    if (discriminant < 0 || along < 0) return Infinity;
    return Math.max(0, along - Math.sqrt(discriminant));
  }

  const enemyBox = new THREE.Box3();
  function trace(origin, direction, limit = 60) {
    let distance = wallDistance(origin, direction, limit);
    let target = null;
    let headshot = false;
    wallRay.set(origin, direction);
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const position = enemy.body.root.position;
      const head = position.clone().add(new THREE.Vector3(0, 1.63, 0));
      const headDistance = sphereDistance(origin, direction, head, 0.19);
      enemyBox.min.set(position.x - 0.31, 0.12, position.z - 0.28);
      enemyBox.max.set(position.x + 0.31, 1.47, position.z + 0.28);
      const torso = wallRay.intersectBox(enemyBox, wallPoint) ? wallPoint.distanceTo(origin) : Infinity;
      const hit = Math.min(headDistance, torso);
      if (hit < distance) {
        distance = hit;
        target = enemy;
        headshot = headDistance <= torso;
      }
    }
    return { distance, target, headshot };
  }

  function aimShot() {
    const crosshair = trace(camera.position, aim);
    const point = camera.position.clone().addScaledVector(aim, crosshair.distance);
    const origin = body.muzzle.getWorldPosition(new THREE.Vector3());
    const direction = point.clone().sub(origin).normalize();
    return { origin, direction, hit: trace(origin, direction, origin.distanceTo(point) + 0.025) };
  }

  function shoot() {
    if (player.reload > 0 || player.cooldown > 0) return;
    if (player.ammo === 0) {
      sound.play('empty', slow);
      reload();
      return;
    }
    basis();
    camera.lookAt(camera.position.clone().add(aim));
    const { origin, direction, hit } = aimShot();
    player.ammo--;
    player.cooldown = 0.18;
    recoil = 1;
    muzzleTime = 0.045;
    flashlight.position.copy(origin);
    flashlight.intensity = 75;
    sound.play('shot', slow);
    const impact = origin.clone().addScaledVector(direction, hit.distance);
    tracer(origin, impact, slow ? 0.19 : 0.07);
    sparks(impact);
    if (hit.target) {
      hitTime = 0.17;
      hit.target.hp -= hit.headshot ? 2 : 1;
      hit.target.fire = Math.max(hit.target.fire, 0.33);
      if (hit.target.hp <= 0) player.focus = Math.min(100, player.focus + 20);
    }
    updateHud();
  }

  function tracer(from, to, life) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mesh = new THREE.Line(geometry, tracerMaterial);
    scene.add(mesh);
    effects.push({ mesh, life, disposable: true });
  }

  function sparks(position) {
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(particleGeometry, sparkMaterial);
      mesh.position.copy(position);
      scene.add(mesh);
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 3);
      effects.push({ mesh, velocity, life: 0.22 + Math.random() * 0.12 });
    }
  }

  function removeEffect(effect) {
    scene.remove(effect.mesh);
    if (effect.disposable) effect.mesh.geometry.dispose();
  }

  function animateEffects(dt, worldDt) {
    hitTime = Math.max(0, hitTime - dt);
    damageTime = Math.max(0, damageTime - dt * 2.5);
    recoil = Math.max(0, recoil - dt * 6);
    muzzleTime -= dt;
    if (muzzleTime <= 0) flashlight.intensity = 0;
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      effect.life -= worldDt;
      if (effect.life <= 0) {
        removeEffect(effect);
        effects.splice(i, 1);
      } else if (effect.velocity) {
        effect.mesh.position.addScaledVector(effect.velocity, worldDt);
        effect.velocity.y -= worldDt * 9;
      }
    }
  }

  function animatePlayer(dt) {
    basis();
    const timeHeld = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (!timeHeld) exhausted = false;
    const slowing = timeHeld && !exhausted && player.focus > 0;
    slow = slowing || player.dive > 0;
    if (slowing) {
      player.focus = Math.max(0, player.focus - dt * 23);
      player.rest = 1.1;
      if (player.focus === 0) exhausted = true;
    } else {
      player.rest -= dt;
      if (player.rest <= 0) player.focus = Math.min(100, player.focus + dt * 13);
    }
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.recover = Math.max(0, player.recover - dt);
    if (player.reload > 0) {
      player.reload = Math.max(0, player.reload - dt);
      if (player.reload === 0) {
        const loaded = Math.min(magazineSize - player.ammo, player.reserve);
        player.ammo += loaded;
        player.reserve -= loaded;
        sound.play('reload', slow);
      }
    }

    const direction = readMovement();
    const speed = player.recover > 0 ? 2.4 : slow ? 4.25 : 5.4;
    const pose = body.pose;
    pose.rotation.y = player.yaw;
    body.arm.rotation.x = player.pitch + recoil * 0.27 - (player.reload ? 0.61 : 0);
    let step = 0;
    if (player.dive > 0) {
      const progress = 1 - player.dive / diveLength;
      const arc = Math.sin(Math.PI * progress);
      const dx = player.diveDirection.x;
      const dz = player.diveDirection.z;
      move(body.root.position, dx * dt * 8.8, dz * dt * 8.8, 0.36);
      pose.position.y = arc * 0.56;
      pose.rotation.x = -player.diveDirection.dot(forward) * arc * 1.13;
      pose.rotation.z = -player.diveDirection.dot(right) * arc * 1.13;
      body.legs[0].rotation.x = arc * 0.41;
      body.legs[1].rotation.x = -arc * 0.31;
      player.dive = Math.max(0, player.dive - dt);
      if (player.dive === 0) player.recover = 0.29;
    } else {
      move(body.root.position, direction.x * dt * speed, direction.z * dt * speed, 0.36);
      player.gait += dt * 12 * (direction.lengthSq() ? 1 : 0);
      step = direction.lengthSq() ? Math.sin(player.gait) : 0;
      pose.position.y = Math.abs(step) * 0.048;
      pose.rotation.x = -0.09 * direction.dot(forward);
      pose.rotation.z = -0.13 * direction.dot(right);
      body.legs[0].rotation.x = step * 0.57;
      body.legs[1].rotation.x = -step * 0.57;
    }
    if (body.ponytail) {
      const tail = body.ponytail.rotation;
      tail.x = THREE.MathUtils.damp(tail.x, -pose.rotation.x * 0.6 + Math.abs(step) * 0.13, 12, dt);
      tail.z = THREE.MathUtils.damp(tail.z, -pose.rotation.z * 0.6 + step * 0.11, 12, dt);
    }
  }

  function pathStep(from, to) {
    const cellSize = 1.3;
    const width = 24;
    const depth = mission.environment === 'dock' ? 40 : 33;
    const indexOf = point => {
      const x = THREE.MathUtils.clamp(Math.round((point.x + 15) / cellSize), 0, width - 1);
      const z = THREE.MathUtils.clamp(Math.round((point.z + 25.5) / cellSize), 0, depth - 1);
      return x + z * width;
    };
    const toPoint = index => new THREE.Vector3(index % width * cellSize - 15, 0, Math.floor(index / width) * cellSize - 25.5);
    const start = indexOf(from);
    const goal = indexOf(to);
    const visited = new Set([start]);
    const queue = [{ index: start, first: start }];
    let best = queue[0];
    let bestDistance = toPoint(start).distanceToSquared(to);
    for (let i = 0; i < queue.length; i++) {
      const { index, first } = queue[i];
      const distance = toPoint(index).distanceToSquared(to);
      if (distance < bestDistance) {
        best = queue[i];
        bestDistance = distance;
      }
      if (index === goal) break;
      const x = index % width;
      for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width]) {
        if (next < 0 || next >= width * depth || visited.has(next)) continue;
        visited.add(next);
        const point = toPoint(next);
        if (blocked(point.x, point.z, 0.43)) continue;
        queue.push({ index: next, first: first === start ? next : first });
      }
    }
    return best.first === start ? to : toPoint(best.first);
  }

  function enemyFire(enemy, position) {
    const origin = enemy.body.muzzle.getWorldPosition(new THREE.Vector3());
    const target = position.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.55, player.dive > 0 ? 0.64 : 1.15, (Math.random() - 0.5) * 0.55,
    ));
    const direction = target.sub(origin).normalize();
    const mesh = new THREE.Mesh(bulletGeometry, enemyBulletMaterial);
    mesh.position.copy(origin);
    scene.add(mesh);
    projectiles.push({ mesh, direction, life: 1.65 });
    tracer(origin, origin.clone().addScaledVector(direction, 0.5), 0.11);
    sound.play('enemy', slow);
  }

  function animateEnemies(dt) {
    const position = body.root.position;
    const speed = world.entrance ? 3.5 : 2.65;
    for (const enemy of enemies) {
      const { root, pose, arm, legs } = enemy.body;
      if (enemy.hp <= 0) {
        enemy.falling = Math.min(1, enemy.falling + dt * 4.2);
        pose.rotation.x = 1.55 * enemy.falling;
        pose.position.y = 0.18 * enemy.falling;
        continue;
      }
      const delta = position.clone().sub(root.position);
      const distance = Math.max(0.001, delta.length());
      const direction = delta.divideScalar(distance);
      pose.rotation.y = Math.atan2(-direction.x, -direction.z);
      const eye = root.position.clone().add(new THREE.Vector3(0, 1.34, 0));
      const canSee = wallDistance(eye, direction, distance) >= distance - 0.05;
      let travel;
      enemy.phase += dt * 1.45;
      enemy.routeTime -= dt;
      if (canSee) {
        enemy.waypoint = null;
        const approach = distance > 9.3 ? 1 : distance < 5.2 ? -0.55 : 0;
        const flank = Math.sin(enemy.phase) * 0.69;
        travel = new THREE.Vector3(
          direction.x * approach + direction.z * flank, 0, direction.z * approach - direction.x * flank,
        );
      } else {
        if (enemy.routeTime <= 0 || !enemy.waypoint || enemy.waypoint.distanceToSquared(root.position) < 0.12) {
          enemy.waypoint = pathStep(root.position, position);
          enemy.routeTime = 0.8;
        }
        travel = enemy.waypoint.clone().sub(root.position).normalize();
      }
      if (travel.lengthSq() > 1) travel.normalize();
      move(root.position, travel.x * dt * speed, travel.z * dt * speed, 0.37);
      enemy.gait += dt * 10 * travel.length();
      const step = Math.sin(enemy.gait) * travel.length();
      pose.position.y = Math.abs(step) * 0.038;
      legs[0].rotation.x = step * 0.43;
      legs[1].rotation.x = -step * 0.43;
      arm.rotation.x = canSee ? 0 : -0.36;
      enemy.fire -= dt;
      if (canSee && distance < 21 && enemy.fire <= 0) {
        enemyFire(enemy, position);
        enemy.fire = 1.5 + Math.random() * 0.86;
      }
    }
  }

  function animateProjectiles(dt) {
    const speed = 24;
    const playerCenter = body.root.position.clone().add(new THREE.Vector3(0, player.dive > 0 ? 0.72 : 1.12, 0));
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const shot = projectiles[i];
      const step = speed * dt;
      const origin = shot.mesh.position;
      const hit = wallDistance(origin, shot.direction, step);
      const hitPlayer = sphereDistance(origin, shot.direction, playerCenter, player.dive > 0 ? 0.41 : 0.53);
      shot.life -= dt;
      if (hitPlayer <= hit) {
        player.hp = Math.max(0, player.hp - 11);
        damageTime = 0.87;
        sound.play('impact', slow);
      }
      if (hitPlayer <= hit || hit < step || shot.life <= 0) {
        scene.remove(shot.mesh);
        projectiles.splice(i, 1);
      } else {
        origin.addScaledVector(shot.direction, step);
      }
    }
  }

  function remainingEnemies() {
    return enemies.reduce((total, enemy) => total + Number(enemy.hp > 0), 0);
  }

  function nearEvidence() {
    const { x, z } = body.root.position;
    const [proofX, proofZ] = mission.terminal;
    return Math.hypot(x - proofX, z - proofZ) <= 2.1;
  }

  function finishMission() {
    sound.play('clear');
    setMode(missionIndex + 1 < missions.length ? 'debrief' : 'won');
  }

  function silenceAlarm() {
    stopAlarm?.();
    stopAlarm = undefined;
  }

  function nearEntrance() {
    const entrance = world.entrance;
    if (!entrance || entrance.triggered) return false;
    const { x, z } = body.root.position;
    return Math.abs(x) < 2.65 && Math.abs(z - entrance.z) < 2.45;
  }

  function interact() {
    if (nearEntrance()) {
      world.entrance.activate();
      alarmRemaining = alarmSeconds;
      stopAlarm = sound.playAlarm(alarmRemaining);
      return;
    }
    if (!evidenceReady || !nearEvidence()) return;
    evidenceReady = false;
    if (mission.reinforcements) {
      uploadRemaining = mission.uploadSeconds;
      spawnWave(mission.reinforcements);
    } else {
      finishMission();
    }
  }

  function updateMission(elapsed) {
    if (player.hp <= 0) {
      setMode('lost');
      return;
    }
    if (world.entrance) {
      if (!world.entrance.triggered) return;
      if (alarmRemaining > 0) {
        alarmRemaining = Math.max(0, alarmRemaining - elapsed);
        if (alarmRemaining === 0) silenceAlarm();
      }
      world.entrance.update(elapsed, alarmRemaining > 0);
    }
    const remaining = remainingEnemies();
    if (uploadRemaining !== null) {
      uploadRemaining = Math.max(0, uploadRemaining - elapsed);
      if (uploadRemaining === 0 && remaining === 0) finishMission();
      return;
    }
    if (remaining || evidenceReady) return;
    if (wave < mission.waves.length) {
      nextWave += elapsed;
      if (nextWave >= (wave === 0 ? 1.25 : 1.7)) {
        spawnWave(mission.waves[wave++]);
        nextWave = 0;
      }
    } else {
      evidenceReady = true;
      world.setEvidenceReady(true);
      sound.play('clear');
    }
  }

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  function updateHud() {
    const remaining = remainingEnemies();
    const entrance = world.entrance;
    const enemiesText = (entrance ? 'รปภ. ' : 'ศัตรู ') + remaining + ' คน';
    ui['alarm-status'].hidden = alarmRemaining <= 0;
    if (entrance && !entrance.triggered) {
      setText(ui.objective, 'เดินไปที่ประตูลวดเหล็กแล้วกด E');
      setText(ui.remaining, 'ประตูทางเข้าท่าเรือแง้มอยู่');
    } else if (uploadRemaining !== null) {
      setText(ui.objective, 'คุ้มกันเครื่องส่งหลักฐาน');
      const progress = uploadRemaining > 0 ? 'ส่งข้อมูลอีก ' + Math.ceil(uploadRemaining) + ' วินาที' : 'ส่งข้อมูลแล้ว';
      setText(ui.remaining, progress + ' / ' + enemiesText);
    } else {
      setText(ui.objective, evidenceReady ? mission.action + ' ที่จุดไฟเขียว' : mission.objective);
      const incoming = entrance ? 'รปภ. กำลังเข้ามา' : 'ศัตรูระลอกใหม่กำลังมา';
      setText(ui.remaining, evidenceReady ? 'พื้นที่ปลอดภัย' : remaining ? enemiesText : incoming);
    }
    ui.health.style.transform = 'scaleX(' + player.hp / 100 + ')';
    ui.focus.style.transform = 'scaleX(' + player.focus / 100 + ')';
    setText(ui['health-value'], String(player.hp));
    setText(ui['focus-value'], Math.floor(player.focus) + '%');
    setText(ui.ammo.firstElementChild, String(player.ammo));
    if (ui.ammo.lastChild.nodeValue !== String(player.reserve)) ui.ammo.lastChild.nodeValue = String(player.reserve);
    setText(ui['reload-status'], player.reload > 0 ? 'กำลังบรรจุกระสุน' :
      player.ammo > 0 ? 'ปืนพก' : player.reserve > 0 ? 'R · บรรจุกระสุน' : 'กระสุนหมด');
    ui.reticle.dataset.target = Boolean(aimShot().hit.target);
    ui.reticle.dataset.hit = hitTime > 0;
    ui.game.dataset.slow = slow;
    ui['time-status'].hidden = !slow;
    ui.damage.style.opacity = damageTime;
    const prompt = nearEntrance() ? 'E · เปิดประตูทางเข้า' :
      evidenceReady && nearEvidence() ? 'E · ' + mission.action :
        fallback ? 'กดเมาส์ขวาค้างแล้วลากเพื่อเล็ง' : '';
    ui.prompt.hidden = !prompt;
    setText(ui.prompt, prompt);
  }

  openMenu();
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    const elapsed = Math.min(0.25, Math.max(0, (now - previous) / 1000));
    const dt = Math.min(0.04, elapsed);
    previous = now;
    if (mode === 'playing') {
      animatePlayer(dt);
      const worldDt = dt * (slow ? 0.26 : 1);
      animateEnemies(worldDt);
      animateProjectiles(worldDt);
      animateEffects(dt, worldDt);
      world.animate(worldDt);
      updateCamera(dt);
      updateMission(elapsed);
      if (mode === 'playing') updateHud();
    } else if (mode === 'menu') {
      const breath = Math.sin(now * 0.0021);
      body.pose.position.y = 0.003 * breath;
      body.arm.rotation.x = -0.49 + 0.013 * breath;
      if (body.ponytail) body.ponytail.rotation.z = 0.041 * Math.sin(now * 0.0028);
      world.animate(dt);
    }
    renderer.render(scene, camera);
  });
}
