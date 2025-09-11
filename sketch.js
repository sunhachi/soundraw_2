let mic, fft;
let shapes = [];
let startTime;
let isCapturing = false;
let startButton;

let cellSize = 150; 
let showDateText = ""; 

let lastShapeTime = 0;
let shapeInterval = 500;

let bgGraphics;

let recordedData = [];
let stats = null;

let currentVals = { volume: 0, pitch: 0, distance: 0 };
let displayVals = { volume: 0, pitch: 0, distance: 0 };

let roseShape = {
  petals: 5, sharpness: 1, baseRadius: 100, loops: 300,
  target: { petals: 5, sharpness: 1, baseRadius: 100, loops: 300 }
};

// === 基準解像度とスケール係数 ===
let BASE_W = 1920;
let BASE_H = 1080;
let scaleFactor = 1;

function setup() {
  createCanvas(windowWidth, windowHeight);

  scaleFactor = min(width / BASE_W, height / BASE_H);

  mic = new p5.AudioIn();
  fft = new p5.FFT();
  fft.setInput(mic);

  startButton = createButton('START');
  startButton.mousePressed(startCapture); // ✅ これを追加
  positionButton();

  textAlign(LEFT, TOP);
  textSize(16 * scaleFactor);
  textFont("prestige-elite-std");

  bgGraphics = createGraphics(width, height);
  drawRadialGradient(bgGraphics);
}

function positionButton() {
  startButton.size(120 * scaleFactor, 60 * scaleFactor);
  startButton.position(width / 2 - (60 * scaleFactor), height / 2);
  startButton.style("font-size", `${20 * scaleFactor}px`);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  scaleFactor = min(width / BASE_W, height / BASE_H);
  positionButton();

  bgGraphics = createGraphics(width, height);
  drawRadialGradient(bgGraphics);
}

function startCapture() {
  userStartAudio();
  mic.start();
  isCapturing = true;
  startTime = millis();
  recordedData = [];
  shapes = [];
  stats = null;
  showDateText = "";
  startButton.hide();
}

