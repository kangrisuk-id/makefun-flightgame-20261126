// Tidewater Airlift — missions: rings, birds, objectives and scoring.
// One file, one job: what a sortie asks of the pilot and what it pays.

import { SCORE, RING } from './config.js';
import { mulberry32, range } from './random.js';

export function createRun(mission) {
  return {
    mission,
    rings: mission.rings.map((r) => ({ ...r, collected: false })),
    birds: spawnBirds(mission),
    score: 0,
    elapsed: 0,
    landed: false,
    landingBonus: 0,
    timeBonus: 0,
    fuelBonus: 0,
    noDamageBonus: 0,
    breakdown: null,
  };
}

function spawnBirds(mission) {
  const rng = mulberry32(mission.seed ^ 0x51ab);
  const birds = [];
  for (let i = 0; i < mission.birds; i++) {
    birds.push({
      x: range(rng, 1200, 4400),
      y: range(rng, 70, 200),
      vx: range(rng, -14, -8),
      phase: range(rng, 0, Math.PI * 2),
      flap: range(rng, 6, 9),
      hit: false,
    });
  }
  return birds;
}

// Checks ring collection and bird strikes for one step. Returns events.
export function stepRun(run, plane, dt) {
  const events = [];
  run.elapsed += dt;
  for (const ring of run.rings) {
    if (ring.collected || ring.missed) continue;
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    if (Math.hypot(dx, dy) < RING.collectM) {
      ring.collected = true;
      run.score += SCORE.ring;
      events.push({ type: 'ring', ring, score: run.score });
    } else if (plane.x - ring.x > 120) {
      // Flown past: the ring is missed, and the pointer moves on.
      ring.missed = true;
      events.push({ type: 'ring-missed', ring });
    }
  }
  for (const bird of run.birds) {
    if (bird.hit) continue;
    bird.x += bird.vx * dt;
    bird.phase += dt * bird.flap;
    if (bird.x < 200) bird.x = 4400; // gulls circle back
    const dx = plane.x - bird.x;
    const dy = plane.y - bird.y;
    if (Math.hypot(dx, dy) < 11) {
      bird.hit = true;
      plane.damage = Math.min(100, plane.damage + 18);
      events.push({ type: 'bird-strike', damage: plane.damage });
    }
  }
  return events;
}

// Score breakdown at a successful landing.
export function scoreLanding(run, plane, sinkSpeed) {
  const soft = Math.max(0, SCORE.landingSoftMax - Math.max(0, sinkSpeed - 1) * 40);
  const timeBonus = Math.max(0, Math.round((run.mission.parTime - run.elapsed) * SCORE.timeBonusPerSecond));
  const fuelBonus = Math.round(plane.fuel * SCORE.fuelBonusPerUnit);
  const noDamageBonus = plane.damage <= 0 ? SCORE.noDamageBonus : 0;
  run.landingBonus = Math.round(soft);
  run.timeBonus = timeBonus;
  run.fuelBonus = fuelBonus;
  run.noDamageBonus = noDamageBonus;
  run.score += run.landingBonus + run.timeBonus + run.fuelBonus + run.noDamageBonus;
  const maxPossible = run.mission.rings.length * SCORE.ring + SCORE.landingSoftMax
    + run.mission.parTime * SCORE.timeBonusPerSecond + 100 * SCORE.fuelBonusPerUnit + SCORE.noDamageBonus;
  const ratio = run.score / maxPossible;
  const stars = ratio >= 0.8 ? 3 : ratio >= 0.55 ? 2 : 1;
  run.breakdown = {
    rings: run.rings.filter((r) => r.collected).length * SCORE.ring,
    landing: run.landingBonus,
    time: run.timeBonus,
    fuel: run.fuelBonus,
    noDamage: run.noDamageBonus,
    total: run.score,
    stars,
  };
  return run.breakdown;
}

export function drawBird(ctx, bird, cam, time) {
  const zoom = cam.zoom;
  const x0 = cam.x - 640 / zoom;
  const sx = (bird.x - x0) * zoom;
  const sy = cam.groundY - bird.y * zoom + Math.sin(bird.phase) * 4;
  if (sx < -30 || sx > 1310) return;
  const flap = Math.sin(bird.phase) * 0.9;
  ctx.strokeStyle = '#2c2c34';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(sx - 10, sy + flap * 4);
  ctx.quadraticCurveTo(sx - 3, sy - 3, sx, sy);
  ctx.quadraticCurveTo(sx + 3, sy - 3, sx + 10, sy + flap * 4);
  ctx.stroke();
}
