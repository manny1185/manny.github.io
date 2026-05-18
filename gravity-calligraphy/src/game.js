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
    roundSeconds: 60,
    nodeCount: 6,
    inkMax: 100,
    strokeLife: 5.8,
    dropRadius: 12
  };

  const game = {
    width: 1,
    height: 1,
    ratio: 1,
    mode: "ready",
    lastTime: performance.now(),
    timeLeft: cfg.roundSeconds,
    ink: cfg.inkMax,
    score: 0,
    best: readBest(),
    nodesHit: 0,
    drawing: false,
    lastPoint: null,
    drop: { x: 0, y: 0, vx: 0, vy: 0 },
    nodes: [],
    strokes: [],
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
    keepInside(game.drop);
  }

  function resetRound(showOverlay) {
    game.mode = "ready";
    game.timeLeft = cfg.roundSeconds;
    game.ink = cfg.inkMax;
    game.score = 0;
    game.nodesHit = 0;
    game.drawing = false;
    game.lastPoint = null;
    game.drop = { x: game.width * 0.18, y: game.height * 0.58, vx: 60, vy: -20 };
    game.nodes = createNodes();
    game.strokes = [];
    game.sparks = [];
    updateHud();
    refs.startButton.disabled = false;
    if (showOverlay) {
      showMessage("Gravity Calligraphy", "0");
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
    game.score += Math.round(game.timeLeft * 3 + game.ink);
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
    if (length > 8 && game.ink > 0) {
      game.strokes.push({
        ax: game.lastPoint.x,
        ay: game.lastPoint.y,
        bx: point.x,
        by: point.y,
        age: 0,
        life: cfg.strokeLife,
        width: 8 + Math.min(12, length * 0.08)
      });
      game.ink = Math.max(0, game.ink - length * 0.035);
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
      game.ink = Math.min(cfg.inkMax, game.ink + dt * 4);
      updateDrop(dt);
      collectNodes();
      if (game.nodesHit >= cfg.nodeCount || game.timeLeft <= 0) {
        finishRound();
      }
      updateHud();
    }
    updateTimed(game.strokes, dt);
    updateTimed(game.sparks, dt, (spark) => {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.95;
      spark.vy *= 0.95;
    });
  }

  function updateDrop(dt) {
    game.drop.vy += 70 * dt;
    for (const stroke of game.strokes) {
      const nearest = nearestOnSegment(game.drop.x, game.drop.y, stroke);
      const dx = nearest.x - game.drop.x;
      const dy = nearest.y - game.drop.y;
      const dist = Math.max(10, Math.hypot(dx, dy));
      if (dist < 115) {
        const ageStrength = 1 - stroke.age / stroke.life;
        const pull = (1 - dist / 115) * 620 * ageStrength;
        const sx = stroke.bx - stroke.ax;
        const sy = stroke.by - stroke.ay;
        const sl = Math.max(1, Math.hypot(sx, sy));
        game.drop.vx += (dx / dist) * pull * dt + (sx / sl) * pull * 0.24 * dt;
        game.drop.vy += (dy / dist) * pull * dt + (sy / sl) * pull * 0.24 * dt;
      }
    }
    game.drop.vx *= 0.992;
    game.drop.vy *= 0.992;
    game.drop.x += game.drop.vx * dt;
    game.drop.y += game.drop.vy * dt;
    bounceInside(game.drop);
  }

  function collectNodes() {
    for (const node of game.nodes) {
      if (!node.hit && Math.hypot(game.drop.x - node.x, game.drop.y - node.y) < 24) {
        node.hit = true;
        game.nodesHit += 1;
        game.score += 130;
        burst(node.x, node.y, node.color);
      }
    }
  }

  function draw(now) {
    const gradient = ctx.createLinearGradient(0, 0, game.width, game.height);
    gradient.addColorStop(0, "#1b171f");
    gradient.addColorStop(0.55, "#291d2f");
    gradient.addColorStop(1, "#171418");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, game.width, game.height);
    drawPaperLines();
    drawNodes(now);
    drawStrokes();
    drawDrop(now);
    drawSparks();
  }

  function drawPaperLines() {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#f4c15d";
    ctx.lineWidth = 1;
    for (let y = 130; y < game.height - 54; y += 48) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.bezierCurveTo(game.width * 0.3, y - 14, game.width * 0.7, y + 16, game.width - 20, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNodes(now) {
    for (const node of game.nodes) {
      const pulse = 1 + Math.sin(now * 0.007 + node.phase) * 0.16;
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.globalAlpha = node.hit ? 0.34 : 1;
      ctx.fillStyle = node.color;
      ctx.shadowColor = node.color;
      ctx.shadowBlur = node.hit ? 6 : 22;
      ctx.beginPath();
      ctx.arc(0, 0, 10 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawStrokes() {
    for (const stroke of game.strokes) {
      const t = stroke.age / stroke.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = "#f4c15d";
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.ax, stroke.ay);
      ctx.lineTo(stroke.bx, stroke.by);
      ctx.stroke();
      ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = "#b58cff";
      ctx.lineWidth = stroke.width + 12;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDrop(now) {
    ctx.save();
    ctx.translate(game.drop.x, game.drop.y);
    ctx.fillStyle = "#fbf5ff";
    ctx.shadowColor = "#b58cff";
    ctx.shadowBlur = 22;
    ctx.rotate(now * 0.005);
    ctx.beginPath();
    ctx.ellipse(0, 0, cfg.dropRadius * 0.88, cfg.dropRadius * 1.2, 0.6, 0, Math.PI * 2);
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

  function createNodes() {
    const spots = [
      [0.24, 0.32],
      [0.56, 0.25],
      [0.78, 0.42],
      [0.32, 0.58],
      [0.58, 0.72],
      [0.82, 0.78]
    ];
    return spots.map(([x, y], index) => ({
      x: game.width * x,
      y: game.height * y,
      hit: false,
      phase: Math.random() * Math.PI * 2,
      color: index % 2 ? "#b58cff" : "#f4c15d"
    }));
  }

  function burst(x, y, color) {
    for (let i = 0; i < 18; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 160;
      game.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 0.65, color });
    }
  }

  function nearestOnSegment(x, y, stroke) {
    const vx = stroke.bx - stroke.ax;
    const vy = stroke.by - stroke.ay;
    const len2 = Math.max(1, vx * vx + vy * vy);
    const t = Math.max(0, Math.min(1, ((x - stroke.ax) * vx + (y - stroke.ay) * vy) / len2));
    return { x: stroke.ax + vx * t, y: stroke.ay + vy * t };
  }

  function bounceInside(body) {
    const top = 96;
    const bottom = game.height - 58;
    if (body.x < 18 || body.x > game.width - 18) {
      body.x = Math.max(18, Math.min(game.width - 18, body.x));
      body.vx *= -0.62;
    }
    if (body.y < top || body.y > bottom) {
      body.y = Math.max(top, Math.min(bottom, body.y));
      body.vy *= -0.62;
    }
  }

  function keepInside(body) {
    body.x = Math.max(18, Math.min(game.width - 18, body.x));
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
    refs.primary.textContent = `${game.nodesHit}/${cfg.nodeCount}`;
    refs.secondary.textContent = String(Math.round(game.ink));
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
      return Number(localStorage.getItem("gravity-calligraphy-best") || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem("gravity-calligraphy-best", String(value));
    } catch (_) {
      return;
    }
  }
}());
