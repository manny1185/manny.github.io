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
    itemCount: 4,
    movesMax: 18,
    itemRadius: 18
  };

  const game = {
    width: 1,
    height: 1,
    ratio: 1,
    mode: "ready",
    movesLeft: cfg.movesMax,
    matched: 0,
    score: 0,
    best: readBest(),
    dragging: null,
    dragOffset: { x: 0, y: 0 },
    items: [],
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
  }

  function resetRound(showOverlay) {
    game.mode = "ready";
    game.movesLeft = cfg.movesMax;
    game.matched = 0;
    game.score = 0;
    game.dragging = null;
    game.items = createItems();
    game.sparks = [];
    updateHud();
    refs.startButton.disabled = false;
    if (showOverlay) {
      showMessage("Mirror Market", "0");
    }
  }

  function startRound() {
    resetRound(false);
    game.mode = "playing";
    refs.startButton.disabled = true;
    refs.centerMessage.classList.add("is-hidden");
    canvas.focus();
  }

  function finishRound() {
    game.mode = "complete";
    game.dragging = null;
    refs.startButton.disabled = false;
    game.score = game.matched * 140 + game.movesLeft * 18;
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
    const point = pointFromEvent(event);
    for (let i = game.items.length - 1; i >= 0; i -= 1) {
      const item = game.items[i];
      if (!item.matched && Math.hypot(point.x - item.x, point.y - item.y) < cfg.itemRadius + 10) {
        game.dragging = item;
        game.dragOffset = { x: item.x - point.x, y: item.y - point.y };
        break;
      }
    }
  }

  function pointerMove(event) {
    if (!game.dragging || game.mode !== "playing") {
      return;
    }
    event.preventDefault();
    const point = pointFromEvent(event);
    game.dragging.x = clamp(point.x + game.dragOffset.x, 32, game.width * 0.5 - 28);
    game.dragging.y = clamp(point.y + game.dragOffset.y, 118, game.height - 72);
  }

  function pointerUp(event) {
    event.preventDefault();
    if (game.dragging && game.mode === "playing") {
      game.movesLeft = Math.max(0, game.movesLeft - 1);
      checkMatch(game.dragging);
      if (game.matched >= cfg.itemCount || game.movesLeft <= 0) {
        finishRound();
      }
      updateHud();
    }
    game.dragging = null;
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function tick(now) {
    update(0.016);
    draw(now);
    requestAnimationFrame(tick);
  }

  function update(dt) {
    updateTimed(game.sparks, dt, (spark) => {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.95;
      spark.vy *= 0.95;
    });
  }

  function checkMatch(item) {
    const leftHit = Math.hypot(item.x - item.target.x, item.y - item.target.y) < 28;
    const mirror = mirrorPoint(item.x, item.y);
    const rightHit = Math.hypot(mirror.x - item.mirrorTarget.x, mirror.y - item.mirrorTarget.y) < 28;
    if (leftHit && rightHit) {
      item.matched = true;
      item.x = item.target.x;
      item.y = item.target.y;
      game.matched += 1;
      burst(item.x, item.y, item.color);
      burst(item.mirrorTarget.x, item.mirrorTarget.y, item.color);
    }
  }

  function draw(now) {
    const gradient = ctx.createLinearGradient(0, 0, game.width, game.height);
    gradient.addColorStop(0, "#191d22");
    gradient.addColorStop(0.5, "#26303a");
    gradient.addColorStop(1, "#1b2025");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, game.width, game.height);
    drawShelves();
    drawTargets();
    drawItems(now);
    drawSparks();
  }

  function drawShelves() {
    const middle = game.width * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.68;
    ctx.strokeStyle = "#72ddf7";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(middle, 104);
    ctx.lineTo(middle, game.height - 54);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.18;
    for (let y = 150; y < game.height - 70; y += 86) {
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.lineTo(middle - 26, y);
      ctx.moveTo(middle + 26, y);
      ctx.lineTo(game.width - 26, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTargets() {
    for (const item of game.items) {
      ctx.save();
      ctx.globalAlpha = item.matched ? 0.22 : 0.58;
      drawTarget(item.target.x, item.target.y, item.color);
      drawTarget(item.mirrorTarget.x, item.mirrorTarget.y, item.color);
      ctx.restore();
    }
  }

  function drawTarget(x, y, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 23, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
  }

  function drawItems(now) {
    for (const item of game.items) {
      drawItem(item.x, item.y, item, false, now);
      const mirror = mirrorPoint(item.x, item.y);
      drawItem(mirror.x, mirror.y, item, true, now);
    }
  }

  function drawItem(x, y, item, mirrored, now) {
    const pulse = item.matched ? 0.88 : 1 + Math.sin(now * 0.006 + item.phase) * 0.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = mirrored ? 0.58 : 1;
    ctx.fillStyle = item.color;
    ctx.shadowColor = item.color;
    ctx.shadowBlur = item.matched ? 6 : 18;
    if (item.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, cfg.itemRadius * pulse, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.shape === "diamond") {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-cfg.itemRadius * pulse, -cfg.itemRadius * pulse, cfg.itemRadius * 2 * pulse, cfg.itemRadius * 2 * pulse);
    } else if (item.shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(0, -20 * pulse);
      ctx.lineTo(18 * pulse, 14 * pulse);
      ctx.lineTo(-18 * pulse, 14 * pulse);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.roundRect(-18 * pulse, -14 * pulse, 36 * pulse, 28 * pulse, 7);
      ctx.fill();
    }
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

  function createItems() {
    const colors = ["#ffbf69", "#72ddf7", "#caffbf", "#ff99c8"];
    const shapes = ["circle", "diamond", "triangle", "box"];
    const yTargets = [0.24, 0.42, 0.61, 0.78];
    return colors.map((color, index) => {
      const target = { x: game.width * (0.18 + 0.1 * (index % 2)), y: game.height * yTargets[index] };
      return {
        x: game.width * (0.2 + 0.08 * (index % 2)),
        y: game.height * (0.76 - 0.14 * index),
        target,
        mirrorTarget: mirrorPoint(target.x, target.y),
        color,
        shape: shapes[index],
        phase: Math.random() * Math.PI * 2,
        matched: false
      };
    });
  }

  function mirrorPoint(x, y) {
    return { x: game.width - x, y };
  }

  function burst(x, y, color) {
    for (let i = 0; i < 18; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 160;
      game.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 0.7, color });
    }
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
    refs.primary.textContent = `${game.matched}/${cfg.itemCount}`;
    refs.secondary.textContent = String(game.movesLeft);
    refs.time.textContent = String(game.score);
    refs.best.textContent = String(game.best);
  }

  function showMessage(title, score) {
    refs.messageTitle.textContent = title;
    refs.messageScore.textContent = score;
    refs.centerMessage.classList.remove("is-hidden");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readBest() {
    try {
      return Number(localStorage.getItem("mirror-market-best") || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem("mirror-market-best", String(value));
    } catch (_) {
      return;
    }
  }
}());
