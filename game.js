// ═══════════════════════════════════════════════════════════════
// GitHub Pong 3D — Eyebrow-Controlled 2-Player Pong
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────
  const FIELD_W = 20;
  const FIELD_H = 14;
  const WALL_THICKNESS = 0.4;

  // Paddles (tall, thin, on left/right edges)
  const PADDLE_W = 0.55;
  const PADDLE_H = 2.8;
  const PADDLE_D = 0.55;
  const PADDLE_SPEED = 9;
  const PADDLE_X_OFFSET = 1.2;

  // Ball (green contribution square)
  const BALL_SIZE = 0.45;
  const BALL_DEPTH = 0.22;
  const BALL_SPEED_INITIAL = 9;
  const BALL_SPEED_MAX = 18;
  const BALL_SPEED_INCREMENT = 0.2;

  // Scoring
  const WIN_SCORE = 5;
  const SCORE_PAUSE = 1.2;

  // Colors
  const GITHUB_BG = 0x0d1117;
  const GITHUB_GREENS = [0x9be9a8, 0x40c463, 0x30a14e, 0x216e39];
  const P1_COLOR = 0x58a6ff;
  const P2_COLOR = 0xbc8cff;
  const BALL_COLOR = 0x40c463;

  // Camera
  const CAM_BASE = new THREE.Vector3(0, -2, 24);
  const CAM_LOOKAT = new THREE.Vector3(0, 0, 0);
  const PARALLAX_X = 3.0;
  const PARALLAX_Y = 2.0;

  // Particles
  const PARTICLE_COUNT = 24;
  const SPARKLE_COUNT = 14;
  const PARTICLE_LIFE = 0.8;
  const SPARKLE_LIFE = 0.5;

  // AI
  const AI_SPEED = 7.5;
  const AI_DEAD_ZONE = 0.4;

  // Eyebrow detection
  const EYEBROW_ADAPT_RATE = 0.005;
  const EYEBROW_RAISE_THRESHOLD = 0.012;
  const CALIBRATION_FRAMES = 60;

  // Face tracking landmarks
  const LEFT_BROW = [105, 66, 107, 70, 63];
  const RIGHT_BROW = [334, 296, 336, 300, 293];
  const LEFT_EYE_TOP = 159;
  const RIGHT_EYE_TOP = 386;
  const FOREHEAD = 10;
  const CHIN = 152;

  // ─── State ───────────────────────────────────────────────────
  let gameState = 'WAITING'; // WAITING | PLAYING | SCORED | GAME_OVER
  let p1Score = 0;
  let p2Score = 0;
  let ballSpeed = BALL_SPEED_INITIAL;
  let rallyCount = 0;
  let screenShake = 0;
  let scorePauseTimer = 0;
  let serveDirection = 1;

  // Face tracking state
  let faceLandmarker = null;
  let lastDetectTime = 0;
  let numFacesDetected = 0;

  // Eyebrow state per player
  let p1EyebrowUp = false;
  let p2EyebrowUp = false;
  let p1EyebrowRatio = 0;
  let p2EyebrowRatio = 0;
  let p1Baseline = 0;
  let p2Baseline = 0;
  let p1CalibFrames = 0;
  let p2CalibFrames = 0;
  let p1BaselineSum = 0;
  let p2BaselineSum = 0;

  // Camera face tracking for parallax
  let rawFaceX = 0;
  let rawFaceY = 0;
  let smoothFaceX = 0;
  let smoothFaceY = 0;
  const FACE_SMOOTH = 0.1;

  // Keyboard fallback
  let keysDown = {};
  let useKeyboardFallback = false;

  // ─── DOM ─────────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const webcam = document.getElementById('webcam');
  const webcamContainer = document.getElementById('webcamContainer');
  const webcamLabel = document.getElementById('webcamLabel');
  const overlay = document.getElementById('overlay');
  const gameOverEl = document.getElementById('gameOver');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const p1ScoreEl = document.getElementById('p1Score');
  const p2ScoreEl = document.getElementById('p2Score');
  const finalScoreEl = document.getElementById('finalScore');
  const modeIndicator = document.getElementById('modeIndicator');
  const loadingEl = document.getElementById('loading');

  // ─── Three.js Setup ─────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(GITHUB_BG);
  scene.fog = new THREE.Fog(GITHUB_BG, 30, 50);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.copy(CAM_BASE);
  camera.lookAt(CAM_LOOKAT);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x8b949e, 0.4);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(5, 15, 20);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(1024, 1024);
  mainLight.shadow.camera.left = -14;
  mainLight.shadow.camera.right = 14;
  mainLight.shadow.camera.top = 10;
  mainLight.shadow.camera.bottom = -10;
  scene.add(mainLight);

  const rimLight = new THREE.DirectionalLight(0x40c463, 0.3);
  rimLight.position.set(-8, 5, -10);
  scene.add(rimLight);

  const centerLight = new THREE.PointLight(0x40c463, 0.3, 20);
  centerLight.position.set(0, 0, 5);
  scene.add(centerLight);

  // ─── Playing Field ──────────────────────────────────────────
  // Floor
  const floorGeo = new THREE.PlaneGeometry(FIELD_W + 6, FIELD_H + 6);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0d1117,
    roughness: 0.9,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, 0, -0.5);
  floor.receiveShadow = true;
  scene.add(floor);

  // Grid on floor
  const gridHelper = new THREE.GridHelper(30, 30, 0x161b22, 0x161b22);
  gridHelper.rotation.x = Math.PI / 2;
  gridHelper.position.z = -0.45;
  scene.add(gridHelper);

  // Walls (top and bottom only — ball exits left/right for scoring)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x21262d,
    roughness: 0.7,
    metalness: 0.3,
  });

  function createWall(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // Top wall
  createWall(FIELD_W + 2, WALL_THICKNESS, 0.8, 0, FIELD_H / 2 + WALL_THICKNESS / 2, 0);
  // Bottom wall
  createWall(FIELD_W + 2, WALL_THICKNESS, 0.8, 0, -FIELD_H / 2 - WALL_THICKNESS / 2, 0);

  // Center line (dashed)
  const centerLineMat = new THREE.MeshBasicMaterial({
    color: 0x21262d,
    transparent: true,
    opacity: 0.6,
  });
  const dashCount = 20;
  const dashHeight = FIELD_H / dashCount * 0.5;
  const dashGap = FIELD_H / dashCount;
  for (let i = 0; i < dashCount; i++) {
    const geo = new THREE.BoxGeometry(0.08, dashHeight, 0.08);
    const mesh = new THREE.Mesh(geo, centerLineMat);
    const y = -FIELD_H / 2 + dashGap * 0.5 + i * dashGap;
    mesh.position.set(0, y, -0.2);
    scene.add(mesh);
  }

  // ─── Paddles ────────────────────────────────────────────────
  const p1PaddleX = -FIELD_W / 2 + PADDLE_X_OFFSET;
  const p2PaddleX = FIELD_W / 2 - PADDLE_X_OFFSET;

  const paddleGeo = new THREE.BoxGeometry(PADDLE_W, PADDLE_H, PADDLE_D);

  const p1PaddleMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf3,
    roughness: 0.3,
    metalness: 0.5,
    emissive: P1_COLOR,
    emissiveIntensity: 0.25,
  });
  const p1Paddle = new THREE.Mesh(paddleGeo, p1PaddleMat);
  p1Paddle.position.set(p1PaddleX, 0, 0);
  p1Paddle.castShadow = true;
  scene.add(p1Paddle);

  const p2PaddleMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf3,
    roughness: 0.3,
    metalness: 0.5,
    emissive: P2_COLOR,
    emissiveIntensity: 0.25,
  });
  const p2Paddle = new THREE.Mesh(paddleGeo, p2PaddleMat);
  p2Paddle.position.set(p2PaddleX, 0, 0);
  p2Paddle.castShadow = true;
  scene.add(p2Paddle);

  // Paddle glows
  const p1GlowGeo = new THREE.PlaneGeometry(0.8, PADDLE_H + 1.2);
  const p1GlowMat = new THREE.MeshBasicMaterial({
    color: P1_COLOR,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
  });
  const p1Glow = new THREE.Mesh(p1GlowGeo, p1GlowMat);
  p1Glow.position.set(p1PaddleX - 0.3, 0, -0.2);
  scene.add(p1Glow);

  const p2GlowGeo = new THREE.PlaneGeometry(0.8, PADDLE_H + 1.2);
  const p2GlowMat = new THREE.MeshBasicMaterial({
    color: P2_COLOR,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
  });
  const p2Glow = new THREE.Mesh(p2GlowGeo, p2GlowMat);
  p2Glow.position.set(p2PaddleX + 0.3, 0, -0.2);
  scene.add(p2Glow);

  // ─── Ball (Green Contribution Square) ──────────────────────
  const ballGeo = new THREE.BoxGeometry(BALL_SIZE, BALL_SIZE, BALL_DEPTH);
  const ballMat = new THREE.MeshStandardMaterial({
    color: BALL_COLOR,
    roughness: 0.3,
    metalness: 0.2,
    emissive: BALL_COLOR,
    emissiveIntensity: 0.4,
  });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.castShadow = true;
  scene.add(ball);

  // Ball glow
  const ballGlowGeo = new THREE.BoxGeometry(BALL_SIZE * 2.5, BALL_SIZE * 2.5, BALL_DEPTH);
  const ballGlowMat = new THREE.MeshBasicMaterial({
    color: BALL_COLOR,
    transparent: true,
    opacity: 0.12,
  });
  const ballGlow = new THREE.Mesh(ballGlowGeo, ballGlowMat);
  ball.add(ballGlow);

  let ballVel = new THREE.Vector2(0, 0);

  // Ball trail (green squares)
  const TRAIL_LENGTH = 10;
  const trail = [];
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const size = BALL_SIZE * (1 - i / TRAIL_LENGTH) * 0.6;
    const geo = new THREE.BoxGeometry(size, size, BALL_DEPTH * 0.5);
    const greenIdx = Math.min(i, GITHUB_GREENS.length - 1);
    const mat = new THREE.MeshBasicMaterial({
      color: GITHUB_GREENS[Math.min(Math.floor(i / 3), GITHUB_GREENS.length - 1)],
      transparent: true,
      opacity: 0.35 * (1 - i / TRAIL_LENGTH),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    trail.push({ mesh, x: 0, y: 0 });
  }

  function resetBallToCenter() {
    ball.position.set(0, 0, 0);
    ballVel.set(0, 0);
    trail.forEach(t => { t.x = 0; t.y = 0; t.mesh.visible = false; });
  }

  function serveBall() {
    ball.position.set(0, 0, 0);
    const angle = (Math.random() - 0.5) * Math.PI * 0.5; // -45° to 45°
    ballVel.set(
      Math.cos(angle) * ballSpeed * serveDirection,
      Math.sin(angle) * ballSpeed
    );
    rallyCount = 0;
  }

  resetBallToCenter();

  // ─── Particle System ───────────────────────────────────────
  const particles = [];

  function spawnScoreExplosion(side) {
    const baseX = side === 'left' ? -FIELD_W / 2 : FIELD_W / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const size = 0.08 + Math.random() * 0.15;
      const geo = new THREE.BoxGeometry(size, size, size);
      const colorIdx = Math.floor(Math.random() * GITHUB_GREENS.length);
      const mat = new THREE.MeshBasicMaterial({
        color: GITHUB_GREENS[colorIdx],
        transparent: true,
        opacity: 1,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        baseX + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * FIELD_H * 0.6,
        (Math.random() - 0.5) * 1
      );

      const speed = 3 + Math.random() * 7;
      const angle = Math.random() * Math.PI * 2;
      const elevAngle = (Math.random() - 0.3) * Math.PI;

      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      scene.add(mesh);
      particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * Math.cos(elevAngle) * speed * (side === 'left' ? 1 : -1),
          Math.sin(angle) * Math.cos(elevAngle) * speed,
          Math.sin(elevAngle) * speed
        ),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
        life: PARTICLE_LIFE,
        maxLife: PARTICLE_LIFE,
        type: 'cube',
      });
    }

    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const size = 0.04 + Math.random() * 0.08;
      const geo = new THREE.SphereGeometry(size, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        baseX + (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * FIELD_H * 0.4,
        Math.random() * 0.5
      );

      const speed = 5 + Math.random() * 10;
      const angle = Math.random() * Math.PI * 2;

      scene.add(mesh);
      particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed * (side === 'left' ? 1 : -1) * 0.5,
          Math.sin(angle) * speed,
          (Math.random() - 0.2) * speed * 0.3
        ),
        rotVel: new THREE.Vector3(0, 0, 0),
        life: SPARKLE_LIFE * (0.5 + Math.random() * 0.5),
        maxLife: SPARKLE_LIFE,
        type: 'sparkle',
      });
    }
  }

  function spawnPaddleHit(px, py, color) {
    for (let i = 0; i < 8; i++) {
      const size = 0.04 + Math.random() * 0.08;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, 0);
      const speed = 2 + Math.random() * 4;
      const angle = Math.random() * Math.PI * 2;
      scene.add(mesh);
      particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          (Math.random() - 0.5) * speed * 0.3
        ),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        ),
        life: 0.4,
        maxLife: 0.4,
        type: 'cube',
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        particles.splice(i, 1);
        continue;
      }

      const t = 1 - p.life / p.maxLife;
      const ease = t * t;

      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      if (p.type === 'cube') {
        p.vel.z -= 10 * dt;
        p.vel.x *= (1 - 2.0 * dt);
        p.vel.y *= (1 - 2.0 * dt);
      }

      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;

      p.mesh.material.opacity = 1 - ease;
      const s = 1 - ease * 0.7;
      p.mesh.scale.set(s, s, s);

      if (p.type === 'sparkle') {
        p.mesh.material.opacity *= 0.5 + Math.sin(p.life * 30) * 0.5;
      }
    }
  }

  // ─── Face Tracking (MediaPipe FaceLandmarker) ──────────────
  async function initFaceTracking() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      });
      webcam.srcObject = stream;
      webcam.load();
      await webcam.play();

      webcamLabel.textContent = 'Loading model\u2026';

      const vision = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
      );

      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      let landmarker;
      try {
        landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 2,
          outputFaceBlendshapes: true,
        });
      } catch (gpuErr) {
        console.warn('GPU delegate failed, falling back to CPU:', gpuErr);
        landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          },
          runningMode: 'VIDEO',
          numFaces: 2,
          outputFaceBlendshapes: true,
        });
      }
      faceLandmarker = landmarker;

      webcamLabel.textContent = 'Face tracking active';
      webcamLabel.classList.add('tracking');
      webcamContainer.classList.add('tracking');
      loadingEl.classList.add('hidden');

      detectFaces();
    } catch (err) {
      console.warn('Face tracking not available, falling back to keyboard:', err);
      webcamLabel.textContent = 'Camera unavailable \u2014 use keyboard';
      loadingEl.textContent = 'Using keyboard control';
      modeIndicator.textContent = 'Keyboard: W/S + \u2191/\u2193';
      useKeyboardFallback = true;
      setTimeout(() => loadingEl.classList.add('hidden'), 3000);
    }
  }

  function detectFaces() {
    if (!faceLandmarker) return;
    requestAnimationFrame(detectFaces);

    const now = performance.now();
    if (now - lastDetectTime < 33) return;
    lastDetectTime = now;

    try {
      const result = faceLandmarker.detectForVideo(webcam, now);

      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        const faces = result.faceLandmarks;
        const blendshapes = result.faceBlendshapes || [];
        numFacesDetected = faces.length;

        // Sort faces by X position (in raw video coords)
        // Higher X in raw = left in mirrored view = P1
        const indexed = faces.map((lm, i) => ({
          landmarks: lm,
          blendshapes: blendshapes[i] || null,
          centerX: lm[1].x, // nose bridge
        }));
        indexed.sort((a, b) => b.centerX - a.centerX); // descending X = P1 first

        // Player 1 (left paddle)
        const p1Face = indexed[0];
        processEyebrows(p1Face, 1);

        // Use first face for camera parallax
        const nose = p1Face.landmarks[1];
        rawFaceX = -(nose.x - 0.5) * 2;
        rawFaceY = -(nose.y - 0.5) * 2;

        // Player 2 (right paddle)
        if (indexed.length >= 2) {
          const p2Face = indexed[1];
          processEyebrows(p2Face, 2);
          modeIndicator.textContent = '2 Players';
          modeIndicator.classList.add('two-player');
        } else {
          // AI controls P2
          p2EyebrowUp = false;
          modeIndicator.textContent = '1 Player + AI';
          modeIndicator.classList.remove('two-player');
        }

        if (!webcamContainer.classList.contains('tracking')) {
          webcamContainer.classList.add('tracking');
          webcamLabel.textContent = 'Face tracking active';
          webcamLabel.classList.add('tracking');
        }
      } else {
        numFacesDetected = 0;
        p1EyebrowUp = false;
        p2EyebrowUp = false;
        webcamContainer.classList.remove('tracking');
        webcamLabel.textContent = 'No face detected';
        webcamLabel.classList.remove('tracking');
        modeIndicator.textContent = 'No face detected';
        modeIndicator.classList.remove('two-player');
      }
    } catch (e) {
      // Silently continue on detection errors
    }
  }

  function processEyebrows(faceData, playerNum) {
    const lm = faceData.landmarks;

    // Try blendshapes first (more reliable)
    if (faceData.blendshapes && faceData.blendshapes.categories) {
      const cats = faceData.blendshapes.categories;
      let browUp = 0;
      let browCount = 0;
      for (const cat of cats) {
        if (cat.categoryName === 'browInnerUp' ||
            cat.categoryName === 'browOuterUpLeft' ||
            cat.categoryName === 'browOuterUpRight') {
          browUp += cat.score;
          browCount++;
        }
      }
      if (browCount > 0) {
        const avg = browUp / browCount;
        if (playerNum === 1) {
          p1EyebrowUp = avg > 0.3;
        } else {
          p2EyebrowUp = avg > 0.3;
        }
        return;
      }
    }

    // Fallback: landmark-based detection
    let browAvgY = 0;
    const browLandmarks = [...LEFT_BROW, ...RIGHT_BROW];
    for (const idx of browLandmarks) {
      browAvgY += lm[idx].y;
    }
    browAvgY /= browLandmarks.length;

    const eyeAvgY = (lm[LEFT_EYE_TOP].y + lm[RIGHT_EYE_TOP].y) / 2;
    const faceHeight = lm[CHIN].y - lm[FOREHEAD].y;

    if (faceHeight < 0.01) return;

    const ratio = (eyeAvgY - browAvgY) / faceHeight;

    if (playerNum === 1) {
      p1EyebrowRatio = ratio;
      if (p1CalibFrames < CALIBRATION_FRAMES) {
        p1BaselineSum += ratio;
        p1CalibFrames++;
        p1Baseline = p1BaselineSum / p1CalibFrames;
        p1EyebrowUp = false;
      } else {
        p1EyebrowUp = ratio > p1Baseline + EYEBROW_RAISE_THRESHOLD;
        if (!p1EyebrowUp) {
          p1Baseline += (ratio - p1Baseline) * EYEBROW_ADAPT_RATE;
        }
      }
    } else {
      p2EyebrowRatio = ratio;
      if (p2CalibFrames < CALIBRATION_FRAMES) {
        p2BaselineSum += ratio;
        p2CalibFrames++;
        p2Baseline = p2BaselineSum / p2CalibFrames;
        p2EyebrowUp = false;
      } else {
        p2EyebrowUp = ratio > p2Baseline + EYEBROW_RAISE_THRESHOLD;
        if (!p2EyebrowUp) {
          p2Baseline += (ratio - p2Baseline) * EYEBROW_ADAPT_RATE;
        }
      }
    }
  }

  // ─── Paddle Control ────────────────────────────────────────
  function updatePaddles(dt) {
    const minY = -FIELD_H / 2 + PADDLE_H / 2 + WALL_THICKNESS;
    const maxY = FIELD_H / 2 - PADDLE_H / 2 - WALL_THICKNESS;

    // Player 1 (left paddle)
    if (useKeyboardFallback) {
      // P1: W/S keys
      if (keysDown['KeyW']) {
        p1Paddle.position.y += PADDLE_SPEED * dt;
      } else if (keysDown['KeyS']) {
        p1Paddle.position.y -= PADDLE_SPEED * dt;
      } else {
        p1Paddle.position.y -= PADDLE_SPEED * 0.5 * dt;
      }
      // P2: Arrow keys
      if (keysDown['ArrowUp']) {
        p2Paddle.position.y += PADDLE_SPEED * dt;
      } else if (keysDown['ArrowDown']) {
        p2Paddle.position.y -= PADDLE_SPEED * dt;
      } else {
        p2Paddle.position.y -= PADDLE_SPEED * 0.5 * dt;
      }
    } else if (numFacesDetected >= 1) {
      // Face-controlled P1
      if (p1EyebrowUp) {
        p1Paddle.position.y += PADDLE_SPEED * dt;
      } else {
        p1Paddle.position.y -= PADDLE_SPEED * 0.5 * dt;
      }

      if (numFacesDetected >= 2) {
        // Face-controlled P2
        if (p2EyebrowUp) {
          p2Paddle.position.y += PADDLE_SPEED * dt;
        } else {
          p2Paddle.position.y -= PADDLE_SPEED * 0.5 * dt;
        }
      } else {
        // AI for P2
        aiUpdatePaddle(p2Paddle, dt);
      }
    } else {
      // No faces — both drift down
      p1Paddle.position.y -= PADDLE_SPEED * 0.3 * dt;
      p2Paddle.position.y -= PADDLE_SPEED * 0.3 * dt;
    }

    // Clamp
    p1Paddle.position.y = Math.max(minY, Math.min(maxY, p1Paddle.position.y));
    p2Paddle.position.y = Math.max(minY, Math.min(maxY, p2Paddle.position.y));

    // Update glow positions
    p1Glow.position.y = p1Paddle.position.y;
    p2Glow.position.y = p2Paddle.position.y;
  }

  function aiUpdatePaddle(paddle, dt) {
    const targetY = ball.position.y;
    const diff = targetY - paddle.position.y;

    if (Math.abs(diff) > AI_DEAD_ZONE) {
      const dir = Math.sign(diff);
      paddle.position.y += dir * AI_SPEED * dt;
    }
  }

  // ─── Collision Detection ───────────────────────────────────
  function ballPaddleCollision(paddleMesh) {
    const px = paddleMesh.position.x;
    const py = paddleMesh.position.y;
    const halfW = PADDLE_W / 2;
    const halfH = PADDLE_H / 2;
    const bx = ball.position.x;
    const by = ball.position.y;
    const halfBall = BALL_SIZE / 2;

    return (
      bx + halfBall > px - halfW &&
      bx - halfBall < px + halfW &&
      by + halfBall > py - halfH &&
      by - halfBall < py + halfH
    );
  }

  // ─── Physics Update ────────────────────────────────────────
  function updatePhysics(dt) {
    if (gameState !== 'PLAYING') return;

    dt = Math.min(dt, 0.033);

    const bx = ball.position.x + ballVel.x * dt;
    const by = ball.position.y + ballVel.y * dt;

    // Top/bottom wall collisions
    const topBound = FIELD_H / 2 - BALL_SIZE / 2;
    const bottomBound = -FIELD_H / 2 + BALL_SIZE / 2;

    if (by > topBound) {
      ball.position.y = topBound;
      ballVel.y = -Math.abs(ballVel.y);
    } else if (by < bottomBound) {
      ball.position.y = bottomBound;
      ballVel.y = Math.abs(ballVel.y);
    } else {
      ball.position.y = by;
    }

    ball.position.x = bx;

    // P1 paddle collision (left paddle, ball moving left)
    if (ballVel.x < 0 && ballPaddleCollision(p1Paddle)) {
      ball.position.x = p1PaddleX + PADDLE_W / 2 + BALL_SIZE / 2;
      const hitPos = (ball.position.y - p1Paddle.position.y) / (PADDLE_H / 2);
      const maxAngle = Math.PI * 0.35;
      const angle = hitPos * maxAngle;

      rallyCount++;
      ballSpeed = Math.min(BALL_SPEED_MAX, BALL_SPEED_INITIAL + rallyCount * BALL_SPEED_INCREMENT);

      ballVel.x = Math.cos(angle) * ballSpeed;
      ballVel.y = Math.sin(angle) * ballSpeed;

      spawnPaddleHit(p1PaddleX + PADDLE_W / 2, ball.position.y, P1_COLOR);
      screenShake = 0.08;
    }

    // P2 paddle collision (right paddle, ball moving right)
    if (ballVel.x > 0 && ballPaddleCollision(p2Paddle)) {
      ball.position.x = p2PaddleX - PADDLE_W / 2 - BALL_SIZE / 2;
      const hitPos = (ball.position.y - p2Paddle.position.y) / (PADDLE_H / 2);
      const maxAngle = Math.PI * 0.35;
      const angle = hitPos * maxAngle;

      rallyCount++;
      ballSpeed = Math.min(BALL_SPEED_MAX, BALL_SPEED_INITIAL + rallyCount * BALL_SPEED_INCREMENT);

      ballVel.x = -Math.cos(angle) * ballSpeed;
      ballVel.y = Math.sin(angle) * ballSpeed;

      spawnPaddleHit(p2PaddleX - PADDLE_W / 2, ball.position.y, P2_COLOR);
      screenShake = 0.08;
    }

    // Scoring: ball exits left/right
    if (ball.position.x < -FIELD_W / 2 - 2) {
      playerScored(2);
    } else if (ball.position.x > FIELD_W / 2 + 2) {
      playerScored(1);
    }
  }

  // ─── Score & Game State ────────────────────────────────────
  function updateScoreDisplay() {
    p1ScoreEl.textContent = p1Score;
    p2ScoreEl.textContent = p2Score;
  }

  function flashScore(el) {
    el.classList.remove('score-flash');
    void el.offsetWidth; // force reflow
    el.classList.add('score-flash');
  }

  function playerScored(player) {
    if (player === 1) {
      p1Score++;
      flashScore(p1ScoreEl);
      serveDirection = 1; // serve toward P2
      spawnScoreExplosion('right');
    } else {
      p2Score++;
      flashScore(p2ScoreEl);
      serveDirection = -1; // serve toward P1
      spawnScoreExplosion('left');
    }

    updateScoreDisplay();
    screenShake = 0.4;

    if (p1Score >= WIN_SCORE || p2Score >= WIN_SCORE) {
      endGame(p1Score >= WIN_SCORE ? 1 : 2);
    } else {
      gameState = 'SCORED';
      scorePauseTimer = SCORE_PAUSE;
      resetBallToCenter();
    }
  }

  function startGame() {
    gameState = 'PLAYING';
    p1Score = 0;
    p2Score = 0;
    ballSpeed = BALL_SPEED_INITIAL;
    rallyCount = 0;
    serveDirection = Math.random() < 0.5 ? 1 : -1;
    updateScoreDisplay();
    overlay.classList.add('hidden');
    gameOverEl.classList.remove('visible');
    p1Paddle.position.y = 0;
    p2Paddle.position.y = 0;
    resetBallToCenter();
    setTimeout(() => {
      if (gameState === 'PLAYING') serveBall();
    }, 500);
  }

  function endGame(winner) {
    gameState = 'GAME_OVER';
    const isAI = numFacesDetected < 2 && !useKeyboardFallback;
    let winnerLabel;
    if (isAI) {
      winnerLabel = winner === 1 ? 'You Win! \uD83C\uDF89' : 'AI Wins!';
    } else {
      winnerLabel = 'Player ' + winner + ' Wins! \uD83C\uDF89';
    }
    gameOverTitle.textContent = winnerLabel;
    gameOverTitle.className = winner === 1 ? 'p1-win' : 'p2-win';
    finalScoreEl.textContent = p1Score + ' \u2014 ' + p2Score;
    gameOverEl.classList.add('visible');
  }

  function resetGame() {
    particles.forEach(p => {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    particles.length = 0;
    startGame();
  }

  // ─── Input ─────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    keysDown[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (gameState === 'WAITING') startGame();
      else if (gameState === 'GAME_OVER') resetGame();
    }
  });

  document.addEventListener('keyup', (e) => {
    keysDown[e.code] = false;
  });

  function handleTapStart(e) {
    if (gameState === 'WAITING') {
      e.preventDefault();
      startGame();
    } else if (gameState === 'GAME_OVER') {
      e.preventDefault();
      resetGame();
    }
  }
  canvas.addEventListener('touchstart', handleTapStart, { passive: false });
  overlay.addEventListener('touchstart', handleTapStart, { passive: false });
  gameOverEl.addEventListener('touchstart', handleTapStart, { passive: false });
  canvas.addEventListener('click', handleTapStart);
  overlay.addEventListener('click', handleTapStart);
  gameOverEl.addEventListener('click', handleTapStart);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ─── Update Loop ───────────────────────────────────────────
  const clock = new THREE.Clock();

  function update() {
    requestAnimationFrame(update);

    const dt = clock.getDelta();

    // Smooth face tracking for parallax
    const targetX = numFacesDetected > 0 ? rawFaceX : 0;
    const targetY = numFacesDetected > 0 ? rawFaceY : 0;
    smoothFaceX += (targetX - smoothFaceX) * FACE_SMOOTH;
    smoothFaceY += (targetY - smoothFaceY) * FACE_SMOOTH;

    // Update paddles
    if (gameState === 'PLAYING' || gameState === 'SCORED' || gameState === 'WAITING') {
      updatePaddles(dt);
    }

    // Score pause → re-serve
    if (gameState === 'SCORED') {
      scorePauseTimer -= dt;
      if (scorePauseTimer <= 0) {
        gameState = 'PLAYING';
        serveBall();
      }
    }

    // Physics
    updatePhysics(dt);

    // Particles
    updateParticles(dt);

    // Camera parallax + shake
    const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    screenShake *= 0.9;
    if (screenShake < 0.001) screenShake = 0;

    camera.position.set(
      CAM_BASE.x + smoothFaceX * PARALLAX_X + shakeX,
      CAM_BASE.y + smoothFaceY * PARALLAX_Y + shakeY,
      CAM_BASE.z
    );
    camera.lookAt(
      CAM_LOOKAT.x + smoothFaceX * PARALLAX_X * 0.15,
      CAM_LOOKAT.y + smoothFaceY * PARALLAX_Y * 0.15,
      CAM_LOOKAT.z
    );

    // Paddle glow pulse
    const t = clock.elapsedTime;
    p1GlowMat.opacity = 0.08 + Math.sin(t * 3) * 0.04;
    p2GlowMat.opacity = 0.08 + Math.sin(t * 3 + 1) * 0.04;

    // Ball glow pulse
    ballGlowMat.opacity = 0.1 + Math.sin(t * 5) * 0.05;

    // Ball rotation (visual spin based on velocity)
    ball.rotation.x += ballVel.y * dt * 0.3;
    ball.rotation.y += ballVel.x * dt * 0.3;
    ball.rotation.z += (ballVel.x + ballVel.y) * dt * 0.1;

    // Ball trail
    const isMoving = ballVel.x !== 0 || ballVel.y !== 0;
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      trail[i].x = trail[i - 1].x;
      trail[i].y = trail[i - 1].y;
    }
    trail[0].x = ball.position.x;
    trail[0].y = ball.position.y;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      trail[i].mesh.position.set(trail[i].x, trail[i].y, 0);
      trail[i].mesh.visible = isMoving && gameState === 'PLAYING';
    }

    // Render
    renderer.render(scene, camera);
  }

  // ─── Init ──────────────────────────────────────────────────
  updateScoreDisplay();
  initFaceTracking();
  update();

})();
