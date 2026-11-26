// Tidewater Airlift — procedural archipelago: islands, sea, runways, palms.
// One file, one job: the world the plane flies over. The height function is
// pure (no canvas), so the physics and the renderer share one truth.

import { mulberry32, range, clamp } from './random.js';
import { RUNWAY, VIEW } from './config.js';

const WORLD_END = 5300;

// Island bumps: centre x, half-width, peak height (metres above the sea).
function islandProfile(seed) {
  const rng = mulberry32(seed ^ 0x5f3759df);
  const bumps = [
    { cx: 450, w: 520, h: 26 },
    { cx: 1450, w: 260, h: 64 },
    { cx: 2100, w: 340, h: 96 },
    { cx: 2850, w: 240, h: 52 },
    { cx: 3600, w: 300, h: 78 },
    { cx: 4650, w: 540, h: 30 },
  ];
  // Small seeded jitter so each mission's islands read differently.
  for (const b of bumps) b.h *= 0.85 + rng() * 0.3;
  return bumps;
}

export function makeTerrain(mission) {
  const bumps = islandProfile(mission.seed);
  const home = { x0: RUNWAY.homeX - RUNWAY.lengthM / 2, x1: RUNWAY.homeX + RUNWAY.lengthM / 2, y: 14 };
  const dest = { x0: RUNWAY.destX - RUNWAY.lengthM / 2, x1: RUNWAY.destX + RUNWAY.lengthM / 2, y: 16 };

  function rawHeight(x) {
    let h = 0;
    for (const b of bumps) {
      const d = (x - b.cx) / b.w;
      h += b.h * Math.exp(-d * d);
    }
    return h;
  }

  // Flatten the two runway strips into the island tops, with a smooth blend.
  function heightAt(x) {
    let h = rawHeight(x);
    for (const r of [home, dest]) {
      const blend = 60;
      const d = Math.max(r.x0 - x, 0, x - r.x1);
      if (d < blend) {
        const t = d / blend;
        const s = t * t * (3 - 2 * t);
        h = r.y + (h - r.y) * s;
      }
    }
    return Math.max(0, h);
  }

  function runwayAt(x) {
    if (x >= home.x0 && x <= home.x1) return home;
    if (x >= dest.x0 && x <= dest.x1) return dest;
    return null;
  }

  // Palm trees on the islands, seeded per mission.
  const rng = mulberry32(mission.seed ^ 0x9e3779b9);
  const palms = [];
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 80, WORLD_END - 80);
    const h = heightAt(x);
    if (h > 6 && !runwayAt(x)) palms.push({ x, h, lean: range(rng, -0.25, 0.25), s: range(rng, 0.8, 1.3) });
  }

  return { heightAt, runwayAt, home, dest, palms, worldEnd: WORLD_END };
}

// ---- Drawing (canvas, screen space) ---------------------------------------

export function drawSea(ctx, cam, palette, time) {
  const seaY = cam.groundY;
  const grad = ctx.createLinearGradient(0, seaY, 0, VIEW.height);
  grad.addColorStop(0, palette.sea);
  grad.addColorStop(1, palette.seaDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, seaY, VIEW.width, VIEW.height - seaY);
  // Sun glitter: short horizontal strokes that drift with the waves.
  ctx.strokeStyle = palette.seaGlitter;
  ctx.lineWidth = 2;
  const spacing = 46;
  const offset = (time * 12) % spacing;
  for (let x = -spacing + offset; x < VIEW.width; x += spacing) {
    const y = seaY + 26 + ((x * 7) % 90);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 26, y);
    ctx.stroke();
  }
  // Wave lines near the shore.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const y = seaY + 8 + i * 9 + Math.sin(time * 1.4 + i * 2) * 2;
    ctx.beginPath();
    for (let x = 0; x <= VIEW.width; x += 16) {
      const yy = y + Math.sin(x * 0.02 + time * 1.8 + i) * 2.5;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

export function drawTerrain(ctx, terrain, cam, palette, time, showLabels = true) {
  const zoom = cam.zoom;
  const x0 = cam.x - VIEW.width / 2 / zoom;
  const x1 = cam.x + VIEW.width / 2 / zoom;
  const groundY = cam.groundY;

  // Island bodies.
  ctx.beginPath();
  ctx.moveTo(0, VIEW.height);
  for (let sx = 0; sx <= VIEW.width; sx += 8) {
    const wx = x0 + sx / zoom;
    const h = terrain.heightAt(wx);
    ctx.lineTo(sx, groundY - h * zoom);
  }
  ctx.lineTo(VIEW.width, VIEW.height);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, groundY - 110 * zoom, 0, groundY);
  grad.addColorStop(0, palette.grass);
  grad.addColorStop(1, palette.grassDark);
  ctx.fillStyle = grad;
  ctx.fill();

  // Sand fringe where the island meets the sea.
  ctx.strokeStyle = palette.sand;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let sx = 0; sx <= VIEW.width; sx += 8) {
    const wx = x0 + sx / zoom;
    const h = terrain.heightAt(wx);
    const y = groundY - Math.min(h, 5) * zoom;
    if (sx === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
  }
  ctx.stroke();

  // Grass tufts break up the flat green on the island tops.
  ctx.strokeStyle = palette.grassDark;
  ctx.lineWidth = 2;
  for (let sx = 12; sx < VIEW.width; sx += 34) {
    const wx = x0 + sx / zoom;
    const h = terrain.heightAt(wx);
    if (h < 4 || terrain.runwayAt(wx)) continue;
    const y = groundY - h * zoom;
    ctx.beginPath();
    ctx.moveTo(sx - 4, y);
    ctx.lineTo(sx - 6, y - 7);
    ctx.moveTo(sx, y);
    ctx.lineTo(sx, y - 9);
    ctx.moveTo(sx + 4, y);
    ctx.lineTo(sx + 6, y - 7);
    ctx.stroke();
  }

  drawRunway(ctx, terrain, cam, palette, time, terrain.home, showLabels ? 'CORAL BAY' : '');
  drawRunway(ctx, terrain, cam, palette, time, terrain.dest, showLabels ? 'DESTINATION' : '');
  drawPalms(ctx, terrain, cam, palette);
}

