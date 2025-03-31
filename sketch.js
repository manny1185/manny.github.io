// --- 游戏变量 ---
let player;         // 玩家对象
let obstacles = []; // 存储障碍物的数组
let score = 0;
let gameState = 'playing'; // 'playing' 或 'gameOver'
let spawnRate = 60; // 每多少帧生成一个障碍物 (越小越难)
let obstacleSpeed = 3; // 障碍物下落速度

// --- 玩家类 ---
class Player {
  constructor() {
    this.size = 30; // 圆圈直径
    this.x = width / 2;
    this.y = height - this.size / 2 - 10; // 靠近底部
  }

  // 根据鼠标位置更新玩家位置
  update() {
    this.x = constrain(mouseX, this.size / 2, width - this.size / 2);
    // this.y 保持不变
  }

  // 绘制玩家
  display() {
    fill(0, 150, 255); // 蓝色
    noStroke();
    ellipse(this.x, this.y, this.size, this.size);
  }

  // 碰撞检测 (与单个障碍物)
  collides(obstacle) {
    // 使用 p5.js 的 collideRectCircle 函数（需要 p5.collide2d 库）
    // 或者自己实现简单的距离检测
    // 这里用简单的矩形与圆形碰撞检测（近似）

    // 找到矩形上离圆心最近的点
    let closestX = constrain(this.x, obstacle.x, obstacle.x + obstacle.w);
    let closestY = constrain(this.y, obstacle.y, obstacle.y + obstacle.h);

    // 计算该点与圆心的距离
    let distance = dist(this.x, this.y, closestX, closestY);

    // 如果距离小于圆的半径，则发生碰撞
    return distance < this.size / 2;
  }
}

// --- 障碍物类 ---
class Obstacle {
  constructor() {
    this.w = random(20, 50); // 随机宽度
    this.h = random(20, 50); // 随机高度
    this.x = random(width - this.w); // 随机 x 位置 (在画布内)
    this.y = 0 - this.h; // 从屏幕顶部上方开始
    this.speed = obstacleSpeed + random(-0.5, 1); // 基础速度加一点随机性
  }

  // 更新障碍物位置 (向下移动)
  update() {
    this.y += this.speed;
  }

  // 绘制障碍物
  display() {
    fill(255, 0, 0); // 红色
    noStroke();
    rect(this.x, this.y, this.w, this.h);
  }

  // 检查障碍物是否移出屏幕底部
  isOffscreen() {
    return this.y > height;
  }
}

// --- p5.js 主要函数 ---

// 在所有资源加载完成之前执行（这里没用到）
// function preload() {}

// 初始化设置，只运行一次
function setup() {
  let canvas = createCanvas(600, 400); // 创建画布
  canvas.parent('main'); // 将画布放入 HTML 中 id 为 'main' 的元素内
  player = new Player(); // 创建玩家实例
  textAlign(CENTER, CENTER);
  textSize(24);
  // frameRate(30); // 可以取消注释以降低帧率
}

// 循环绘制和更新，每帧运行
function draw() {
  background(51); // 设置深灰色背景

  if (gameState === 'playing') {
    // --- 游戏进行中 ---

    // 更新和显示玩家
    player.update();
    player.display();

    // 每隔 spawnRate 帧生成一个新障碍物
    if (frameCount % spawnRate === 0) {
      obstacles.push(new Obstacle());
      // 稍微增加难度 (可选)
      // obstacleSpeed += 0.05;
      // spawnRate = max(20, spawnRate - 1); // 最快每 20 帧生成一个
    }

    // 遍历所有障碍物 (从后往前遍历，方便删除)
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].update();
      obstacles[i].display();

      // 检查碰撞
      if (player.collides(obstacles[i])) {
        gameState = 'gameOver';
        // noLoop(); // 停止 draw 循环，或者在 gameOver 状态处理
      }

      // 如果障碍物移出屏幕，则从数组中移除
      if (obstacles[i].isOffscreen()) {
        obstacles.splice(i, 1);
        // 在这里增加分数可能更合理（成功躲避一个）
        // score++;
      }
    }

    // 更新分数 (按时间)
    score = floor(frameCount / 10); // 简单地用帧数计算分数

    // 显示分数
    fill(255);
    textSize(20);
    textAlign(LEFT, TOP);
    text("分数: " + score, 10, 10);

  } else if (gameState === 'gameOver') {
    // --- 游戏结束 ---
    fill(255, 0, 0);
    textSize(48);
    textAlign(CENTER, CENTER);
    text("游戏结束!", width / 2, height / 2 - 40);

    fill(255);
    textSize(24);
    text("最终分数: " + score, width / 2, height / 2 + 10);
    text("点击屏幕重新开始", width / 2, height / 2 + 50);
    // 可以在这里调用 noLoop() 如果之前没调用
  }
}

// --- 事件处理 ---

// 当鼠标被点击时调用
function mousePressed() {
  // 如果游戏结束，则重新开始
  if (gameState === 'gameOver') {
    resetGame();
  }
}

// 重置游戏状态
function resetGame() {
  obstacles = []; // 清空障碍物
  score = 0;
  frameCount = 0; // 重置帧数计数器 (影响分数和生成)
  obstacleSpeed = 3; // 重置速度
  spawnRate = 60; // 重置生成速率
  player = new Player(); // 重置玩家位置
  gameState = 'playing';
  // loop(); // 如果之前调用了 noLoop()，需要调用 loop() 重启 draw 循环
}
