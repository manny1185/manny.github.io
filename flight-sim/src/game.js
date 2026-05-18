import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const cfg = {
  dt: 0.04,
  gravity: 9.81,
  mass: 950,
  wingArea: 16.2,
  airDensity: 1.225,
  maxThrust: 6200,
  drag0: 0.028,
  dragK: 0.045,
  baseLift: 0.28,
  liftSlope: 4.4,
  maxPitchRate: degToRad(34),
  maxRollRate: degToRad(70),
  pitchLeveling: 0.25,
  rollLeveling: 1.35,
  yawGain: 0.95,
  throttleStep: 0.018,
  stallSpeed: 26,
  maxSpeed: 95,
  groundZ: 0,
  boundary: [-250, 1350, -650, 650, 0, 520],
  waypointRadius: 45,
  scorePerWaypoint: 100,
  levelCompleteBonus: 300,
  maxTrailPoints: 420,
  waypoints: [
    [150, -40, 125],
    [340, 125, 165],
    [590, -105, 195],
    [835, 95, 155],
    [1080, 0, 125]
  ],
  initialState: {
    pos: [0, -120, 115],
    speed: 48,
    pitch: degToRad(2),
    roll: 0,
    yaw: degToRad(12),
    throttle: 0.58,
    verticalSpeed: 0
  }
};

const refs = {
  canvas: document.querySelector("#flight-canvas"),
  status: document.querySelector("#status-pill"),
  score: document.querySelector("#score"),
  time: document.querySelector("#time"),
  target: document.querySelector("#target"),
  bestScore: document.querySelector("#best-score"),
  speed: document.querySelector("#speed"),
  altitude: document.querySelector("#altitude"),
  throttle: document.querySelector("#throttle"),
  throttleMeter: document.querySelector("#throttle-meter"),
  range: document.querySelector("#range"),
  inputState: document.querySelector("#input-state"),
  startButton: document.querySelector("#start-button"),
  pauseButton: document.querySelector("#pause-button"),
  resetButton: document.querySelector("#reset-button"),
  centerMessage: document.querySelector("#center-message"),
  messageTitle: document.querySelector("#message-title"),
  messageDetail: document.querySelector("#message-detail")
};

const game = {
  state: cloneState(cfg.initialState),
  control: neutralControl(),
  running: false,
  paused: false,
  status: "Ready",
  elapsed: 0,
  score: 0,
  targetIndex: 0,
  bestScore: Number(localStorage.getItem("sky-ring-pilot-best") || 0),
  trail: [],
  accumulator: 0,
  lastFrame: performance.now()
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c8ec);
scene.fog = new THREE.Fog(0x87c8ec, 560, 2100);

const renderer = new THREE.WebGLRenderer({
  canvas: refs.canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4000);
const clockVector = new THREE.Vector3();
const targetVector = new THREE.Vector3();
const tempMatrix = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();

const objects = {
  aircraft: null,
  rings: [],
  ringLights: [],
  trail: null,
  propeller: null
};

objects.aircraft = createAircraft();
objects.trail = createTrail();

initScene();
bindControls();
resetGame();
resize();
window.setInterval(() => animate(performance.now()), 1000 / 60);

function initScene() {
  scene.add(new THREE.HemisphereLight(0xd8f5ff, 0x56704b, 2.2));

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(380, 780, 220);
  sun.castShadow = true;
  sun.shadow.camera.left = -850;
  sun.shadow.camera.right = 850;
  sun.shadow.camera.top = 850;
  sun.shadow.camera.bottom = -850;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1800;
  scene.add(sun);

  createTerrain();
  createRunway();
  createBoundaryGrid();
  createCloudBank();
  createWaypoints();

  scene.add(objects.trail);
  scene.add(objects.aircraft);
}

function createTerrain() {
  const width = cfg.boundary[1] - cfg.boundary[0] + 1200;
  const depth = cfg.boundary[3] - cfg.boundary[2] + 1200;
  const geometry = new THREE.PlaneGeometry(width, depth, 96, 96);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(520, -0.12, 0);

  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const ridge = 7 * Math.sin(x * 0.012) * Math.cos(z * 0.009);
    const roll = 3 * Math.sin((x + z) * 0.018);
    positions.setY(i, ridge + roll - 9);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x4f7b48,
    roughness: 0.92,
    metalness: 0.02
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  scene.add(ground);
}

function createRunway() {
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 56),
    new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.75 })
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(220, 0.18, 0);
  runway.receiveShadow = true;
  scene.add(runway);

  const centerLineMaterial = new THREE.LineBasicMaterial({ color: 0xf8f3d7 });
  const linePoints = [];
  for (let x = -70; x < 500; x += 60) {
    linePoints.push(new THREE.Vector3(x, 0.28, 0), new THREE.Vector3(x + 34, 0.28, 0));
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePoints), centerLineMaterial));

  const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xe5edf2, roughness: 0.62 });
  for (const z of [-24, 24]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(600, 0.35, 1.4), markerMaterial);
    stripe.position.set(220, 0.5, z);
    scene.add(stripe);
  }
}