function draw() {
  image(bgGraphics, 0, 0);

  push();
  scale(scaleFactor); // === ここからすべて基準解像度に沿って描画 ===

  // 生成された形の描画
  for (let s of shapes) {
    push();
    translate(s.x + s.size/2, s.y + s.size/2);

    let life = millis() - s.birthTime;
    let appearDuration = 1000;
    let t = constrain(life / appearDuration, 0, 1);
    let scaleF = lerp(0, 1, easeOutCubic(t));
    let alpha = lerp(0, 255, t);

    scale(scaleF);
    stroke(0, alpha);
    noFill();
    drawRose(s.volume, s.pitch, s.distance, 0, 0, s.size);
    pop();
  }

  if (isCapturing) {
    let spectrum = fft.analyze();
    let level = mic.getLevel();

    let highEnergy = fft.getEnergy("treble");
    let lowEnergy = fft.getEnergy("bass");
    let highNorm = highEnergy / 255;
    let lowNorm = lowEnergy / 255;
    let levelNorm = constrain(level * 5, 0, 1);
    let distance = map(levelNorm, 0, 1, 1, 0);
    let quiet = 1 - levelNorm;
    let near = 1 - distance;

    recordedData.push({ high: highNorm, low: lowNorm, volume: levelNorm, distance, quiet, near });

    let debugW = 600;
    let debugH = 280;
    let debugX = 0;
    let debugY = BASE_H - debugH; // 基準解像度に固定

    textAlign(LEFT, TOP);
    textSize(14);
    textFont("prestige-elite-std");
    fill(0);
    text("Sound Info (animated):", debugX + 20, debugY + 10);

    let barX = debugX + 100;
    let barW = 120;
    let barH = 12;
    let rowH = 32;

    currentVals = { volume: levelNorm, pitch: highNorm, distance };
    displayVals.volume = lerp(displayVals.volume, currentVals.volume, 0.1);
    displayVals.pitch  = lerp(displayVals.pitch,  currentVals.pitch,  0.1);
    displayVals.distance = lerp(displayVals.distance, currentVals.distance, 0.1);

    let quietDisp = 1 - displayVals.volume;
    let nearDisp  = 1 - displayVals.distance;

    drawDebugBar("High", displayVals.pitch, debugX + 20, debugY + 35, barX, barW, barH);
    drawDebugBar("Low", 1 - displayVals.pitch, debugX + 20, debugY + 35 + rowH, barX, barW, barH);
    drawDebugBar("Loud", displayVals.volume, debugX + 20, debugY + 35 + rowH*2, barX, barW, barH);
    drawDebugBar("Quiet", quietDisp, debugX + 20, debugY + 35 + rowH*3, barX, barW, barH);
    drawDebugBar("Far", displayVals.distance, debugX + 20, debugY + 35 + rowH*4, barX, barW, barH);
    drawDebugBar("Near", nearDisp, debugX + 20, debugY + 35 + rowH*5, barX, barW, barH);

    roseShape.target.petals = int(map(displayVals.pitch, 0, 1, 3, 12));
    roseShape.target.sharpness = map(displayVals.pitch, 0, 1, 0.3, 1.5);
    roseShape.target.baseRadius = map(displayVals.volume, 0, 1, 80, 150);
    roseShape.target.loops = int(map(displayVals.distance, 0, 1, 200, 600));

    roseShape.petals = lerp(roseShape.petals, roseShape.target.petals, 0.05);
    roseShape.sharpness = lerp(roseShape.sharpness, roseShape.target.sharpness, 0.05);
    roseShape.baseRadius = lerp(roseShape.baseRadius, roseShape.target.baseRadius, 0.05);
    roseShape.loops = lerp(roseShape.loops, roseShape.target.loops, 0.05);

    push();
    translate(debugX + debugW - 150, debugY + debugH / 2);
    scale(0.4);
    stroke(0);
    noFill();
    textFont("prestige-elite-std");
    drawRoseCustomWithValues(roseShape, {
      pitch: displayVals.pitch,
      pitchLow: 1 - displayVals.pitch,
      volume: displayVals.volume,
      volumeLow: quietDisp,
      distance: displayVals.distance,
      distanceNear: nearDisp
    });
    pop();

    if (millis() - lastShapeTime > shapeInterval) {
      placeShape(levelNorm, highNorm, distance);
      lastShapeTime = millis();
    }

    if (millis() - startTime > 10000) {
      isCapturing = false;

      setTimeout(() => {
        let now = new Date();
        showDateText = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        stats = calcStats(recordedData);
      }, 3000);

      setTimeout(() => {
        startButton.show();
        shapes = [];
        showDateText = "";
        stats = null;
      }, 13000);
    }
  }

  if (showDateText) {
    textSize(16);
    textFont("prestige-elite-std");
    fill(0);
    textAlign(LEFT, BOTTOM);

    let bottomMargin = 50; 
    let statsBaseY = BASE_H - bottomMargin - 160; 

    if (stats) {
      text("Recording Stats:", 20, statsBaseY);
      text(`High: ${nf(stats.high * 100, 2, 0)}%`, 40, statsBaseY + 20);
      text(`Low: ${nf(stats.low * 100, 2, 0)}%`, 40, statsBaseY + 40);
      text(`Loud: ${nf(stats.volume * 100, 2, 0)}%`, 40, statsBaseY + 60);
      text(`Quiet: ${nf(stats.quiet * 100, 2, 0)}%`, 40, statsBaseY + 80);
      text(`Far: ${nf(stats.distance * 100, 2, 0)}%`, 40, statsBaseY + 100);
      text(`Near: ${nf(stats.near * 100, 2, 0)}%`, 40, statsBaseY + 120);

      push();
      translate(300, statsBaseY + 80);
      scale(0.3);
      stroke(0);
      noFill();
      drawRose(stats.volume, stats.high, stats.distance, 0, 0, 300);
      pop();
    }

    textSize(24);
    text(showDateText, 20, BASE_H - 20);
  }

  pop(); // scaleFactor end
}

