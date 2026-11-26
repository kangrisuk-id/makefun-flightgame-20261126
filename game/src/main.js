// Tidewater Airlift — the game itself: loop, screens, missions, poses, self-test.
// One file, one job: everything that turns the modules into a playable game.
//
// Screens: title -> briefing -> fly -> landed (score) / crashed -> next mission
// or campaign complete. Query params for makers and tests:
//   ?shot=start|play|landing|end   pose the game for a screenshot
//   ?test=1                        autopilot flies mission 1, reports to #test-result

import { VIEW, MISSIONS, PALETTES, STORAGE_KEY, PLANE } from './config.js';
import { makeTerrain } from './terrain.js';
import { createPlane, stepPlane } from './plane.js';
import { createInput } from './input.js';
import { drawHud } from './hud.js';
import { createRun, stepRun, scoreLanding } from './missions.js';
import { createAudio } from './audio.js';
import { createParticles, spawn, floatText, shake, stepParticles } from './particles.js';
import { makeScenery, drawScene, updateCamera } from './render.js';
import { clamp } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const TEST = params.get('test') === '1';
// Posed screenshots are of the game alone: no page caption below the canvas.
if (SHOT) {
  const hint = document.querySelector('.hint');
  if (hint) hint.style.display = 'none';
}

const game = {
  canvas, ctx,
  missionIndex: 0,
  mission: MISSIONS[0],
  terrain: null, plane: null, run: null, scenery: null, palette: PALETTES.dawn,
  cam: { x: 450, y: 0, zoom: 3, groundY: 360 },
  particles: createParticles(),
  input: createInput(canvas),
  audio: createAudio(),
  phase: 'title', // title | briefing | fly | landed | crashed | campaign
  paused: false,
  time: 0,
  crashTimer: 0,
  totalScore: 0,
  best: loadBest(),
  testDone: false,
  testLog: [],
};

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (e) { return {}; }
}
function saveBest() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game.best)); } catch (e) {}
}

function startMission(index) {
  game.missionIndex = index;
  game.mission = MISSIONS[index];
  game.palette = PALETTES[game.mission.palette];
  game.terrain = makeTerrain(game.mission);
  game.plane = createPlane(game.terrain);
  game.run = createRun(game.mission);
  game.scenery = makeScenery(game.mission);
  game.particles = createParticles();
  game.cam = { x: 450, y: 0, zoom: 3, groundY: 360 };
  game.time = 0;
  game.phase = 'briefing';
}

function startCampaign() {
  game.totalScore = 0;
  startMission(0);
}

function applyShotPose() {
  if (!SHOT) return;
  startMission(0);
  const p = game.plane;
  if (SHOT === 'start') {
    game.phase = 'title';
    game.time = 8;
    // Wide shot: the parked plane reads to the right of the title panel.
    game.cam = { x: 180, y: 0, zoom: 1.6, groundY: 360 };
    return;
  }
  if (SHOT === 'play') {
    game.phase = 'fly';
    p.x = 2250; p.y = 130; p.speed = 42; p.throttle = 0.72; p.angle = 0.04;
    p.fuel = 78; p.onGround = false;
    game.run.rings[0].collected = true;
    game.run.score = 100;
    game.cam.x = p.x + 40;
    game.time = 14;
    return;
  }
  if (SHOT === 'landing') {
    game.phase = 'fly';
    p.x = 4300; p.y = 50; p.speed = 34; p.throttle = 0.35; p.angle = -0.08;
    p.fuel = 41; p.onGround = false;
    game.run.rings.forEach((r) => { r.collected = true; });
    game.run.score = 300;
    game.cam.x = p.x + 40;
    game.time = 22;
    return;
  }
  if (SHOT === 'end') {
    game.phase = 'landed';
    game.run.rings.forEach((r) => { r.collected = true; });
    game.run.elapsed = 96;
    game.run.score = 986;
    game.run.breakdown = { rings: 300, landing: 260, time: 180, fuel: 96, noDamage: 150, total: 986, stars: 3 };
    p.x = 4650; p.y = 17.2; p.speed = 0; p.throttle = 0; p.fuel = 48; p.onGround = true;
    game.cam.x = p.x - 100; // park the plane right of the score panel
    game.time = 30;
  }
}