function createBoundaryGrid() {
  const material = new THREE.LineBasicMaterial({ color: 0x8ec28a, transparent: true, opacity: 0.34 });
  const points = [];
  const xMin = cfg.boundary[0];
  const xMax = cfg.boundary[1];
  const yMin = cfg.boundary[2];
  const yMax = cfg.boundary[3];

  for (let x = -200; x <= 1300; x += 100) {
    points.push(simToThree([x, yMin, 1]), simToThree([x, yMax, 1]));
  }
  for (let y = -600; y <= 600; y += 100) {
    points.push(simToThree([xMin, y, 1]), simToThree([xMax, y, 1]));
  }

  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), material);
  scene.add(grid);

  const borderMaterial = new THREE.LineBasicMaterial({ color: 0xf3c64f, transparent: true, opacity: 0.58 });
  const border = [
    [xMin, yMin, 1],
    [xMax, yMin, 1],
    [xMax, yMax, 1],
    [xMin, yMax, 1],
    [xMin, yMin, 1]
  ].map(simToThree);
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(border), borderMaterial));
}

function createCloudBank() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    transparent: true,
    opacity: 0.82
  });

  const cloudSeeds = [
    [-120, -420, 260],
    [230, 410, 340],
    [620, -455, 300],
    [950, 390, 270],
    [1260, -210, 360]
  ];

  cloudSeeds.forEach((seed, idx) => {
    const group = new THREE.Group();
    for (let i = 0; i < 5; i += 1) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(22 + 8 * ((idx + i) % 3), 2), material);
      puff.scale.set(1.5 + i * 0.12, 0.48 + 0.05 * i, 0.78 + 0.08 * i);
      puff.position.set((i - 2) * 28, 0, Math.sin(i + idx) * 14);
      group.add(puff);
    }
    group.position.copy(simToThree(seed));
    scene.add(group);
  });
}

function createWaypoints() {
  const ringGeometry = new THREE.TorusGeometry(cfg.waypointRadius, 2.4, 18, 128);
  const stemMaterial = new THREE.LineBasicMaterial({ color: 0xc9e4ee, transparent: true, opacity: 0.48 });

  cfg.waypoints.forEach((wp) => {
    const material = new THREE.MeshStandardMaterial({
      color: 0x54d3f4,
      emissive: 0x175c70,
      emissiveIntensity: 0.82,
      roughness: 0.42,
      metalness: 0.12
    });
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.rotation.y = Math.PI / 2;
    ring.position.copy(simToThree(wp));
    scene.add(ring);
    objects.rings.push(ring);

    const light = new THREE.PointLight(0x54d3f4, 12, 155);
    light.position.copy(ring.position);
    scene.add(light);
    objects.ringLights.push(light);

    const stem = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([simToThree([wp[0], wp[1], 0]), simToThree(wp)]),
      stemMaterial
    );
    scene.add(stem);
  });
}

