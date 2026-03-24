# GitHub Pong 3D 🏓

A 3D pong game themed after the GitHub contribution graph, with webcam eyebrow-tracking controls.

## Features

- **Eyebrow-Tracked Paddles** — Raise your eyebrows to move your paddle up; relax to drift down
- **2-Player Mode** — Two faces detected = two human players, each controlling their own paddle
- **AI Opponent** — If only one face is detected, an AI controls the opposing paddle
- **Contribution Square Ball** — The ball is a green GitHub contribution square
- **GitHub Aesthetic** — Dark theme with the iconic green contribution palette
- **Head-Coupled Parallax** — 3D camera adjusts based on your head position
- **Particle Effects** — Scoring triggers green cube fragment explosions
- **Keyboard Fallback** — If no camera, use W/S (P1) and ↑/↓ (P2)

## How to Play

1. Open `index.html` in a modern browser (Chrome/Edge recommended)
2. Allow camera access when prompted
3. Press **SPACE** to start
4. **Raise your eyebrows** to move your paddle up
5. **Relax your eyebrows** to let your paddle drift down
6. First to **5 points** wins!

## Controls

| Input | Action |
|-------|--------|
| Eyebrows raised | Paddle moves up |
| Eyebrows neutral | Paddle drifts down |
| `W` / `S` | Player 1 paddle (keyboard fallback) |
| `↑` / `↓` | Player 2 paddle (keyboard fallback) |
| `SPACE` / Tap | Start / Restart |

## Player Modes

- **2 Players** — Two faces in the webcam, each person's eyebrows control their paddle
- **1 Player + AI** — One face detected; you play against a computer opponent
- **Keyboard** — No camera available; W/S for P1, Arrow keys for P2

## Running Locally

Serve the directory with any static file server:

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

Then open http://localhost:8000

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) — 478-point face mesh with eyebrow tracking
- Vanilla HTML/CSS/JS — No build step required
