(function () {
  const canvas = document.querySelector("#game-canvas");
  const ctx = canvas.getContext("2d");
  const refs = {
    primary: document.querySelector("#primary"),
    secondary: document.querySelector("#secondary"),
    time: document.querySelector("#time"),
    best: document.querySelector("#best"),
    startButton: document.querySelector("#start-button"),
    resetButton: document.querySelector("#reset-button"),
    centerMessage: document.querySelector("#center-message"),
    messageTitle: document.querySelector("#message-title"),
    messageScore: document.querySelector("#message-score")
  };

  const cfg = {
    roundSeconds: 75,
    beaconCount: 5,
    seekerRadius: 13,
    echoLife: 2.3,
    echoRadius: 178
  };

  const game = {
    width: 1,
    height: 1,
    ratio: 1,
    mode: "ready",
    lastTime: performance.now(),
    timeLeft: cfg.roundSeconds,
    score: 0,
    found: 0,
    best: readBest(),
    pointer: null,
    seeker: { x: 0, y: 0, vx: 0, vy: 0 },
    echoes: [],
    beacons: [],
    walls: [],
    sparks: []
  };

  refs.best.textContent = String(game.best);
  bindEvents();
  resize();
  resetRound(false);
  requestAnimationFrame(tick);

  function bindEvents() {
    refs.startButton.addEventListener("click", startRound);
    refs.resetButton.addEventListener("click", () => resetRound(true));
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    window.addEventListener("resize", resize);
  }

  function resize() {
    game.ratio = Math.min(window.devicePixelRatio || 1, 2);
    game.width = Math.max(320, window.innerWidth);
    game.height = Math.max(420, window.innerHeight);
    canvas.width = Math.round(game.width * game.ratio);
    canvas.height = Math.round(game.height * game.ratio);
    canvas.style.width = `${game.width}px`;
    canvas.style.height = `${game.height}px`;
    ctx.setTransform(game.ratio, 0, 0, game.ratio, 0, 0);
    keepInside(game.seeker);
  }

  function resetRound(showOverlay) {
    game.mode = "ready";
    game.timeLeft = cfg.roundSeconds;
    game.score = 0;
    game.found = 0;
    game.pointer = null;
    game.seeker = { x: game.width * 0.5, y: game.height * 0.58, vx: 0, vy: 0 };
    game.echoes = [];
    game.sparks = [];
    game.walls = createWalls();
    game.beacons = createBeacons();
    updateHud();
    refs.startButton.disabled = false;
    if (showOverlay) {
      showMessage("Echo Cartographer", "0");
    }
  }

  function startRound() {
    resetRound(false);
    game.mode = "playing";
    game.lastTime = performance.now();
    refs.startButton.disabled = true;
    refs.centerMessage.classList.add("is-hidden");
    createEcho(game.seeker.x, game.seeker.y);
    canvas.focus();
  }

  function finishRound() {
    game.mode = "complete";
    game.pointer = null;
    refs.startButton.disabled = false;
    game.score += Math.round(game.timeLeft * 4);
    game.best = Math.max(game.best, game.score);
    writeBest(game.best);
    updateHud();
    showMessage("Round Complete", `${game.score} points`);
  }

  function pointerDown(event) {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    if (game.mode !== "playing") {
      startRound();
    }
    game.pointer = pointFromEvent(event);
    createEcho(game.pointer.x, game.pointer.y);
  }

  function pointerMove(event) {
    if (!game.pointer) {
      return;
    }
    event.preventDefault();
    game.pointer = pointFromEvent(event);
  }

  function pointerUp(event) {
    event.preventDefault();
    game.pointer = null;
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function createEcho(x, y) {
    game.echoes.push({ x, y, age: 0, life: cfg.echoLife });
    for (let i = 0; i < 16; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      game.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.55 + Math.random() * 0.35
      });
    }
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - game.lastTime) / 1000 || 0);
    game.lastTime = now;
    update(dt);
    draw(now);
    requestAnimationFrame(tick);
  }

  function update(dt) {
    if (game.mode === "playing") {
      game.timeLeft = Math.max(0, game.timeLeft - dt);
      updateSeeker(dt);
      collectBeacons();
      if (game.found >= cfg.beaconCount || game.timeLeft <= 0) {
        finishRound();
      }
      updateHud();
    }
    updateTimed(game.echoes, dt);
    updateTimed(game.sparks, dt, (spark) => {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.96;
      spark.vy *= 0.96;
    });
  }

  function updateSeeker(dt) {
    if (game.pointer) {
      const dx = game.pointer.x - game.seeker.x;
      const dy = game.pointer.y - game.seeker.y;
      game.seeker.vx += dx * 10 * dt;
      game.seeker.vy += dy * 10 * dt;
    }
    game.seeker.vx *= 0.9;
    game.seeker.vy *= 0.9;
    const previous = { x: game.seeker.x, y: game.seeker.y };
    game.seeker.x += game.seeker.vx * dt;
    game.seeker.y += game.seeker.vy * dt;
    keepInside(game.seeker);
    for (const wall of game.walls) {
      if (circleRect(game.seeker, cfg.seekerRadius, wall)) {
        game.seeker.x = previous.x;
        game.seeker.y = previous.y;
        game.seeker.vx *= -0.35;
        game.seeker.vy *= -0.35;
      }
    }
  }

  function collectBeacons() {
    for (const beacon of game.beacons) {
      if (!beacon.found && distance(game.seeker, beacon) < 24) {
        beacon.found = true;
        game.found += 1;
        game.score += 120;
        createEcho(beacon.x, beacon.y);
      }
    }
  }

  function draw(now) {
    const gradient = ctx.createLinearGradient(0, 0, game.width, game.height);
    gradient.addColorStop(0, "#10151f");
    gradient.addColorStop(0.55, "#132437");
    gradient.addColorStop(1, "#071014");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, game.width, game.height);
    drawGrid(now);
    drawWalls();
    drawBeacons(now);
    drawEchoes();
    drawSparks();
    drawSeeker(now);
    drawVeil();
  }

  function drawGrid(now) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#72e6f5";
    ctx.lineWidth = 1;
    const step = 48;
    const shift = (now * 0.008) % step;
    for (let x = -step; x < game.width + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + shift, 0);
      ctx.lineTo(x + shift - 90, game.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWalls() {
    for (const wall of game.walls) {
      const visible = echoStrength(wall.x + wall.w * 0.5, wall.y + wall.h * 0.5);
      ctx.save();
      ctx.globalAlpha = 0.18 + visible * 0.68;
      ctx.fillStyle = "#334557";
      ctx.strokeStyle = "#72e6f5";
      ctx.lineWidth = 1;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      if (visible > 0.1) {
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
      }
      ctx.restore();
    }
  }

  function drawBeacons(now) {
    for (const beacon of game.beacons) {
      const visible = beacon.found ? 1 : echoStrength(beacon.x, beacon.y);
      if (visible <= 0.02) {
        continue;
      }
      const pulse = 1 + Math.sin(now * 0.008 + beacon.phase) * 0.18;
      ctx.save();
      ctx.globalAlpha = beacon.found ? 0.48 : visible;
      ctx.translate(beacon.x, beacon.y);
      ctx.fillStyle = beacon.found ? "#72e6f5" : "#ffd166";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(0, 0, 10 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEchoes() {
    for (const echo of game.echoes) {
      const t = echo.age / echo.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = "#72e6f5";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(echo.x, echo.y, 20 + t * cfg.echoRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSparks() {
    for (const spark of game.sparks) {
      const t = spark.age / spark.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = "#72e6f5";
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawSeeker(now) {
    ctx.save();
    ctx.translate(game.seeker.x, game.seeker.y);
    ctx.fillStyle = "#eef6ff";
    ctx.shadowColor = "#72e6f5";
    ctx.shadowBlur = 18;
    ctx.rotate(now * 0.004);
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(12, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawVeil() {
    ctx.save();
    ctx.fillStyle = "rgba(3, 7, 12, 0.42)";
    ctx.fillRect(0, 0, game.width, game.height);
    ctx.globalCompositeOperation = "destination-out";
    for (const echo of game.echoes) {
      const t = echo.age / echo.life;
      const radius = 56 + t * cfg.echoRadius;
      const glow = ctx.createRadialGradient(echo.x, echo.y, 0, echo.x, echo.y, radius);
      glow.addColorStop(0, "rgba(255,255,255,0.72)");
      glow.addColorStop(0.65, "rgba(255,255,255,0.26)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(echo.x, echo.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function echoStrength(x, y) {
    let value = 0;
    for (const echo of game.echoes) {
      const t = echo.age / echo.life;
      const radius = 36 + t * cfg.echoRadius;
      const edge = Math.abs(Math.hypot(x - echo.x, y - echo.y) - radius);
      value = Math.max(value, 1 - edge / 80);
    }
    return Math.max(0, Math.min(1, value));
  }

  function createWalls() {
    const w = game.width;
    const h = game.height;
    return [
      { x: w * 0.18, y: h * 0.22, w: w * 0.12, h: h * 0.34 },
      { x: w * 0.56, y: h * 0.18, w: w * 0.1, h: h * 0.32 },
      { x: w * 0.34, y: h * 0.62, w: w * 0.38, h: 20 },
      { x: w * 0.74, y: h * 0.48, w: 18, h: h * 0.25 }
    ];
  }

  function createBeacons() {
    const spots = [
      [0.18, 0.74],
      [0.38, 0.31],
      [0.72, 0.28],
      [0.82, 0.7],
      [0.51, 0.82]
    ];
    return spots.map(([x, y]) => ({
      x: game.width * x,
      y: game.height * y,
      phase: Math.random() * Math.PI * 2,
      found: false
    }));
  }

  function updateTimed(items, dt, extra) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      item.age += dt;
      if (extra) {
        extra(item);
      }
      if (item.age >= item.life) {
        items.splice(i, 1);
      }
    }
  }

  function updateHud() {
    refs.primary.textContent = `${game.found}/${cfg.beaconCount}`;
    refs.secondary.textContent = String(Math.round(game.score));
    refs.time.textContent = String(Math.ceil(game.timeLeft));
    refs.best.textContent = String(game.best);
  }

  function showMessage(title, score) {
    refs.messageTitle.textContent = title;
    refs.messageScore.textContent = score;
    refs.centerMessage.classList.remove("is-hidden");
  }

  function circleRect(circle, radius, rect) {
    const x = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const y = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    return Math.hypot(circle.x - x, circle.y - y) <= radius;
  }

  function keepInside(body) {
    body.x = Math.max(18, Math.min(game.width - 18, body.x));
    body.y = Math.max(96, Math.min(game.height - 62, body.y));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function readBest() {
    try {
      return Number(localStorage.getItem("echo-cartographer-best") || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem("echo-cartographer-best", String(value));
    } catch (_) {
      return;
    }
  }
}());