function createAircraft() {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9edf0,
    roughness: 0.42,
    metalness: 0.18
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xd94032,
    roughness: 0.48,
    metalness: 0.08
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x203c54,
    emissive: 0x102233,
    emissiveIntensity: 0.2,
    roughness: 0.18,
    metalness: 0.16
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x17202a,
    roughness: 0.54,
    metalness: 0.16
  });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(3.1, 18, 8, 20), bodyMaterial);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.castShadow = true;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(3.1, 6.5, 24), trimMaterial);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 12.4;
  nose.castShadow = true;
  group.add(nose);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(2.8, 24, 12), glassMaterial);
  cockpit.scale.set(1.15, 0.46, 0.68);
  cockpit.position.set(2.6, 2.3, 0);
  cockpit.castShadow = true;
  group.add(cockpit);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.58, 23), bodyMaterial);
  wing.position.set(0.6, -0.1, 0);
  wing.castShadow = true;
  group.add(wing);

  const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.66, 23.4), trimMaterial);
  wingStripe.position.set(-1.1, 0, 0);
  wingStripe.castShadow = true;
  group.add(wingStripe);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.48, 8.4), trimMaterial);
  tail.position.set(-8.2, 1.0, 0);
  tail.castShadow = true;
  group.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4.1, 0.55), trimMaterial);
  fin.position.set(-8.5, 2.75, 0);
  fin.castShadow = true;
  group.add(fin);

  const propellerHub = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 10), darkMaterial);
  propellerHub.position.x = 16.0;
  group.add(propellerHub);

  const propeller = new THREE.Mesh(new THREE.BoxGeometry(0.22, 10.5, 0.5), darkMaterial);
  propeller.position.x = 16.35;
  group.add(propeller);
  objects.propeller = propeller;

  group.scale.setScalar(1.15);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
    }
  });

  return group;
}

function createTrail() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(cfg.maxTrailPoints * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({ color: 0xf3d64f, transparent: true, opacity: 0.94 });
  return new THREE.Line(geometry, material);
}

function bindControls() {
  refs.startButton.addEventListener("click", startGame);
  refs.pauseButton.addEventListener("click", togglePause);
  refs.resetButton.addEventListener("click", resetGame);
  refs.canvas.addEventListener("click", () => refs.canvas.focus());

  window.addEventListener("keydown", (event) => {
    if (handleKey(event.code, true)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (handleKey(event.code, false)) {
      event.preventDefault();
    }
  });

  document.querySelectorAll("[data-control]").forEach((button) => {
    const name = button.dataset.control;
    const setActive = (active) => {
      applyTouchControl(name, active);
      button.classList.toggle("is-active", active);
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setActive(true);
    });
    button.addEventListener("pointerup", () => setActive(false));
    button.addEventListener("pointercancel", () => setActive(false));
    button.addEventListener("pointerleave", () => setActive(false));
  });

  window.addEventListener("resize", resize);
}

function handleKey(code, active) {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      game.control.pitchInput = active ? 1 : game.control.pitchInput === 1 ? 0 : game.control.pitchInput;
      return true;
    case "KeyS":
    case "ArrowDown":
      game.control.pitchInput = active ? -1 : game.control.pitchInput === -1 ? 0 : game.control.pitchInput;
      return true;
    case "KeyA":
    case "ArrowLeft":
      game.control.rollInput = active ? -1 : game.control.rollInput === -1 ? 0 : game.control.rollInput;
      return true;
    case "KeyD":
    case "ArrowRight":
      game.control.rollInput = active ? 1 : game.control.rollInput === 1 ? 0 : game.control.rollInput;
      return true;
    case "ShiftLeft":
    case "ShiftRight":
      game.control.throttleInput = active ? 1 : game.control.throttleInput === 1 ? 0 : game.control.throttleInput;
      return true;
    case "ControlLeft":
    case "ControlRight":
      game.control.throttleInput = active ? -1 : game.control.throttleInput === -1 ? 0 : game.control.throttleInput;
      return true;
    case "Space":
      if (active) {
        togglePause();
      }
      return true;
    case "KeyR":
      if (active) {
        resetGame();
      }
      return true;
    default:
      return false;
  }
}

function applyTouchControl(name, active) {
  const value = active ? 1 : 0;
  if (name === "pitchUp") {
    game.control.pitchInput = active ? 1 : game.control.pitchInput === 1 ? 0 : game.control.pitchInput;
  } else if (name === "pitchDown") {
    game.control.pitchInput = active ? -1 : game.control.pitchInput === -1 ? 0 : game.control.pitchInput;
  } else if (name === "rollLeft") {
    game.control.rollInput = active ? -1 : game.control.rollInput === -1 ? 0 : game.control.rollInput;
  } else if (name === "rollRight") {
    game.control.rollInput = active ? 1 : game.control.rollInput === 1 ? 0 : game.control.rollInput;
  } else if (name === "throttleUp") {
    game.control.throttleInput = value;
  } else if (name === "throttleDown") {
    game.control.throttleInput = -value;
  }
}