// ---- Autopilot (self-test only) --------------------------------------------

function autopilot() {
  const p = game.plane;
  const run = game.run;
  const next = run.rings.find((r) => !r.collected && !r.missed);
  let tx, ty, targetSpeed = 42;
  if (next) { tx = next.x; ty = next.y; }
  else if (p.x < game.terrain.dest.x0) {
    // Glideslope to the destination strip: 6% descent to the threshold.
    const destX = game.terrain.dest.x0;
    tx = destX + 210;
    ty = game.terrain.dest.y + 8 + (destX - p.x) * 0.06;
    targetSpeed = 34;
  } else {
    // Over the numbers: aim a touch below the strip so she actually
    // touches down instead of skimming along above it.
    tx = game.terrain.dest.x0 + 210;
    ty = game.terrain.dest.y + 0.5;
    targetSpeed = 28;
  }
  const desiredPitch = clamp((ty - p.y) / 45, -0.7, 0.7);
  const pitch = clamp((desiredPitch - p.angle) * 2.2, -1, 1);
  // The throttle input is a lever rate, so drive it toward a target setting.
  const targetThrottle = p.speed < targetSpeed ? 0.85 : (p.speed > targetSpeed + 6 ? 0.3 : 0.55);
  const throttle = clamp((targetThrottle - p.throttle) * 3, -1, 1);
  const brake = p.onGround && !next;
  return { pitch, throttle, brake };
}

// ---- Flight events -----------------------------------------------------------

function handleFlightEvents(events) {
  for (const e of events) {
    if (e.type === 'takeoff') {
      floatText(game.particles, game.plane.x, game.plane.y + 30, 'AIRBORNE!', '#7ee787');
    } else if (e.type === 'landed') {
      game.plane.throttle = 0;
      const breakdown = scoreLanding(game.run, game.plane, e.sinkSpeed);
      game.totalScore += game.run.score;
      const key = 'mission' + game.mission.id;
      if (!game.best[key] || game.run.score > game.best[key]) {
        game.best[key] = game.run.score;
        saveBest();
      }
      game.audio.fanfare();
      game.audio.thud();
      spawn(game.particles, 'dust', game.plane.x, game.plane.y, { count: 24, speed: 26, life: 0.9, color: '#d9c9a3' });
      game.phase = 'landed';
      game.testLog.push('landed score=' + game.run.score + ' stars=' + breakdown.stars);
    } else if (e.type === 'hard-landing') {
      game.audio.thud();
      shake(game.particles, 0.5);
      spawn(game.particles, 'dust', game.plane.x, game.plane.y, { count: 18, speed: 22, life: 0.8, color: '#cbb98d' });
      floatText(game.particles, game.plane.x, game.plane.y + 30, 'HARD LANDING', '#ffb347');
    } else if (e.type === 'crash') {
      game.audio.crash();
      shake(game.particles, 1);
      spawn(game.particles, 'fire', game.plane.x, game.plane.y + 4, { count: 40, speed: 60, life: 1.1, color: '#ff7a3c' });
      spawn(game.particles, 'smoke', game.plane.x, game.plane.y + 10, { count: 30, speed: 18, life: 2.2, color: '#5a5a60' });
      game.crashTimer = 1.3;
      game.phase = 'crashing';
      game.testLog.push('crash: ' + e.cause);
    } else if (e.type === 'stall') {
      floatText(game.particles, game.plane.x, game.plane.y + 34, 'STALL!', '#ff6b5e');
    } else if (e.type === 'fuel-empty') {
      floatText(game.particles, game.plane.x, game.plane.y + 34, 'FUEL EMPTY', '#ff6b5e');
    }
  }
}

