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
    roundSeconds: 70,
    dropCount: 4,
    foldLife: 7,
    courierRadius: 13
  };

  const game = {
    width: 1,
    height: 1,
    ratio: 1,
    mode: "ready",
    lastTime: performance.now(),
    timeLeft: cfg.roundSeconds,
    delivered: 0,
    score: 0,
    best: readBest(),
    pointerStart: null,
    pointerNow: null,
    courier: { x: 0, y: 0, vx: 0, vy: 0 },
    packages: [],
    folds: [],
    ghosts: [],
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
    keepInside(game.courier);
  }

  function resetRound(showOverlay) {
    game.mode = "ready";
    game.timeLeft = cfg.roundSeconds;
    game.delivered = 0;
    game.score = 0;
    game.pointerStart = null;
    game.pointerNow = null;
    game.courier = { x: game.width * 0.16, y: game.height * 0.52, vx: 70, vy: 0 };
    game.packages = createPackages();
    game.folds = [];
    game.ghosts = [];
    game.sparks = [];
    updateHud();
    refs.startButton.disabled = false;
    if (showOverlay) {
      showMessage("Time Fold Courier", "0");
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
    game.pointerStart = null;
    game.pointerNow = null;
    refs.startButton.disabled = false;
    game.score += Math.round(game.timeLeft * 5);
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
    game.pointerStart = pointFromEvent(event);
    game.pointerNow = game.pointerStart;
  }

  function pointerMove(event) {
    if (!game.pointerStart) {
      return;
    }
    event.preventDefault();
    game.pointerNow = pointFromEvent(event);
  }

  function pointerUp(event) {
    event.preventDefault();
    if (game.pointerStart && game.pointerNow && game.mode === "playing") {
      const length = Math.hypot(game.pointerNow.x - game.pointerStart.x, game.pointerNow.y - game.pointerStart.y);
      if (length > 32) {
        createFold(game.pointerStart, game.pointerNow);
      }
    }
    game.pointerStart = null;
    game.pointerNow = null;
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function createFold(a, b) {
    const fold = { ax: a.x, ay: a.y, bx: b.x, by: b.y, age: 0, life: cfg.foldLife, used: false };
    game.folds.push(fold);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    game.courier.vx += (dx / length) * 160;
    game.courier.vy += (dy / length) * 160;
    game.ghosts.push({
      x: game.courier.x,
      y: game.courier.y,
      vx: -(dy / length) * 155,
      vy: (dx / length) * 155,
      age: 0,
      life: 4.2
    });
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
      updateCourier(dt);
      collectPackages();
      if (game.delivered >= cfg.dropCount || game.timeLeft <= 0) {
        finishRound();
      }
      updateHud();
    }
    updateTimed(game.folds, dt);
    updateTimed(game.ghosts, dt, (ghost) => {
      ghost.x += ghost.vx * dt;
      ghost.y += ghost.vy * dt;
      ghost.vx *= 0.985;
      ghost.vy *= 0.985;
      bounceInside(ghost, 10);
    });
    updateTimed(game.sparks, dt, (spark) => {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.95;
      spark.vy *= 0.95;
    });
  }

  function updateCourier(dt) {
    const target = nextPackage();
    if (target) {
      const dx = target.x - game.courier.x;
      const dy = target.y - game.courier.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      game.courier.vx += (dx / d) * 92 * dt;
      game.courier.vy += (dy / d) * 92 * dt;
    }
    for (const fold of game.folds) {
      const near = nearestOnSegment(game.courier.x, game.courier.y, fold);
      const dx = near.x - game.courier.x;
      const dy = near.y - game.courier.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      if (d < 76) {
        const fx = fold.bx - fold.ax;
        const fy = fold.by - fold.ay;
        const fl = Math.max(1, Math.hypot(fx, fy));
        const strength = (1 - d / 76) * 300 * (1 - fold.age / fold.life);
        game.courier.vx += (fx / fl) * strength * dt;
        game.courier.vy += (fy / fl) * strength * dt;
        if (!fold.used && d < 22) {
          fold.used = true;
          game.ghosts.push({ x: game.courier.x, y: game.courier.y, vx: -game.courier.vy * 0.7, vy: game.courier.vx * 0.7, age: 0, life: 3.6 });
        }
      }
    }
    game.courier.vx *= 0.992;
    game.courier.vy *= 0.992;
    game.courier.x += game.courier.vx * dt;
    game.courier.y += game.courier.vy * dt;
    bounceInside(game.courier, cfg.courierRadius);
  }

  function collectPackages() {
    for (const pack of game.packages) {
      if (pack.delivered) {
        continue;
      }
      if (nearActor(pack, game.courier)) {
        deliver(pack, game.courier);
      } else {
        for (const ghost of game.ghosts) {
          if (nearActor(pack, ghost)) {
            deliver(pack, ghost);
            break;
          }
        }
      }
    }
  }

  function deliver(pack, actor) {
    pack.delivered = true;
    game.delivered += 1;
    game.score += 150;
    burst(pack.x, pack.y);
    actor.vx *= -0.2;
    actor.vy *= -0.2;
  }

  function draw(now) {
    const gradient = ctx.createLinearGradient(0, 0, game.width, game.height);
    gradient.addColorStop(0, "#121827");
    gradient.addColorStop(0.55, "#182946");
    gradient.addColorStop(1, "#150f25");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, game.width, game.height);
    drawTimeline(now);
    drawPackages(now);
    drawFolds();
    drawPreviewFold();
    drawGhosts();
    drawCourier(now);
    drawSparks();
  }

  function drawTimeline(now) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#8be9fd";
    for (let y = 128; y < game.height - 70; y += 58) {
      ctx.beginPath();
      for (let x = 0; x <= game.width; x += 18) {
        const wave = y + Math.sin(x * 0.03 + now * 0.004) * 6;
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

  function drawPackages(now) {
    for (const pack of game.packages) {
      const pulse = 1 + Math.sin(now * 0.007 + pack.phase) * 0.18;
      ctx.save();
      ctx.globalAlpha = pack.delivered ? 0.28 : 1;
      ctx.translate(pack.x, pack.y);
      ctx.strokeStyle = "#ff79c6";
      ctx.fillStyle = pack.delivered ? "#8be9fd" : "#ff79c6";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-12 * pulse, -12 * pulse, 24 * pulse, 24 * pulse);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFolds() {
    for (const fold of game.folds) {
      const t = fold.age / fold.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = fold.used ? "#ff79c6" : "#8be9fd";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(fold.ax, fold.ay);
      ctx.lineTo(fold.bx, fold.by);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPreviewFold() {
    if (!game.pointerStart || !game.pointerNow) {
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = "#f8f8f2";
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(game.pointerStart.x, game.pointerStart.y);
    ctx.lineTo(game.pointerNow.x, game.pointerNow.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawGhosts() {
    for (const ghost of game.ghosts) {
      const t = ghost.age / ghost.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0.12, 1 - t);
      ctx.fillStyle = "#8be9fd";
      ctx.shadowColor = "#8be9fd";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCourier(now) {
    ctx.save();
    ctx.translate(game.courier.x, game.courier.y);
    ctx.rotate(Math.atan2(game.courier.vy, game.courier.vx));
    ctx.fillStyle = "#f8f8f2";
    ctx.shadowColor = "#8be9fd";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 10);
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
      ctx.arc(spark.x, spark.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function createPackages() {
    const spots = [
      [0.78, 0.22],
      [0.38, 0.36],
      [0.82, 0.62],
      [0.5, 0.8]
    ];
    return spots.map(([x, y]) => ({ x: game.width * x, y: game.height * y, delivered: false, phase: Math.random() * Math.PI * 2 }));
  }

  function nextPackage() {
    return game.packages.find((pack) => !pack.delivered);
  }

  function nearActor(pack, actor) {
    return Math.hypot(pack.x - actor.x, pack.y - actor.y) < 24;
  }

  function burst(x, y) {
    for (let i = 0; i < 20; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 170;
      game.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 0.7, color: i % 2 ? "#8be9fd" : "#ff79c6" });
    }
  }

  function nearestOnSegment(x, y, fold) {
    const vx = fold.bx - fold.ax;
    const vy = fold.by - fold.ay;
    const len2 = Math.max(1, vx * vx + vy * vy);
    const t = Math.max(0, Math.min(1, ((x - fold.ax) * vx + (y - fold.ay) * vy) / len2));
    return { x: fold.ax + vx * t, y: fold.ay + vy * t };
  }

  function bounceInside(body, radius) {
    const top = 96;
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
    body.y = Math.max(96, Math.min(game.height - 58, body.y));
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
    refs.primary.textContent = `${game.delivered}/${cfg.dropCount}`;
    refs.secondary.textContent = String(game.folds.length);
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
      return Number(localStorage.getItem("time-fold-courier-best") || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem("time-fold-courier-best", String(value));
    } catch (_) {
      return;
    }
  }
}());