function resetGame() {
  game.state = cloneState(cfg.initialState);
  game.control = neutralControl();
  game.running = false;
  game.paused = false;
  game.status = "Ready";
  game.elapsed = 0;
  game.score = 0;
  game.targetIndex = 0;
  game.trail = [game.state.pos.slice()];
  game.accumulator = 0;

  refs.startButton.disabled = false;
  refs.pauseButton.disabled = true;
  refs.pauseButton.textContent = "Pause";
  refs.centerMessage.classList.remove("is-hidden");
  refs.messageTitle.textContent = "Sky Ring Pilot";
  refs.messageDetail.textContent = "Fly the course and clear every ring.";

  updateScene(performance.now());
  updateHud();
}

function startGame() {
  if (isTerminalStatus(game.status)) {
    resetGame();
  }
  game.running = true;
  game.paused = false;
  game.status = "Flying";
  game.lastFrame = performance.now();
  refs.startButton.disabled = true;
  refs.pauseButton.disabled = false;
  refs.pauseButton.textContent = "Pause";
  refs.centerMessage.classList.add("is-hidden");
  updateHud();
  refs.canvas.focus();
}

function togglePause() {
  if (!game.running && game.status !== "Paused") {
    return;
  }

  game.paused = !game.paused;
  game.status = game.paused ? "Paused" : "Flying";
  refs.pauseButton.textContent = game.paused ? "Resume" : "Pause";
  refs.centerMessage.classList.toggle("is-hidden", !game.paused);
  if (game.paused) {
    refs.messageTitle.textContent = "Paused";
    refs.messageDetail.textContent = "Resume when ready.";
  }
  updateHud();
}

function animate(now) {
  const rawDelta = Math.min(0.08, (now - game.lastFrame) / 1000);
  game.lastFrame = now;

  if (game.running && !game.paused) {
    game.accumulator += rawDelta;
    while (game.accumulator >= cfg.dt) {
      stepGame();
      game.accumulator -= cfg.dt;
    }
  }

  updateScene(now);
  renderer.render(scene, camera);
}

function stepGame() {
  game.state = stepDynamics(game.state, game.control, cfg, cfg.dt);
  game.elapsed += cfg.dt;

  game.trail.push(game.state.pos.slice());
  if (game.trail.length > cfg.maxTrailPoints) {
    game.trail.shift();
  }

  if (game.targetIndex < cfg.waypoints.length) {
    const distance = distance3(game.state.pos, cfg.waypoints[game.targetIndex]);
    if (distance <= cfg.waypointRadius) {
      game.score += cfg.scorePerWaypoint;
      game.targetIndex += 1;
    }
  }

  const nextStatus = evaluateGameStatus(game.state, cfg, game.targetIndex);
  if (nextStatus !== "Flying") {
    game.status = nextStatus;
    game.running = false;
    game.paused = false;
    refs.startButton.disabled = false;
    refs.pauseButton.disabled = true;
    refs.pauseButton.textContent = "Pause";

    if (nextStatus === "Complete") {
      game.score += cfg.levelCompleteBonus;
    }

    game.bestScore = Math.max(game.bestScore, Math.round(game.score));
    localStorage.setItem("sky-ring-pilot-best", String(game.bestScore));
    showTerminalMessage(nextStatus);
  } else {
    game.status = "Flying";
  }

  updateHud();
}

function showTerminalMessage(status) {
  const messages = {
    Complete: ["Mission Complete", "All rings cleared."],
    Reset: ["Run Reset", "Line up and fly again."]
  };
  const [title, detail] = messages[status] || ["Run Reset", "Line up and fly again."];
  refs.messageTitle.textContent = title;
  refs.messageDetail.textContent = detail;
  refs.centerMessage.classList.remove("is-hidden");
}