function handleRunEvents(events) {
  for (const e of events) {
    if (e.type === 'ring') {
      game.audio.ring();
      spawn(game.particles, 'sparkle', e.ring.x, e.ring.y, { count: 18, speed: 34, life: 0.9, color: '#ffd76a' });
      floatText(game.particles, e.ring.x, e.ring.y + 36, '+100', '#ffd76a');
      game.testLog.push('ring ' + game.run.rings.filter((r) => r.collected).length + '/' + game.run.rings.length);
    } else if (e.type === 'ring-missed') {
      floatText(game.particles, e.ring.x, e.ring.y + 36, 'MISSED RING', 'rgba(255,255,255,0.7)');
    } else if (e.type === 'bird-strike') {
      game.audio.thud();
      shake(game.particles, 0.45);
      spawn(game.particles, 'feather', game.plane.x + 20, game.plane.y, { count: 12, speed: 24, life: 1.4, color: '#f5f2e8', gravity: 30 });
      floatText(game.particles, game.plane.x, game.plane.y + 34, 'BIRD STRIKE!', '#ff6b5e');
      if (game.plane.damage >= PLANE.maxDamage) {
        game.audio.crash();
        shake(game.particles, 1);
        game.crashTimer = 1.3;
        game.phase = 'crashing';
        game.testLog.push('crash: bird damage');
      }
    }
  }
}

// ---- Update ------------------------------------------------------------------

function update(dt) {
  game.time += dt;
  stepParticles(game.particles, dt);

  if (game.phase === 'crashing') {
    game.crashTimer -= dt;
    if (game.crashTimer <= 0) game.phase = 'crashed';
    return;
  }
  if (game.phase !== 'fly') return;

  const input = TEST ? autopilot() : game.input.read(planeScreenY());
  const steps = TEST ? 6 : 1;
  for (let i = 0; i < steps; i++) {
    const fe = stepPlane(game.plane, input, dt, {
      terrain: game.terrain,
      wind: game.mission.wind,
      gust: game.mission.gust,
      time: game.time,
      worldEnd: game.terrain.worldEnd,
    });
    handleFlightEvents(fe);
    if (game.phase !== 'fly') break;
    const re = stepRun(game.run, game.plane, dt);
    handleRunEvents(re);
    if (game.phase !== 'fly') break;
  }
  // Engine trail.
  if (game.plane.speed > 30 && Math.random() < 0.5) {
    spawn(game.particles, 'trail', game.plane.x - 46, game.plane.y, { count: 1, speed: 4, life: 0.7, color: 'rgba(255,255,255,0.7)', size: 2 });
  }
  updateCamera(game, dt);
  game.audio.update(game.plane.throttle, game.plane.speed, game.phase === 'fly' && !game.plane.onGround);
}

function planeScreenY() {
  return VIEW.height / 2 - (game.plane.y - game.cam.y) * game.cam.zoom;
}

// ---- Screens (overlays) ------------------------------------------------------

function overlayPanel(x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 14, 26, 0.78)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
}

