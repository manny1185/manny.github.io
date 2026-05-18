(function () {
  const canvas = document.querySelector("#garden-canvas");
  const ctx = canvas.getContext("2d");
  const refs = {
    score: document.querySelector("#score"),
    blooms: document.querySelector("#blooms"),
    time: document.querySelector("#time"),
    best: document.querySelector("#best"),
    startButton: document.querySelector("#start-button"),
    resetButton: document.querySelector("#reset-button"),
    centerMessage: document.querySelector("#center-message"),
    messageTitle: document.querySelector("#message-title"),
    messageScore: document.querySelector("#message-score")
  };

  const cfg = {
    roundSeconds: 60,
    seedRadius: 14,
    moteRadius: 8,
    pulseCooldown: 155,
    pulseRadius: 132,
    pulseForce: 520,
    drag: 0.988,
    maxSpeed: 620,
    moteCount: 9,
    driftCount: 5
  };

  const game = {
    mode: "ready",
    width: 1,
    height: 1,
    pixelRatio: 1,
    lastTime: performance.now(),
    timeLeft: cfg.roundSeconds,
    score: 0,
    blooms: 0,
    best: readBest(),
    lastPulseAt: 0,
    pointer: null,
    seed: { x: 0, y: 0, vx: 0, vy: 0 },
    motes: [],
    drifts: [],
    pulses: [],
    flowers: [],
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
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("resize", resize);
  }

  function resize() {
    game.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    game.width = Math.max(320, window.innerWidth);
    game.height = Math.max(420, window.innerHeight);
    canvas.width = Math.round(game.width * game.pixelRatio);
    canvas.height = Math.round(game.height * game.pixelRatio);
    canvas.style.width = `${game.width}px`;
    canvas.style.height = `${game.height}px`;
    ctx.setTransform(game.pixelRatio, 0, 0, game.pixelRatio, 0, 0);
    keepSeedInBounds();
  }

  function resetRound(showOverlay) {
    game.mode = "ready";
    game.timeLeft = cfg.roundSeconds;
    game.score = 0;
    game.blooms = 0;
    game.lastPulseAt = 0;
    game.pointer = null;
    game.seed = {
      x: game.width * 0.5,
      y: game.height * 0.58,
      vx: 0,
      vy: 0
    };
    game.motes = createMotes();
    game.drifts = createDrifts();
    game.pulses = [];
    game.flowers = [];
    game.sparks = [];
    updateHud();
    refs.startButton.disabled = false;
    if (showOverlay) {
      showMessage("Pulse Garden", "0");
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
    game.pointer = null;
    refs.startButton.disabled = false;
    game.best = Math.max(game.best, game.score);
    writeBest(game.best);
    updateHud();
    showMessage("本轮完成", `${game.score} points`);
  }

  function handlePointerDown(event) {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    game.pointer = pointerFromEvent(event);
    if (game.mode === "ready" || game.mode === "complete") {
      startRound();
    }
    createPulse(game.pointer.x, game.pointer.y, true);
  }

  function handlePointerMove(event) {
    if (!game.pointer) {
      return;
    }
    event.preventDefault();
    game.pointer = pointerFromEvent(event);
    createPulse(game.pointer.x, game.pointer.y, false);
  }

  function handlePointerUp(event) {
    event.preventDefault();
    game.pointer = null;
  }

  function pointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function createPulse(x, y, forceNow) {
    const now = performance.now();
    if (!forceNow && now - game.lastPulseAt < cfg.pulseCooldown) {
      return;
    }
    game.lastPulseAt = now;
    game.pulses.push({ x, y, age: 0, life: 0.58 });

    const dx = game.seed.x - x;
    const dy = game.seed.y - y;
    const distance = Math.max(20, Math.hypot(dx, dy));
    if (distance < cfg.pulseRadius) {
      const strength = (1 - distance / cfg.pulseRadius) * cfg.pulseForce;
      game.seed.vx += (dx / distance) * strength;
      game.seed.vy += (dy / distance) * strength;
    }

    for (let i = 0; i < 10; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 28 + Math.random() * 90;
      game.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.32 + Math.random() * 0.28,
        color: Math.random() > 0.5 ? "#62c9f5" : "#b7ec5d"
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
      updateSeed(dt);
      updateDrifts(dt);
      collectMotes();
      if (game.timeLeft <= 0) {
        finishRound();
      }
      updateHud();
    } else {
      updateDrifts(dt);
    }

    updateTimed(game.pulses, dt);
    updateTimed(game.sparks, dt, (spark) => {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.96;
      spark.vy *= 0.96;
    });
    updateTimed(game.flowers, dt);
  }

  function updateSeed(dt) {
    game.seed.vx *= cfg.drag;
    game.seed.vy *= cfg.drag;
    const speed = Math.hypot(game.seed.vx, game.seed.vy);
    if (speed > cfg.maxSpeed) {
      game.seed.vx = (game.seed.vx / speed) * cfg.maxSpeed;
      game.seed.vy = (game.seed.vy / speed) * cfg.maxSpeed;
    }
    game.seed.x += game.seed.vx * dt;
    game.seed.y += game.seed.vy * dt;

    for (const drift of game.drifts) {
      const dx = game.seed.x - drift.x;
      const dy = game.seed.y - drift.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance < drift.radius + cfg.seedRadius) {
        const push = (1 - distance / (drift.radius + cfg.seedRadius)) * 240;
        game.seed.vx += (dx / distance) * push * dt;
        game.seed.vy += (dy / distance) * push * dt;
        game.seed.vx *= 0.965;
        game.seed.vy *= 0.965;
        game.score = Math.max(0, game.score - 1);
      }
    }

    keepSeedInBounds();
  }

  function keepSeedInBounds() {
    const pad = cfg.seedRadius + 8;
    if (game.seed.x < pad) {
      game.seed.x = pad;
      game.seed.vx = Math.abs(game.seed.vx) * 0.55;
    }
    if (game.seed.x > game.width - pad) {
      game.seed.x = game.width - pad;
      game.seed.vx = -Math.abs(game.seed.vx) * 0.55;
    }
    if (game.seed.y < pad) {
      game.seed.y = pad;
      game.seed.vy = Math.abs(game.seed.vy) * 0.55;
    }
    if (game.seed.y > game.height - pad) {
      game.seed.y = game.height - pad;
      game.seed.vy = -Math.abs(game.seed.vy) * 0.55;
    }
  }

  function collectMotes() {
    for (const mote of game.motes) {
      const distance = Math.hypot(game.seed.x - mote.x, game.seed.y - mote.y);
      if (distance <= cfg.seedRadius + cfg.moteRadius) {
        game.score += 24;
        game.blooms += 1;
        game.flowers.push({ x: mote.x, y: mote.y, age: 0, life: 2.2, hue: mote.hue });
        Object.assign(mote, createMote());
      }
    }
  }

  function updateDrifts(dt) {
    game.drifts.forEach((drift, index) => {
      drift.phase += dt * drift.rate;
      drift.x += Math.cos(drift.phase + index) * drift.wander * dt;
      drift.y += Math.sin(drift.phase * 0.8 - index) * drift.wander * dt;
      if (drift.x < 30 || drift.x > game.width - 30) {
        drift.wander *= -1;
      }
      if (drift.y < 96 || drift.y > game.height - 82) {
        drift.rate *= -1;
      }
    });
  }

  function updateTimed(items, dt, extraUpdate) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      item.age += dt;
      if (extraUpdate) {
        extraUpdate(item);
      }
      if (item.age >= item.life) {
        items.splice(i, 1);
      }
    }
  }

  function draw(now) {
    drawBackground(now);
    drawFlowers();
    drawMotes(now);
    drawDrifts(now);
    drawPulses();
    drawSeed(now);
    drawSparks();
  }

  function drawBackground(now) {
    const gradient = ctx.createLinearGradient(0, 0, game.width, game.height);
    gradient.addColorStop(0, "#13211f");
    gradient.addColorStop(0.52, "#18312c");
    gradient.addColorStop(1, "#2a2228");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, game.width, game.height);

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#d8f6c6";
    ctx.lineWidth = 1;
    const step = 54;
    const drift = (now * 0.012) % step;
    for (let x = -step; x < game.width + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + drift, 0);
      ctx.lineTo(x - game.height * 0.25 + drift, game.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFlowers() {
    for (const flower of game.flowers) {
      const t = flower.age / flower.life;
      const radius = 11 + t * 24;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.translate(flower.x, flower.y);
      for (let i = 0; i < 6; i += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.fillStyle = flower.hue === "blue" ? "#62c9f5" : "#ff7f6e";
        ctx.beginPath();
        ctx.ellipse(radius * 0.55, 0, radius * 0.5, radius * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawMotes(now) {
    for (const mote of game.motes) {
      const pulse = 1 + Math.sin(now * 0.006 + mote.phase) * 0.16;
      ctx.save();
      ctx.translate(mote.x, mote.y);
      ctx.fillStyle = mote.hue === "blue" ? "#62c9f5" : "#b7ec5d";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, cfg.moteRadius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawDrifts(now) {
    for (const drift of game.drifts) {
      const pulse = 0.86 + Math.sin(now * 0.004 + drift.phase) * 0.08;
      ctx.save();
      ctx.translate(drift.x, drift.y);
      ctx.strokeStyle = "rgba(255, 127, 110, 0.58)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, drift.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPulses() {
    for (const pulse of game.pulses) {
      const t = pulse.age / pulse.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = "#62c9f5";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 16 + t * cfg.pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSeed(now) {
    const wobble = 1 + Math.sin(now * 0.012) * 0.04;
    ctx.save();
    ctx.translate(game.seed.x, game.seed.y);
    ctx.fillStyle = "#b7ec5d";
    ctx.shadowColor = "#b7ec5d";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(0, 0, cfg.seedRadius * wobble, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(19, 33, 31, 0.42)";
    ctx.beginPath();
    ctx.arc(-4, -4, 4, 0, Math.PI * 2);
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
      ctx.arc(spark.x, spark.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function createMotes() {
    return Array.from({ length: cfg.moteCount }, createMote);
  }

  function createMote() {
    return {
      x: randomRange(30, Math.max(31, game.width - 30)),
      y: randomRange(118, Math.max(119, game.height - 88)),
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.55 ? "blue" : "green"
    };
  }

  function createDrifts() {
    return Array.from({ length: cfg.driftCount }, () => ({
      x: randomRange(48, Math.max(49, game.width - 48)),
      y: randomRange(150, Math.max(151, game.height - 112)),
      radius: randomRange(26, 44),
      phase: Math.random() * Math.PI * 2,
      rate: randomRange(0.5, 1.1),
      wander: randomRange(18, 44)
    }));
  }

  function updateHud() {
    refs.score.textContent = String(Math.round(game.score));
    refs.blooms.textContent = String(game.blooms);
    refs.time.textContent = String(Math.ceil(game.timeLeft));
    refs.best.textContent = String(game.best);
  }

  function showMessage(title, score) {
    refs.messageTitle.textContent = title;
    refs.messageScore.textContent = score;
    refs.centerMessage.classList.remove("is-hidden");
  }

  function randomRange(min, max) {
    return min + Math.random() * Math.max(0, max - min);
  }

  function readBest() {
    try {
      return Number(localStorage.getItem("pulse-garden-best") || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem("pulse-garden-best", String(value));
    } catch (_) {
      return;
    }
  }
}());
