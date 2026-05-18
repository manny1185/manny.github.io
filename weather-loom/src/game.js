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
    roundSeconds: 65,
    islandCount: 5,
    ribbonLife: 4.4,
    boatRadius: 14
  };

  const game = {
    width: 1,
    height: 1,
    ratio: 1,
    mode: "ready",
    lastTime: performance.now(),
    timeLeft: cfg.roundSeconds,
    islandsReached: 0,
    score: 0,
    best: readBest(),
    drawing: false,
    lastPoint: null,
    boat: { x: 0, y: 0, vx: 0, vy: 0 },
    islands: [],
    ribbons: [],
    rain: [],
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
    keepInside(game.boat);
  }

  function resetRound(showOverlay) {
    game.mode = "ready";
    game.timeLeft = cfg.roundSeconds;
    game.islandsReached = 0;
    game.score = 0;
    game.drawing = false;
    game.lastPoint = null;
    game.boat = { x: game.width * 0.16, y: game.height * 0.72, vx: 40, vy: -20 };
    game.islands = createIslands();
    game.ribbons = [];
    game.rain = createRain();
    game.sparks = [];
    updateHud();
    refs.startButton.disabled = false;
    if (showOverlay) {
      showMessage("Weather Loom", "0");
    }
  }

  function startRound() {
    resetRound(false);
    game.mode = "playing";
    game.lastTime = performance.now();
    refs.startButton.disabled = true;
    refs.centerMessage.classList.add("is-hidden");
    canvas.focus();
  }

  function finishRound() {
    game.mode = "complete";
    game.drawing = false;
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
    game.drawing = true;
    game.lastPoint = pointFromEvent(event);
  }

  function pointerMove(event) {
    if (!game.drawing || game.mode !== "playing") {
      return;
    }
    event.preventDefault();
    const point = pointFromEvent(event);
    const length = Math.hypot(point.x - game.lastPoint.x, point.y - game.lastPoint.y);
    if (length > 9) {
      game.ribbons.push({ ax: game.lastPoint.x, ay: game.lastPoint.y, bx: point.x, by: point.y, age: 0, life: cfg.ribbonLife });
      game.lastPoint = point;
    }
  }

  function pointerUp(event) {
    event.preventDefault();
    game.drawing = false;
    game.lastPoint = null;
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
      updateBoat(dt);
      collectIslands();
      if (game.islandsReached >= cfg.islandCount || game.timeLeft <= 0) {
        finishRound();
      }
      updateHud();
    }
    updateTimed(game.ribbons, dt);
    updateTimed(game.sparks, dt, (spark) => {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.95;
      spark.vy *= 0.95;
    });
  }

  function updateBoat(dt) {
    game.boat.vy += 28 * dt;
    for (const ribbon of game.ribbons) {
      const near = nearestOnSegment(game.boat.x, game.boat.y, ribbon);
      const dx = ribbon.bx - ribbon.ax;
      const dy = ribbon.by - ribbon.ay;
      const len = Math.max(1, Math.hypot(dx, dy));
      const distance = Math.hypot(game.boat.x - near.x, game.boat.y - near.y);
      if (distance < 94) {
        const strength = (1 - distance / 94) * 420 * (1 - ribbon.age / ribbon.life);
        game.boat.vx += (dx / len) * strength * dt;
        game.boat.vy += (dy / len) * strength * dt;
      }
    }
    for (const rain of game.rain) {
      const d = Math.hypot(game.boat.x - rain.x, game.boat.y - rain.y);
      if (d < rain.r) {
        game.boat.vx *= 0.982;
        game.boat.vy += 20 * dt;
      }
    }
    game.boat.vx *= 0.993;
    game.boat.vy *= 0.993;
    game.boat.x += game.boat.vx * dt;
    game.boat.y += game.boat.vy * dt;
    bounceInside(game.boat, cfg.boatRadius);
  }

  function collectIslands() {
    for (const island of game.islands) {
      if (!island.reached && Math.hypot(game.boat.x - island.x, game.boat.y - island.y) < island.r + 14) {
        island.reached = true;
        game.islandsReached += 1;
        game.score += 125;
        burst(island.x, island.y);
      }
    }
  }

  function draw(now) {
    const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
    gradient.addColorStop(0, "#163c45");
    gradient.addColorStop(0.48, "#10221f");
    gradient.addColorStop(1, "#102a36");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, game.width, game.height);
    drawWater(now);
    drawRain(now);
    drawIslands(now);
    drawRibbons();
    drawBoat();
    drawSparks();
  }

  function drawWater(now) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#6ec6ff";
    for (let y = 138; y < game.height; y += 34) {
      ctx.beginPath();
      for (let x = 0; x <= game.width; x += 18) {
        const wave = y + Math.sin(x * 0.025 + now * 0.004) * 5;
        if (x === 0) {
          ctx.moveTo(x, wave);
        } else {
          ctx.lineTo(x, wave);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRain(now) {
    for (const rain of game.rain) {
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.sin(now * 0.004 + rain.phase) * 0.04;
      ctx.fillStyle = "#6ec6ff";
      ctx.beginPath();
      ctx.arc(rain.x, rain.y, rain.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawIslands(now) {
    for (const island of game.islands) {
      const pulse = 1 + Math.sin(now * 0.006 + island.phase) * 0.08;
      ctx.save();
      ctx.translate(island.x, island.y);
      ctx.globalAlpha = island.reached ? 0.45 : 1;
      ctx.fillStyle = island.reached ? "#99e2b4" : "#ffd166";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = island.reached ? 8 : 22;
      ctx.beginPath();
      ctx.ellipse(0, 0, island.r * 1.45 * pulse, island.r * 0.82 * pulse, island.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRibbons() {
    for (const ribbon of game.ribbons) {
      const t = ribbon.age / ribbon.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = "#99e2b4";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ribbon.ax, ribbon.ay);
      ctx.lineTo(ribbon.bx, ribbon.by);
      ctx.stroke();
      ctx.globalAlpha *= 0.32;
      ctx.strokeStyle = "#6ec6ff";
      ctx.lineWidth = 22;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBoat() {
    ctx.save();
    ctx.translate(game.boat.x, game.boat.y);
    ctx.rotate(Math.atan2(game.boat.vy, game.boat.vx) * 0.18);
    ctx.fillStyle = "#f2fbf5";
    ctx.shadowColor = "#99e2b4";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-13, -12);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSparks() {
    for (const spark of game.sparks) {
      const t = spark.age / spark.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function createIslands() {
    const spots = [
      [0.22, 0.3],
      [0.46, 0.48],
      [0.75, 0.24],
      [0.82, 0.68],
      [0.5, 0.82]
    ];
    return spots.map(([x, y]) => ({
      x: game.width * x,
      y: game.height * y,
      r: 17 + Math.random() * 8,
      angle: Math.random() * Math.PI,
      phase: Math.random() * Math.PI * 2,
      reached: false
    }));
  }

  function createRain() {
    return [
      { x: game.width * 0.34, y: game.height * 0.24, r: 54, phase: 0.4 },
      { x: game.width * 0.68, y: game.height * 0.56, r: 66, phase: 2.2 }
    ];
  }

  function nearestOnSegment(x, y, ribbon) {
    const vx = ribbon.bx - ribbon.ax;
    const vy = ribbon.by - ribbon.ay;
    const len2 = Math.max(1, vx * vx + vy * vy);
    const t = Math.max(0, Math.min(1, ((x - ribbon.ax) * vx + (y - ribbon.ay) * vy) / len2));
    return { x: ribbon.ax + vx * t, y: ribbon.ay + vy * t };
  }

  function burst(x, y) {
    for (let i = 0; i < 18; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 150;
      game.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 0.75, color: i % 2 ? "#99e2b4" : "#6ec6ff" });
    }
  }

  function bounceInside(body, radius) {
    const top = 104;
    const bottom = game.height - 58;
    if (body.x < radius || body.x > game.width - radius) {
      body.x = Math.max(radius, Math.min(game.width - radius, body.x));
      body.vx *= -0.62;
    }
    if (body.y < top || body.y > bottom) {
      body.y = Math.max(top, Math.min(bottom, body.y));
      body.vy *= -0.62;
    }
  }

  function keepInside(body) {
    body.x = Math.max(16, Math.min(game.width - 16, body.x));
    body.y = Math.max(104, Math.min(game.height - 58, body.y));
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
    refs.primary.textContent = `${game.islandsReached}/${cfg.islandCount}`;
    refs.secondary.textContent = String(game.ribbons.length);
    refs.time.textContent = String(Math.ceil(game.timeLeft));
    refs.best.textContent = String(game.best);
  }

  function showMessage(title, score) {
    refs.messageTitle.textContent = title;
    refs.messageScore.textContent = score;
    refs.centerMessage.classList.remove("is-hidden");
  }

  function readBest() {
    try {
      return Number(localStorage.getItem("weather-loom-best") || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem("weather-loom-best", String(value));
    } catch (_) {
      return;
    }
  }
}());