function stepDynamics(state, control, config, dt) {
  const pitchInput = clamp(control.pitchInput, -1, 1);
  const rollInput = clamp(control.rollInput, -1, 1);
  const throttleInput = clamp(control.throttleInput, -1, 1);

  const next = cloneState(state);
  next.throttle = clamp(state.throttle + config.throttleStep * throttleInput, 0, 1);

  const pitchRate = config.maxPitchRate * pitchInput - config.pitchLeveling * state.pitch;
  const rollRate = config.maxRollRate * rollInput - config.rollLeveling * state.roll;
  next.pitch = clamp(state.pitch + pitchRate * dt, degToRad(-24), degToRad(28));
  next.roll = clamp(state.roll + rollRate * dt, degToRad(-62), degToRad(62));

  const turnRate = config.yawGain * config.gravity * Math.tan(next.roll) / Math.max(state.speed, 8);
  next.yaw = wrapAngle(state.yaw + turnRate * dt);

  const q = 0.5 * config.airDensity * Math.max(state.speed, 0) ** 2;
  const liftCoeff = clamp(config.baseLift + config.liftSlope * next.pitch, -0.25, 1.35);
  const dragCoeff = config.drag0 + config.dragK * liftCoeff ** 2 + 0.015 * Math.abs(Math.sin(next.roll));
  const lift = q * config.wingArea * liftCoeff;
  const drag = q * config.wingArea * dragCoeff;
  const thrust = config.maxThrust * next.throttle;

  const accelAlong = (thrust - drag) / config.mass - config.gravity * Math.sin(next.pitch);
  next.speed = clamp(state.speed + accelAlong * dt, 6, config.maxSpeed);

  const forward = rotateSimVector([1, 0, 0], next.yaw, next.pitch, next.roll);
  const liftExcess = (lift * Math.cos(next.roll) - config.mass * config.gravity) / config.mass;
  const climbRate = next.speed * Math.sin(next.pitch) + 0.85 * liftExcess;
  next.verticalSpeed = climbRate;

  const horizontalSpeed = Math.max(0, next.speed * Math.cos(next.pitch));
  const velocity = [
    horizontalSpeed * forward[0],
    horizontalSpeed * forward[1],
    climbRate
  ];
  next.pos = [
    state.pos[0] + velocity[0] * dt,
    state.pos[1] + velocity[1] * dt,
    state.pos[2] + velocity[2] * dt
  ];

  return next;
}

function evaluateGameStatus(state, config, targetIndex) {
  if (targetIndex >= config.waypoints.length) {
    return "Complete";
  }

  const pos = state.pos;
  const outside =
    pos[0] < config.boundary[0] ||
    pos[0] > config.boundary[1] ||
    pos[1] < config.boundary[2] ||
    pos[1] > config.boundary[3] ||
    pos[2] > config.boundary[5];

  if (pos[2] <= config.groundZ + 2) {
    return "Reset";
  }
  if (state.speed < config.stallSpeed) {
    return "Reset";
  }
  if (outside) {
    return "Reset";
  }
  return "Flying";
}

function updateScene(now) {
  const state = game.state;
  objects.aircraft.position.copy(simToThree(state.pos));
  objects.aircraft.quaternion.copy(attitudeQuaternion(state.yaw, state.pitch, state.roll));

  if (objects.propeller) {
    objects.propeller.rotation.x += 0.42 + state.throttle * 1.25;
  }

  updateTrail();
  updateRings(now);
  updateCamera();
}

function updateRings(now) {
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
  objects.rings.forEach((ring, idx) => {
    ring.rotation.x += idx === game.targetIndex ? 0.012 : 0.002;
    if (idx < game.targetIndex) {
      ring.material.color.setHex(0x57d86f);
      ring.material.emissive.setHex(0x195f2a);
      ring.material.emissiveIntensity = 0.45;
      objects.ringLights[idx].color.setHex(0x57d86f);
      objects.ringLights[idx].intensity = 5;
    } else if (idx === game.targetIndex) {
      ring.material.color.setHex(0xf3c64f);
      ring.material.emissive.setHex(0x7c5b0b);
      ring.material.emissiveIntensity = 1.05 + pulse * 0.45;
      objects.ringLights[idx].color.setHex(0xf3c64f);
      objects.ringLights[idx].intensity = 22 + pulse * 16;
    } else {
      ring.material.color.setHex(0x54d3f4);
      ring.material.emissive.setHex(0x175c70);
      ring.material.emissiveIntensity = 0.72;
      objects.ringLights[idx].color.setHex(0x54d3f4);
      objects.ringLights[idx].intensity = 10;
    }
  });
}

function updateTrail() {
  const attr = objects.trail.geometry.attributes.position;
  const offset = Math.max(0, game.trail.length - cfg.maxTrailPoints);
  const count = game.trail.length - offset;
  for (let i = 0; i < count; i += 1) {
    const point = simToThree(game.trail[i + offset]);
    attr.setXYZ(i, point.x, point.y, point.z);
  }
  attr.needsUpdate = true;
  objects.trail.geometry.setDrawRange(0, count);
}

