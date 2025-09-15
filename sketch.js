let mic, fft;
let shapes = [];
let startTime;
let isCapturing = false;

let cellSize = 150;
let showDateText = "";

let lastShapeTime = 0;
let shapeInterval = 500;

let bgGraphics;
let bgImg;

let recordedData = [];
let stats = null;

let currentVals = { volume: 0, pitch: 0, distance: 0 };
let displayVals = { volume: 0, pitch: 0, distance: 0 };

let roseShape = {
  petals: 5, sharpness: 1, baseRadius: 100, loops: 300,
  target: { petals: 5, sharpness: 1, baseRadius: 100, loops: 300 }
};

let BASE_SIZE = 1080; // 正方形基準
let scaleFactor = 1;

let exitAnimation = false;
let exitStartTime = 0;
let exitDuration = 2000;
let dateShownAt = 0;
let state = "start";

let autoStartThreshold = 0.05;

function preload() {
  bgImg = loadImage("IMG_4331.jpg");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  scaleFactor = BASE_SIZE / 1080;

  mic = new p5.AudioIn();
  fft = new p5.FFT();
  fft.setInput(mic);

  textAlign(LEFT, TOP);
  textSize(16 * scaleFactor);
  textFont("prestige-elite-std");

  bgGraphics = createGraphics(BASE_SIZE, BASE_SIZE);
  drawRadialGradient(bgGraphics);

  userStartAudio();
  mic.start();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function startCapture() {
  isCapturing = true;
  exitAnimation = false;
  startTime = millis();
  recordedData = [];
  shapes = [];
  stats = null;
  showDateText = "";
  state = "recording";
}

function draw() {
  // === 背景画像を最背面に ===
  image(bgImg, 0, 0, width, height);

  // === 中央に正方形領域を確保 ===
  let drawSize = min(width, height) * 0.9; // 画面に対して9割のサイズ
  let offsetX = (width - drawSize) / 2;
  let offsetY = (height - drawSize) / 2;

  push();
  translate(offsetX, offsetY);

  // 1. グラデーション背景を描画
  image(bgGraphics, 0, 0, drawSize, drawSize);

  // 2. その上に花びらや日付などを描画
  let exitProgress = 0;
  if (exitAnimation) {
    exitProgress = constrain((millis() - exitStartTime) / exitDuration, 0, 1);
  }

  let yOffset = -exitProgress * drawSize;
  let alphaFade = 255 * (1 - exitProgress);

  if (state === "start") {
    let level = mic.getLevel();
    if (level > autoStartThreshold) {
      startCapture();
    }
  }

  if (state === "recording") {
    let spectrum = fft.analyze();
    let level = mic.getLevel();

    let highEnergy = fft.getEnergy("treble");
    let lowEnergy = fft.getEnergy("bass");
    let highNorm = highEnergy / 255;
    let lowNorm = lowEnergy / 255;
    let levelNorm = constrain(level * 10, 0, 1);
    let distance = map(levelNorm, 0, 1, 1, 0);
    let quiet = 1 - levelNorm;
    let near = 1 - distance;

    recordedData.push({ high: highNorm, low: lowNorm, volume: levelNorm, distance, quiet, near });

    currentVals = { volume: levelNorm, pitch: highNorm, distance };
    displayVals.volume = lerp(displayVals.volume, currentVals.volume, 0.1);
    displayVals.pitch = lerp(displayVals.pitch, currentVals.pitch, 0.1);
    displayVals.distance = lerp(displayVals.distance, currentVals.distance, 0.1);

    roseShape.target.petals = int(map(displayVals.pitch, 0, 1, 3, 12));
    roseShape.target.sharpness = map(displayVals.pitch, 0, 1, 0.3, 1.5);
    roseShape.target.baseRadius = map(displayVals.volume, 0, 1, 80, 150);
    roseShape.target.loops = int(map(displayVals.distance, 0, 1, 200, 600));

    roseShape.petals = lerp(roseShape.petals, roseShape.target.petals, 0.05);
    roseShape.sharpness = lerp(roseShape.sharpness, roseShape.target.sharpness, 0.05);
    roseShape.baseRadius = lerp(roseShape.baseRadius, roseShape.target.baseRadius, 0.05);
    roseShape.loops = lerp(roseShape.loops, roseShape.target.loops, 0.05);

    if (millis() - lastShapeTime > shapeInterval) {
      placeShape(levelNorm, highNorm, distance, drawSize);
      lastShapeTime = millis();
    }

    if (millis() - startTime > 10000) {
      isCapturing = false;
      state = "finished";
      let now = new Date();
      showDateText = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      dateShownAt = millis();
      stats = calcStats(recordedData);
    }
  }

  if (state === "finished") {
    let elapsedSinceDate = millis() - dateShownAt;

    if (elapsedSinceDate > 5000 && !exitAnimation) {
      exitAnimation = true;
      exitStartTime = millis();
    }

    if (exitAnimation && millis() - exitStartTime > exitDuration + 2000) {
      state = "start";
      exitAnimation = false;
      shapes = [];
      showDateText = "";
      stats = null;
    }
  }

  for (let s of shapes) {
    push();
    translate(s.x + s.size/2, s.y + s.size/2 + yOffset);
    let life = millis() - s.birthTime;
    let appearDuration = 1000;
    let t = constrain(life / appearDuration, 0, 1);
    let scaleF = lerp(0, 1, easeOutCubic(t));
    let alpha = lerp(0, alphaFade, t);

    scale(scaleF);
    stroke(0, alpha);
    noFill();
    drawRose(s.volume, s.pitch, s.distance, 0, 0, s.size);
    pop();
  }

  if (showDateText) {
    textSize(28);
    fill(0, alphaFade);
    textAlign(LEFT, BOTTOM);
    text("soundraw", 20, drawSize - 60 + yOffset);

    textSize(24);
    text(showDateText, 20, drawSize - 20 + yOffset);
  }

  pop();
}

function drawRose(volume, pitch, distance, x, y, size) {
  beginShape();
  let petals = int(map(pitch, 0, 1, 3, 12));
  let loops = int(map(distance, 0, 1, 200, 600)); 
  let baseRadius = map(volume, 0, 1, size * 0.2, size * 0.5);
  let sharpness = map(pitch, 0, 1, 0.3, 1.5);

  for (let i = 0; i < loops; i++) {
    let theta = map(i, 0, loops, 0, TWO_PI);
    let r = baseRadius * (cos(petals * theta) + sharpness * sin((petals + 2) * theta));
    let px = r * cos(theta);
    let py = r * sin(theta);
    vertex(x + px, y + py);
  }
  endShape(CLOSE);
}

function placeShape(volume, pitch, distance, drawSize) {
  let index = shapes.length;
  let cols = floor(drawSize / cellSize);
  let x = (index % cols) * cellSize + cellSize * 0.1;
  let y = floor(index / cols) * cellSize + cellSize * 0.1;
  let size = cellSize * 0.8;
  shapes.push({ volume, pitch, distance, x, y, size, birthTime: millis() });
}

function easeOutCubic(t) {
  return 1 - pow(1 - t, 3);
}

function drawRadialGradient(pg) {
  let cx = pg.width / 2;
  let cy = pg.height / 2;
  let maxRadius = dist(0, 0, pg.width, pg.height);

  let innerColor = color(200, 200, 220);
  let outerColor = color(255, 255, 255);

  pg.noStroke();
  for (let r = maxRadius; r > 0; r--) {
    let t = map(r, 0, maxRadius, 0, 1);
    let col = lerpColor(innerColor, outerColor, t);
    pg.fill(col);
    pg.ellipse(cx, cy, r * 2, r * 2);
  }
}

function calcStats(data) {
  if (data.length === 0) return null;
  let sum = { high: 0, low: 0, volume: 0, distance: 0, quiet: 0, near: 0 };
  for (let d of data) {
    sum.high += d.high;
    sum.low += d.low;
    sum.volume += d.volume;
    sum.distance += d.distance;
    sum.quiet += d.quiet;
    sum.near += d.near;
  }
  let n = data.length;
  return {
    high: sum.high / n,
    low: sum.low / n,
    volume: sum.volume / n,
    distance: sum.distance / n,
    quiet: sum.quiet / n,
    near: sum.near / n
  };
}