// ==== Rose curve ====
function drawRose(volume, pitch, distance, x, y, size) {
  beginShape();
  let petals = int(map(pitch, 0, 1, 3, 12));
  let loops = int(map(distance, 0, 1, 200, 600)); 
  let baseRadius = map(volume, 0, 1, size * 0.2, size * 0.5);
  let sharpness = map(pitch, 0, 1, 0.3, 1.5);

  for (let i = 0; i < loops; i++) {
    let theta = map(i, 0, loops, 0, TWO_PI);
    let r = baseRadius *
            (cos(petals * theta) + sharpness * sin((petals + 2) * theta));
    let px = r * cos(theta);
    let py = r * sin(theta);
    vertex(x + px, y + py);
  }
  endShape(CLOSE);
}

// === 花びら＋値の描画 ===
function drawRoseCustomWithValues(shape, vals) {
  beginShape();
  let petals = shape.petals;
  let loops = int(shape.loops);
  let baseRadius = shape.baseRadius;
  let sharpness = shape.sharpness;

  let labelPositions = [];

  for (let i = 0; i < loops; i++) {
    let theta = map(i, 0, loops, 0, TWO_PI);
    let r = baseRadius *
            (cos(petals * theta) + sharpness * sin((petals + 2) * theta));
    let px = r * cos(theta);
    let py = r * sin(theta);
    vertex(px, py);

    if (i === int(loops * 0.05)) {
      labelPositions.push({ x: px, y: py, label: "High", value: vals.pitch ?? 0 });
    }
    if (i === int(loops * 0.20)) {
      labelPositions.push({ x: px, y: py, label: "Low", value: vals.pitchLow ?? 0 });
    }
    if (i === int(loops * 0.35)) {
      labelPositions.push({ x: px, y: py, label: "Loud", value: vals.volume ?? 0 });
    }
    if (i === int(loops * 0.50)) {
      labelPositions.push({ x: px, y: py, label: "Quiet", value: vals.volumeLow ?? 0 });
    }
    if (i === int(loops * 0.65)) {
      labelPositions.push({ x: px, y: py, label: "Far", value: vals.distance ?? 0 });
    }
    if (i === int(loops * 0.80)) {
      labelPositions.push({ x: px, y: py, label: "Near", value: vals.distanceNear ?? 0 });
    }
  }
  endShape(CLOSE);

  push();
  noStroke();
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(14);
  textFont("prestige-elite-std");
  for (let p of labelPositions) {
    let valText = nf(p.value, 1, 2);
    text(`${p.label}: ${valText}`, p.x * 1.2, p.y * 1.2);
  }
  pop();
}

function placeShape(volume, pitch, distance) {
  let index = shapes.length;
  let cols = floor(BASE_W / cellSize);
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

  let h = hour();
  let innerColor;
  if (h >= 4 && h < 8) {
    innerColor = color(255, 220, 200);
  } else if (h >= 8 && h < 12) {
    innerColor = color(255, 255, 230);
  } else if (h >= 12 && h < 16) {
    innerColor = color(220, 240, 255);
  } else if (h >= 16 && h < 19) {
    innerColor = color(255, 210, 220);
  } else {
    innerColor = color(160, 180, 210);
  }

  let outerColor = color(255, 255, 255);

  pg.noStroke();
  for (let r = maxRadius; r > 0; r--) {
    let t = map(r, 0, maxRadius, 0, 1);
    let col = lerpColor(innerColor, outerColor, t);
    pg.fill(col);
    pg.ellipse(cx, cy, r * 2, r * 2);
  }
}

function drawDebugBar(label, value, lx, ly, bx, bw, bh) {
  textSize(14);
  fill(0);
  text(label, lx, ly);

  stroke(0);
  noFill();
  rect(bx, ly, bw, bh);

  noStroke();
  fill(120);
  rect(bx, ly, bw * constrain(value, 0, 1), bh);

  fill(0);
  textAlign(LEFT, TOP);
  text(nf(value, 1, 2), bx + bw + 10, ly - 2); 
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