function title(text, x, y, size, color, align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function drawTitle() {
  overlayPanel(290, 96, 700, 470);
  title('TIDEWATER', 640, 178, 64, '#ffd76a');
  title('AIRLIFT', 640, 238, 64, '#ffffff');
  title('A bush-plane courier over the golden-hour archipelago', 640, 272, 16, 'rgba(255,255,255,0.8)');
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.roundRect(520, 292, 240, 6, 3); ctx.fill();
  const items = [
    ['ENTER', 'Start campaign — 3 missions, dawn to dusk'],
    ['H', 'How to fly'],
    ['M', 'Sound on / off'],
  ];
  items.forEach(([key, text], i) => {
    const y = 340 + i * 34;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.roundRect(360, y - 18, 64, 24, 5); ctx.fill();
    ctx.fillStyle = '#0a101c';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(key, 392, y - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, 440, y - 1);
  });
  // Best scores.
  const bests = MISSIONS.map((m) => {
    const b = game.best['mission' + m.id];
    return m.name + ': ' + (b ? b + ' pts' : '—');
  }).join('   ·   ');
  title(bests, 640, 470, 13, 'rgba(255,255,255,0.65)');
  title('Fly the rings. Mind the fuel. Grease the landing.', 640, 500, 13, 'rgba(255,255,255,0.65)');
  if (game.showHelp) drawHelp();
}

function drawHelp() {
  overlayPanel(340, 150, 600, 380);
  title('HOW TO FLY', 640, 196, 26, '#ffd76a');
  const lines = [
    ['↑ / W  ·  ↓ / S', 'Pitch nose up / down'],
    ['→ / D  ·  ← / A', 'Throttle up / down'],
    ['SPACE', 'Airbrake — short finals'],
    ['MOUSE', 'Hold and point: steer toward the pointer'],
    ['P', 'Pause     ·     R  Restart mission     ·     M  Mute'],
    ['', ''],
    ['Rings pay 100 points each. Land softly for up to 300 more,'],
    ['plus time, fuel and no-damage bonuses. Watch the stall'],
    ['warning: below 17 m/s the wing stops flying.'],
  ];
  lines.forEach(([k, v], i) => {
    const y = 236 + i * 30;
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(k, 380, y);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(v, 560, y);
  });
  title('Press H to close', 640, 496, 13, 'rgba(255,255,255,0.6)');
}

function drawBriefing() {
  const m = game.mission;
  overlayPanel(330, 150, 620, 380);
  title('MISSION ' + m.id + ' — ' + m.name.toUpperCase(), 640, 200, 30, '#ffd76a');
  title(m.subtitle, 640, 232, 15, 'rgba(255,255,255,0.85)');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '15px/1.5 system-ui, sans-serif';
  ctx.textAlign = 'center';
  wrapText(m.briefing, 640, 268, 540, 24);
  const facts = [
    'Rings: ' + m.rings.length,
    'Wind: ' + Math.abs(m.wind) + ' m/s headwind',
    'Birds: ' + (m.birds || 'none'),
    'Par time: ' + m.parTime + ' s',
  ];
  title(facts.join('   ·   '), 640, 400, 14, '#7ee787');
  title('Press ENTER to take off', 640, 478, 16, '#ffd76a');
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

function drawLanded() {
  const b = game.run.breakdown;
  overlayPanel(390, 130, 500, 440);
  title('MISSION COMPLETE', 640, 182, 30, '#7ee787');
  title(game.mission.name + ' — ' + '★'.repeat(b.stars) + '☆'.repeat(3 - b.stars), 640, 216, 17, '#ffd76a');
  const rows = [
    ['Rings', b.rings], ['Soft landing', b.landing], ['Time bonus', b.time],
    ['Fuel bonus', b.fuel], ['No-damage bonus', b.noDamage],
  ];
  rows.forEach(([k, v], i) => {
    const y = 268 + i * 32;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(k, 440, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(v), 840, y);
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.moveTo(440, 440); ctx.lineTo(840, 440); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL', 440, 472);
  ctx.textAlign = 'right';
  ctx.fillText(String(b.total), 840, 472);
  const next = game.missionIndex < MISSIONS.length - 1
    ? 'Press ENTER — next mission: ' + MISSIONS[game.missionIndex + 1].name
    : 'Press ENTER — campaign complete';
  title(next, 640, 524, 15, '#ffd76a');
}

function drawCrashed() {
  overlayPanel(390, 200, 500, 260);
  title('MAYDAY — DOWN', 640, 256, 34, '#ff6b5e');
  title('The airframe is a write-off. The pilot walked away.', 640, 296, 15, 'rgba(255,255,255,0.85)');
  title('Score kept: ' + game.run.score + ' pts  ·  Rings: ' + game.run.rings.filter((r) => r.collected).length + '/' + game.run.rings.length, 640, 336, 15, 'rgba(255,255,255,0.75)');
  title('Press R to fly it again', 640, 400, 16, '#ffd76a');
}

function drawCampaign() {
  overlayPanel(330, 150, 620, 360);
  title('CAMPAIGN COMPLETE', 640, 208, 32, '#ffd76a');
  title('Three islands, three landings, one very tired pilot.', 640, 244, 15, 'rgba(255,255,255,0.85)');
  title('Total score: ' + game.totalScore + ' pts', 640, 300, 24, '#ffffff');
  const best = game.best.campaign || 0;
  if (game.totalScore > best) {
    game.best.campaign = game.totalScore;
    saveBest();
    title('★ New best campaign score! ★', 640, 340, 16, '#7ee787');
  } else {
    title('Best campaign: ' + best + ' pts', 640, 340, 15, 'rgba(255,255,255,0.7)');
  }
  title('Press ENTER to fly the campaign again', 640, 440, 15, '#ffd76a');
}

// ---- Render ------------------------------------------------------------------

function render() {
  drawScene(ctx, game);
  if (game.phase === 'fly' || game.phase === 'landed' || game.phase === 'crashing' || game.phase === 'crashed') {
    drawHud(ctx, game, game.palette);
  }
  if (game.phase === 'title') drawTitle();
  if (game.phase === 'briefing') drawBriefing();
  if (game.phase === 'landed') drawLanded();
  if (game.phase === 'crashed') drawCrashed();
  if (game.phase === 'campaign') drawCampaign();
  if (game.paused && game.phase === 'fly') {
    ctx.fillStyle = 'rgba(8, 14, 26, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    title('PAUSED — press P to resume', 640, 360, 28, '#ffffff');
  }
}

// ---- Keys ----------------------------------------------------------------------

function handleKeys() {
  const input = game.input;
  if (input.wasPressed('Enter')) {
    game.audio.unlock();
    game.audio.click();
    if (game.phase === 'title') { if (!game.showHelp) startCampaign(); }
    else if (game.phase === 'briefing') game.phase = 'fly';
    else if (game.phase === 'landed') {
      if (game.missionIndex < MISSIONS.length - 1) startMission(game.missionIndex + 1);
      else game.phase = 'campaign';
    } else if (game.phase === 'campaign') startCampaign();
    else if (game.phase === 'crashed') startMission(game.missionIndex);
  }
  if (input.wasPressed('KeyR') && (game.phase === 'crashed' || game.phase === 'fly')) {
    startMission(game.missionIndex);
    game.phase = 'fly';
  }
  if (input.wasPressed('KeyP') && game.phase === 'fly') game.paused = !game.paused;
  if (input.wasPressed('KeyM')) game.audio.setMuted(!game.audio.muted);
  if (input.wasPressed('KeyH') && game.phase === 'title') game.showHelp = !game.showHelp;
  if (input.wasPressed('Escape') && game.showHelp) game.showHelp = false;
  input.consumePressed();
}

// ---- Main loop -------------------------------------------------------------------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  handleKeys();
  if (!game.paused) update(dt);
  render();

  // Self-test verdict.
  if (TEST && !game.testDone) {
    const simTime = game.run ? game.run.elapsed : 0;
    if (game.phase === 'landed') {
      finishTest('PASS landed score=' + game.run.score + ' rings=' + game.run.rings.filter((r) => r.collected).length + '/' + game.run.rings.length + ' time=' + Math.round(simTime) + 's fuel=' + Math.round(game.plane.fuel));
    } else if (game.phase === 'crashed') {
      finishTest('FAIL crashed (' + game.testLog.slice(-1)[0] + ') time=' + Math.round(simTime) + 's');
    } else if (simTime > 220) {
      finishTest('FAIL timeout: still flying after 220s sim, x=' + Math.round(game.plane.x) + ' y=' + Math.round(game.plane.y) + ' log=' + game.testLog.join(';'));
    }
  }
  requestAnimationFrame(frame);
}

function finishTest(result) {
  game.testDone = true;
  const el = document.getElementById('test-result');
  if (el) el.innerText = result;
  document.title = result;
  console.log('SELF-TEST ' + result);
}

// ---- Boot ------------------------------------------------------------------------

startMission(0);
game.phase = 'title';
if (SHOT) applyShotPose();
if (TEST) {
  startMission(0);
  game.phase = 'fly';
  game.plane.throttle = 0;
}
requestAnimationFrame(frame);