function updateCamera() {
  const state = game.state;
  const forward = rotateSimVector([1, 0, 0], state.yaw, state.pitch, state.roll);
  const cameraSim = [
    state.pos[0] - 86 * forward[0],
    state.pos[1] - 86 * forward[1],
    state.pos[2] - 4 * forward[2] + 34
  ];
  const targetSim = [
    state.pos[0] + 45 * forward[0],
    state.pos[1] + 45 * forward[1],
    state.pos[2] + 18
  ];

  clockVector.copy(simToThree(cameraSim));
  targetVector.copy(simToThree(targetSim));
  camera.position.lerp(clockVector, 0.12);
  camera.lookAt(targetVector);
}

function updateHud() {
  const state = game.state;
  const total = cfg.waypoints.length;
  const targetDisplay = Math.min(game.targetIndex + 1, total);
  const distance =
    game.targetIndex < total ? distance3(state.pos, cfg.waypoints[game.targetIndex]) : 0;

  refs.status.textContent = game.status;
  refs.status.classList.toggle("status-good", game.status === "Complete" || game.status === "Flying");
  refs.status.classList.toggle("status-note", game.status === "Reset");
  refs.score.textContent = String(Math.round(game.score));
  refs.time.textContent = `${game.elapsed.toFixed(1)} s`;
  refs.target.textContent = `${targetDisplay}/${total}`;
  refs.bestScore.textContent = String(game.bestScore);
  refs.speed.textContent = `${state.speed.toFixed(0)} m/s`;
  refs.altitude.textContent = `${Math.max(0, state.pos[2]).toFixed(0)} m`;
  refs.throttle.textContent = `${Math.round(state.throttle * 100)}%`;
  refs.throttleMeter.style.width = `${Math.round(state.throttle * 100)}%`;
  refs.range.textContent = `${Math.round(distance)} m`;
  refs.inputState.textContent = inputLabel(game.control);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}

function attitudeQuaternion(yaw, pitch, roll) {
  const forward = simDirToThree(rotateSimVector([1, 0, 0], yaw, pitch, roll)).normalize();
  const up = simDirToThree(rotateSimVector([0, 0, 1], yaw, pitch, roll)).normalize();
  const left = simDirToThree(rotateSimVector([0, -1, 0], yaw, pitch, roll)).normalize();
  tempMatrix.makeBasis(forward, up, left);
  return tempQuat.setFromRotationMatrix(tempMatrix);
}

function rotateSimVector(vector, yaw, pitch, roll) {
  const [x, y, z] = vector;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  const rx = x;
  const ry = cr * y - sr * z;
  const rz = sr * y + cr * z;

  const px = cp * rx - sp * rz;
  const py = ry;
  const pz = sp * rx + cp * rz;

  return [
    cy * px - sy * py,
    sy * px + cy * py,
    pz
  ];
}

function simToThree(point) {
  return new THREE.Vector3(point[0], point[2], -point[1]);
}

function simDirToThree(vector) {
  return new THREE.Vector3(vector[0], vector[2], -vector[1]);
}

function inputLabel(control) {
  const parts = [];
  if (control.pitchInput > 0) {
    parts.push("pitch +");
  } else if (control.pitchInput < 0) {
    parts.push("pitch -");
  }
  if (control.rollInput > 0) {
    parts.push("bank +");
  } else if (control.rollInput < 0) {
    parts.push("bank -");
  }
  if (control.throttleInput > 0) {
    parts.push("power +");
  } else if (control.throttleInput < 0) {
    parts.push("power -");
  }
  return parts.length ? parts.join(" ") : "neutral";
}

function cloneState(state) {
  return {
    pos: state.pos.slice(),
    speed: state.speed,
    pitch: state.pitch,
    roll: state.roll,
    yaw: state.yaw,
    throttle: state.throttle,
    verticalSpeed: state.verticalSpeed
  };
}

function neutralControl() {
  return {
    pitchInput: 0,
    rollInput: 0,
    throttleInput: 0
  };
}

function isTerminalStatus(status) {
  return ["Complete", "Reset"].includes(status);
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function wrapAngle(angle) {
  return ((((angle + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}