function drawRunway(ctx, terrain, cam, palette, time, r, label) {
  const zoom = cam.zoom;
  const x0 = cam.x - VIEW.width / 2 / zoom;
  const sx0 = (r.x0 - x0) * zoom;
  const sx1 = (r.x1 - x0) * zoom;
  if (sx1 < -50 || sx0 > VIEW.width + 50) return;
  const y = cam.groundY - r.y * zoom;
  const h = Math.max(10, 7 * zoom * 0.55);
  // Asphalt strip.
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(sx0, y - h, sx1 - sx0, h);
  // Centreline dashes.
  ctx.fillStyle = '#f5f2e8';
  const dash = 26, gap = 20;
  for (let x = sx0 + 14; x < sx1 - 14; x += dash + gap) {
    ctx.fillRect(x, y - h / 2 - 1.5, dash, 3);
  }
  // Threshold bars.
  ctx.fillRect(sx0 + 6, y - h + 2, 10, h - 4);
  ctx.fillRect(sx1 - 16, y - h + 2, 10, h - 4);
  // Edge lights (glow at dusk, plain by day).
  const blink = 0.6 + 0.4 * Math.sin(time * 3);
  for (let x = sx0 + 10; x < sx1; x += 60) {
    ctx.fillStyle = palette.name === 'Dusk' ? `rgba(255, 200, 90, ${blink})` : 'rgba(255, 220, 130, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y - h - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Label at the runway's left end, clear of a plane parked mid-strip.
  if (label) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(label, sx0 + 14, y - h - 12);
  }
}

function drawPalms(ctx, terrain, cam, palette) {
  const zoom = cam.zoom;
  const x0 = cam.x - VIEW.width / 2 / zoom;
  for (const p of terrain.palms) {
    const sx = (p.x - x0) * zoom;
    if (sx < -30 || sx > VIEW.width + 30) continue;
    const sy = cam.groundY - p.h * zoom;
    const s = p.s * zoom * 0.9;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.lean);
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 3 * s / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2 * s, -14 * s, 0, -24 * s);
    ctx.stroke();
    ctx.strokeStyle = palette.grassDark;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -24 * s);
      ctx.quadraticCurveTo(Math.cos(a) * 14 * s, -24 * s + Math.sin(a) * 10 * s - 4 * s, Math.cos(a) * 20 * s, -24 * s + Math.sin(a) * 16 * s + 4 * s);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Home-strip props: hangar, windsock, fuel drums — drawn near the home runway.
export function drawHomeProps(ctx, terrain, cam, palette, time) {
  const zoom = cam.zoom;
  const x0 = cam.x - VIEW.width / 2 / zoom;
  const hx = terrain.home.x0 - 90;
  const sx = (hx - x0) * zoom;
  if (sx < -160 || sx > VIEW.width + 160) return;
  const y = cam.groundY - terrain.home.y * zoom;
  // Hangar.
  ctx.fillStyle = '#c65b3c';
  ctx.beginPath();
  ctx.moveTo(sx - 55, y);
  ctx.lineTo(sx - 55, y - 34);
  ctx.quadraticCurveTo(sx, y - 58, sx + 55, y - 34);
  ctx.lineTo(sx + 55, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a3a26';
  ctx.fillRect(sx - 30, y - 22, 60, 22);
  ctx.fillStyle = '#f5f2e8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TIDEWATER', sx, y - 40);
  // Windsock on a pole, pointing with the wind.
  const wx = sx + 90;
  ctx.strokeStyle = '#e8e2d2';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wx, y);
  ctx.lineTo(wx, y - 52);
  ctx.stroke();
  const flap = Math.sin(time * 2.2) * 4;
  ctx.fillStyle = '#ff7a3c';
  ctx.beginPath();
  ctx.moveTo(wx, y - 52);
  ctx.lineTo(wx + 30, y - 46 + flap);
  ctx.lineTo(wx, y - 40);
  ctx.closePath();
  ctx.fill();
}
