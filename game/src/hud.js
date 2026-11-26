// Tidewater Airlift — the glass-cockpit HUD: instruments, tapes, compass, fuel.
// One file, one job: everything the pilot reads, drawn in screen space over
// the world. Instruments are lit (amber/green) so they read in screenshots.

import { PLANE, RING } from './config.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 16, 28, 0.62)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, color, size = 11) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function bigNumber(ctx, text, x, y, color, size = 30) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "SF Mono", "Cascadia Mono", Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

// Vertical tape: current value in the middle, tick marks scrolling past.
function tape(ctx, x, y, h, value, step, unit, color, format) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, 64, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(10, 16, 28, 0.5)';
  ctx.fillRect(x, y, 64, h);
  const mid = y + h / 2;
  const pxPerUnit = h / (step * 6);
  const base = Math.floor(value / step) * step;
  for (let v = base - step * 3; v <= base + step * 3; v += step) {
    const yy = mid - (v - value) * pxPerUnit;
    if (yy < y || yy > y + h) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 44, yy);
    ctx.lineTo(x + 64, yy);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px "SF Mono", Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(v), x + 40, yy + 4);
  }
  ctx.restore();
  // Current value box.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - 6, mid - 13, 76, 26, 4);
  ctx.fill();
  ctx.fillStyle = '#0a101c';
  ctx.font = 'bold 15px "SF Mono", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(format(value), x + 32, mid + 5);
  label(ctx, unit, x + 2, y - 6, 'rgba(255,255,255,0.7)', 10);
}

