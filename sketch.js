let mic, fft;
let images = {};
let detectedTypes = [];
let startTime;
let isCapturing = false;
let startButton;

function preload() {
  const types = ['high', 'low', 'loud', 'quiet', 'far', 'near', 'silence'];
  for (let type of types) {
    images[type] = loadImage(`assets/${type}.png`);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);

  mic = new p5.AudioIn();
  fft = new p5.FFT();
  fft.setInput(mic);

  startButton = createButton('START');
  startButton.position(width / 2 - 60, height / 2);
  startButton.size(120, 60);
  startButton.mousePressed(startCapture);

  textAlign(LEFT, BOTTOM);
  textSize(24);
  fill(255);
}

function draw() {
  if (isCapturing) {
    let spectrum = fft.analyze();
    let level = mic.getLevel();

    // デバッグ用に画面に表示
    fill(255);
    text(`level: ${level.toFixed(3)}`, 20, 40);

    let type = detectType(spectrum, level);

    // 0.16秒に1回くらい追加
    if (frameCount % 10 === 0 && type) {
      detectedTypes.push(type);
    }

    if (millis() - startTime > 10000) {
      isCapturing = false;
      generateResult();
    }
  }
}

async function startCapture() {
  await userStartAudio(); // 🔑 これを必ず入れる
  mic.start();

  isCapturing = true;
  startTime = millis();
  detectedTypes = [];
  background(0);
  startButton.hide();
}

function detectType(spectrum, level) {
  let highEnergy = fft.getEnergy("treble");
  let lowEnergy = fft.getEnergy("bass");

  // level の typical range: silence 0.001〜0.01, speaking 0.05〜0.3
  if (level < 0.005) return 'silence';
  if (highEnergy > 140) return 'high';
  if (lowEnergy > 140) return 'low';
  if (level > 0.1) return 'loud';
  if (level < 0.02) return 'quiet';

  return random(['near', 'far']);
}

function generateResult() {
  background(0);
  let positions = [];
  for (let type of detectedTypes) {
    let img = images[type];
    if (!img) continue;

    let x, y, size;
    let safe = 0;
    do {
      size = random(80, 150); // 画像サイズランダム
      x = random(width - size);
      y = random(height - size);
      safe++;
    } while (positions.some(p => dist(p.x, p.y, x, y) < 120) && safe < 100);

    image(img, x, y, size, size);
    positions.push({ x, y });
  }

  // 日付と集音時間
  let now = new Date();
  let dateText = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  fill(255);
  text(dateText, 20, height - 20);

  // 10秒後に初期画面へ戻す
  setTimeout(() => {
    background(0);
    startButton.show();
  }, 10000);
}
