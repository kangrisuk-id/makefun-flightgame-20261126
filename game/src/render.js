// Tidewater Airlift — scene composition: sky, sun, clouds, mountains, sea,
// islands, rings, birds, the plane and the juice, in that order.
// One file, one job: turning the world state into one frame.

import { VIEW } from './config.js';
import { mulberry32, range, makeNoise1D } from './random.js';
import { drawSea, drawTerrain, drawHomeProps } from './terrain.js';
import { drawPlane } from './plane.js';
import { drawRing } from './hud.js';
import { drawBird } from './missions.js';
import { drawParticles, shakeOffset } from './particles.js';

export function makeScenery(mission) {
  const rng = mulberry32(mission.seed ^ 0x77aa);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    clouds.push({
      x: range(rng, 0, 5600), y: range(rng, 90, 280),
      s: range(rng, 0.7, 1.6), drift: range(rng, 1, 4),
    });
  }
  const ridge = makeNoise1D(mission.seed ^ 0x1234, 420, 55);
  return { clouds, ridge };
}

export function drawScene(ctx, game) {
  const palette = game.palette;
  const cam = game.cam;
  const time = game.time;
  const terrain = game.terrain;

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(0.55, palette.skyMid);
  sky.addColorStop(1, palette.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Sun with glow — kept clear of the HUD panels (left panel ends at x=226,
  // right panel starts at x=1054, compass ribbon spans x=440..840).
  const sunX = game.mission.id === 2 ? 950 : game.mission.id === 3 ? 950 : 250;
  const sunY = game.mission.id === 2 ? 90 : 115;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 190);
  glow.addColorStop(0, palette.sunGlow);
  glow.addColorStop(1, 'rgba(255, 180, 100, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // Clouds (parallax 0.3).
  drawClouds(ctx, game, palette);

  // Far mountain ridge (parallax 0.45) on the horizon.
  ctx.fillStyle = palette.farMountain;
  ctx.beginPath();
  ctx.moveTo(0, cam.groundY);
  for (let sx = 0; sx <= VIEW.width; sx += 16) {
    const wx = cam.x * 0.45 + sx / cam.zoom;
    const h = 34 + game.scenery.ridge(wx) + 20 * Math.sin(wx * 0.004);
    ctx.lineTo(sx, cam.groundY - Math.max(0, h) * 1.1);
  }
  ctx.lineTo(VIEW.width, cam.groundY);
  ctx.closePath();
  ctx.fill();

  // Sea, islands, runways, palms, home props. The title screen hides the
  // runway labels so they can't end up half-cut by the title panel.
  drawSea(ctx, cam, palette, time);
  drawTerrain(ctx, terrain, cam, palette, time, game.phase !== 'title');
  drawHomeProps(ctx, terrain, cam, palette, time);

  // Rings (missed ones stop drawing).
  for (const ring of game.run.rings) {
    if (!ring.collected && !ring.missed) drawRing(ctx, ring, cam, time);
  }

  // Birds.
  for (const bird of game.run.birds) {
    if (!bird.hit) drawBird(ctx, bird, cam, time);
  }

  // The plane.
  const shake = shakeOffset(game.particles, time);
  const px = (game.plane.x - (cam.x - 640 / cam.zoom)) * cam.zoom + shake.x;
  const py = cam.groundY - game.plane.y * cam.zoom + shake.y;
  drawPlane(ctx, px, py, game.plane.angle, game.plane.throttle, time, { crashed: game.phase === 'crashed' });

  // Particles and floating text.
  drawParticles(ctx, game.particles, cam);
}

function drawClouds(ctx, game, palette) {
  const cam = game.cam;
  for (const c of game.scenery.clouds) {
    const driftX = c.x + game.time * c.drift;
    const sx = (((driftX - cam.x * 0.3) % 6400) + 6400) % 6400 - 400;
    if (sx < -260 || sx > VIEW.width + 260) continue;
    const sy = 60 + (c.y - cam.y * 0.25) * 0.9;
    const s = c.s * 46;
    ctx.fillStyle = palette.cloud;
    ctx.beginPath();
    ctx.ellipse(sx, sy, s, s * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - s * 0.55, sy + 6, s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + s * 0.55, sy + 6, s * 0.66, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Camera: follows the plane with look-ahead and zooms out as the plane climbs,
// so the sea (and the runway below) stays in frame at every altitude.
export function updateCamera(game, dt) {
  const p = game.plane;
  const lookAhead = p.speed * 2;
  const targetX = p.x + lookAhead * 0.9;
  const targetY = p.y * 0.5;
  const targetZoom = Math.max(1.6, Math.min(3.0, 680 / (p.y + 60)));
  game.cam.x += (targetX - game.cam.x) * Math.min(1, dt * 3.2);
  game.cam.y += (targetY - game.cam.y) * Math.min(1, dt * 2.2);
  game.cam.zoom += (targetZoom - game.cam.zoom) * Math.min(1, dt * 1.8);
  game.cam.groundY = VIEW.height / 2 + game.cam.y * game.cam.zoom;
  // Keep the camera from showing the void past the world's ends.
  game.cam.x = Math.max(640 / game.cam.zoom - 40, Math.min(5300 - 640 / game.cam.zoom + 40, game.cam.x));
}