export function drawHud(ctx, game, palette) {
  const p = game.plane;
  const run = game.run;
  const hud = palette.hud;
  const speedKts = Math.round(p.speed * 1.944);
  const altFt = Math.max(0, Math.round(p.y * 3.281));

  // --- Left: airspeed + altitude tapes -------------------------------------
  panel(ctx, 16, 16, 210, 150);
  label(ctx, 'TIDEWATER AIRLIFT', 28, 32, hud, 11);
  tape(ctx, 28, 54, 92, speedKts, 10, 'AIRSPEED · KT', hud, (v) => String(Math.max(0, Math.round(v))));
  tape(ctx, 148, 54, 92, altFt, 100, 'ALTITUDE · FT', hud, (v) => String(Math.max(0, Math.round(v))));
  // Vertical speed arrow.
  const vs = Math.round(p.vy * 3.281);
  ctx.fillStyle = vs > 30 ? '#7ee787' : vs < -30 ? '#ff9d6b' : 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText((vs >= 0 ? '▲ +' : '▼ ') + Math.abs(vs) + ' fpm', 28, 160);

  // --- Centre: compass ribbon ----------------------------------------------
  panel(ctx, 440, 16, 400, 52);
  const heading = 90; // the route flies due east
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 15px "SF Mono", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HDG ' + String(heading).padStart(3, '0') + '°', 640, 35);
  // Tick ribbon: destination bearing marker.
  ctx.fillStyle = '#7ee787';
  ctx.beginPath();
  ctx.moveTo(640, 42); ctx.lineTo(634, 52); ctx.lineTo(646, 52);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('DEST 090°', 640, 64);

  // --- Right: fuel, throttle, score -----------------------------------------
  panel(ctx, 1054, 16, 210, 150);
  label(ctx, 'FUEL', 1066, 36, p.fuel < 25 ? '#ff6b5e' : hud, 11);
  const fw = 186 * (p.fuel / PLANE.fuelCapacity);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.roundRect(1066, 42, 186, 14, 4); ctx.fill();
  ctx.fillStyle = p.fuel < 25 ? '#ff6b5e' : p.fuel < 50 ? '#ffb347' : '#7ee787';
  ctx.beginPath(); ctx.roundRect(1066, 42, Math.max(4, fw), 14, 4); ctx.fill();
  label(ctx, 'THR ' + Math.round(p.throttle * 100) + '%', 1066, 76, hud, 11);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.roundRect(1066, 82, 186, 10, 4); ctx.fill();
  ctx.fillStyle = hud;
  ctx.beginPath(); ctx.roundRect(1066, 82, Math.max(4, 186 * p.throttle), 10, 4); ctx.fill();
  label(ctx, 'SCORE', 1066, 116, hud, 11);
  bigNumber(ctx, String(run.score).padStart(5, '0'), 1066, 146, '#ffffff', 26);
  label(ctx, 'RINGS ' + run.rings.filter((r) => r.collected).length + '/' + run.rings.length, 1180, 116, 'rgba(255,255,255,0.8)', 11);

  // --- Damage bar (only when hurt) ------------------------------------------
  if (p.damage > 0) {
    panel(ctx, 1054, 174, 210, 34);
    label(ctx, 'DAMAGE ' + Math.round(p.damage) + '%', 1066, 196, '#ff6b5e', 11);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(1160, 186, 92, 10, 4); ctx.fill();
    ctx.fillStyle = '#ff6b5e';
    ctx.beginPath(); ctx.roundRect(1160, 186, 92 * (p.damage / 100), 10, 4); ctx.fill();
  }

  // --- Next-ring pointer ------------------------------------------------------
  const next = run.rings.find((r) => !r.collected && !r.missed);
  if (game.phase === 'fly') {
    const target = next || { x: 4650, y: 16, label: 'DESTINATION' };
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.max(0, Math.round(Math.hypot(dx, dy)));
    const text = next ? '◉ NEXT RING — ' + dist + ' m' : '✈ ' + target.label + ' — ' + dist + ' m';
    ctx.fillStyle = 'rgba(10, 16, 28, 0.62)';
    ctx.beginPath(); ctx.roundRect(520, 78, 240, 30, 6); ctx.fill();
    ctx.fillStyle = next ? '#ffd76a' : '#7ee787';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 640, 98);
  }

  // --- Route progress strip ---------------------------------------------------
  const routeW = 520;
  const routeX = (1280 - routeW) / 2;
  const routeY = 692;
  ctx.fillStyle = 'rgba(10, 16, 28, 0.55)';
  ctx.beginPath(); ctx.roundRect(routeX, routeY - 9, routeW, 18, 9); ctx.fill();
  const prog = (p.x - 450) / (4650 - 450);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(routeX + 10, routeY); ctx.lineTo(routeX + routeW - 10, routeY); ctx.stroke();
  for (const r of run.rings) {
    const rx = routeX + 10 + ((r.x - 450) / (4650 - 450)) * (routeW - 20);
    ctx.fillStyle = r.collected ? '#7ee787' : r.missed ? 'rgba(255,255,255,0.3)' : '#ffd76a';
    ctx.beginPath(); ctx.arc(rx, routeY, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(routeX + 10 + Math.max(0, Math.min(1, prog)) * (routeW - 20), routeY, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CORAL BAY', routeX + 30, routeY - 16);
  ctx.fillText('DESTINATION', routeX + routeW - 40, routeY - 16);

  // --- Warnings ----------------------------------------------------------------
  if (p.stalled && game.phase === 'fly') {
    ctx.fillStyle = Math.sin(game.time * 10) > 0 ? '#ff3b30' : 'rgba(255,59,48,0.4)';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ STALL — NOSE DOWN, ADD POWER', 640, 140);
  }
  if (p.fuel < 25 && p.fuel > 0 && game.phase === 'fly') {
    ctx.fillStyle = Math.sin(game.time * 6) > 0 ? '#ffb347' : 'rgba(255,179,71,0.4)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', 640, 168);
  }
  if (p.engineOut) {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENGINE OUT — GLIDE TO THE STRIP', 640, 140);
  }
}

// Ring drawing (world space, called by the renderer).
export function drawRing(ctx, ring, cam, time) {
  const zoom = cam.zoom;
  const x0 = cam.x - 640 / zoom;
  const sx = (ring.x - x0) * zoom;
  const sy = cam.groundY - ring.y * zoom;
  const r = RING.radiusM * zoom;
  const pulse = 1 + 0.05 * Math.sin(time * 3 + ring.x);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = ring.collected ? 'rgba(126, 231, 135, 0.9)' : 'rgba(255, 215, 106, 0.95)';
  ctx.lineWidth = 7;
  ctx.shadowColor = ring.collected ? '#7ee787' : '#ffd76a';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r - 7, 0, Math.PI * 2);
  ctx.stroke();
  // Chevron markers pointing the way through.
  ctx.fillStyle = ring.collected ? '#7ee787' : '#ffd76a';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 16 - 6, -r - 16);
    ctx.lineTo(i * 16 + 6, -r - 16);
    ctx.lineTo(i * 16, -r - 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
