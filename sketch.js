// --- 游戏变量 ---
let player;
let obstacles = [];
let bullets = []; // 新增：存储子弹的数组
let score = 0;
let gameState = 'playing';
let spawnRate = 60;
let obstacleSpeed = 3;

// --- 玩家类 (Player Class) ---
class Player {
  constructor() {
    this.size = 30;
    this.x = width / 2;
    this.y = height - this.size / 2 - 10;
  }

  update() {
    if (typeof width !== 'undefined') {
       this.x = constrain(mouseX, this.size / 2, width - this.size / 2);
    }
  }

  display() {
    fill(0, 150, 255); // 蓝色
    noStroke();
    ellipse(this.x, this.y, this.size, this.size);
  }

  collides(obstacle) {
    let closestX = constrain(this.x, obstacle.x, obstacle.x + obstacle.w);
    let closestY = constrain(this.y, obstacle.y, obstacle.y + obstacle.h);
    let distance = dist(this.x, this.y, closestX, closestY);
    return distance < this.size / 2;
  }

  // 新增：射击方法，返回一个新子弹实例
  shoot() {
    // 子弹从玩家中心略上方发射
    return new Bullet(this.x, this.y - this.size / 2);
  }
}

// --- 障碍物类 (Obstacle Class) ---
class Obstacle {
  constructor() {
    this.w = random(20, 50);
    this.h = random(20, 50);
    if (typeof width !== 'undefined') {
        this.x = random(width - this.w);
    } else {
        this.x = random(0, 400);
    }
    this.y = 0 - this.h;
    this.speed = obstacleSpeed + random(-0.5, 1);
  }

  update() {
    this.y += this.speed;
  }

  display() {
    fill(255, 0, 0); // 红色
    noStroke();
    rect(this.x, this.y, this.w, this.h);
  }

  isOffscreen() {
    return typeof height !== 'undefined' && this.y > height;
  }
}

// --- 新增：子弹类 (Bullet Class) ---
class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 8;  // 子弹大小
    this.speed = -7; // 子弹向上移动速度（负值）
  }

  update() {
    this.y += this.speed;
  }

  display() {
    fill(255, 255, 0); // 黄色子弹
    noStroke();
    ellipse(this.x, this.y, this.size, this.size);
  }

  // 检查子弹是否飞出屏幕顶部
  isOffscreen() {
    return this.y < 0;
  }

  // 检查子弹是否击中障碍物 (简单的矩形包含点检测)
  hits(obstacle) {
    // 检查子弹中心点 (this.x, this.y) 是否在障碍物矩形内
    return (this.x > obstacle.x &&
            this.x < obstacle.x + obstacle.w &&
            this.y > obstacle.y &&
            this.y < obstacle.y + obstacle.h);
  }
}

// --- p5.js 主要函数 ---

function setup() {
  let canvas = createCanvas(600, 400);
  // canvas.parent('game-canvas-container'); // 如果需要放在特定 div 中，取消注释并确保 HTML 中有对应 ID

  player = new Player();
  textAlign(CENTER, CENTER);
  textSize(24);
}

function draw() {
  if (typeof width === 'undefined' || typeof height === 'undefined') {
      return;
  }
  background(51);

  if (gameState === 'playing') {
    // --- 游戏进行中 ---

    // 更新和显示玩家
    if (player) {
        player.update();
        player.display();
    }

    // 生成障碍物
    if (frameCount % spawnRate === 0) {
      obstacles.push(new Obstacle());
    }

    // 更新和显示障碍物，并检查玩家碰撞
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].update();
      obstacles[i].display();

      if (player && player.collides(obstacles[i])) {
        gameState = 'gameOver';
      }

      if (obstacles[i].isOffscreen()) {
        obstacles.splice(i, 1);
      }
    }

    // 更新和显示子弹，并检查碰撞和出界 (从后往前遍历！)
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update();
      bullets[i].display();

      // 检查子弹是否击中障碍物
      let hitObstacle = false;
      for (let j = obstacles.length - 1; j >= 0; j--) {
        if (bullets[i].hits(obstacles[j])) {
          // 击中！移除障碍物和子弹
          obstacles.splice(j, 1);
          bullets.splice(i, 1);
          score += 10; // 击中加分
          hitObstacle = true;
          break; // 子弹已消失，跳出内层障碍物循环
        }
      }

      // 如果子弹没有击中任何障碍物，再检查它是否飞出屏幕
      // (注意：要检查子弹是否在上面的循环中已被移除！)
      if (!hitObstacle && bullets[i] && bullets[i].isOffscreen()) {
        bullets.splice(i, 1);
      }
    }

    // 更新和显示分数
    score = floor(frameCount / 10); // 可以保留时间得分，或者只靠击中得分
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
  }
}

// --- 事件处理 ---

function mousePressed() {
  if (gameState === 'playing') {
    // 在游戏进行中点击，发射子弹
    if (player) { // 确保 player 对象存在
      bullets.push(player.shoot());
    }
  } else if (gameState === 'gameOver') {
    // 在游戏结束后点击，重新开始
    resetGame();
  }
}

// 重置游戏状态
function resetGame() {
  obstacles = [];
  bullets = []; // 新增：清空子弹数组
  score = 0;
  frameCount = 0;
  obstacleSpeed = 3;
  spawnRate = 60;
  if (typeof width !== 'undefined' && typeof height !== 'undefined') {
      player = new Player();
  }
  gameState = 'playing';
  loop(); // 确保 draw 循环在运行
}
