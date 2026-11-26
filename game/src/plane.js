// Tidewater Airlift — the bush plane: flight physics and the aircraft drawing.
// One file, one job: how the plane flies (pure, no canvas) and how it looks.
// The physics is pure so a Node test can fly it without a browser.

import { PLANE } from './config.js';
import { clamp } from './random.js';

export function createPlane(terrain) {
  return {
    x: 450, y: terrain.home.y + 1.2, // parked on the home strip
    vx: 0, vy: 0, speed: 0,
    angle: 0, // pitch, radians; positive = nose up
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    onGround: true,
    engineOut: false,
    stalled: false,
    hasFlown: false, // true once the plane has climbed clear of the strip
    vyExtra: 0, // bounce / gust vertical velocity, decays under gravity
    grace: 0, // seconds after a hard landing during which the ground is forgiving
  };
}

// input: { pitch: -1..1 (positive = nose up), throttle: -1..1 (change), brake: bool }
// env: { terrain, wind, gust, time }
// Returns an array of flight events for this step.
export function stepPlane(p, input, dt, env) {
  const events = [];
  const wasStalled = p.stalled;

  // Throttle lever.
  if (p.fuel > 0) {
    p.throttle = clamp(p.throttle + input.throttle * 0.9 * dt, 0, PLANE.maxThrottle);
  } else {
    p.throttle = 0;
    if (!p.engineOut) { p.engineOut = true; events.push({ type: 'fuel-empty' }); }
  }

  // Pitch.
  p.angle = clamp(p.angle + input.pitch * PLANE.pitchRate * dt, -PLANE.maxPitch, PLANE.maxPitch);
  if (!input.pitch) p.angle -= p.angle * PLANE.stability * dt;

  // Speed along the heading.
  const thrust = p.throttle * PLANE.thrustAccel;
  const drag = PLANE.dragK * p.speed * p.speed;
  const gravityAlong = PLANE.gravity * Math.sin(p.angle);
  p.speed = clamp(p.speed + (thrust - drag - gravityAlong) * dt, 0, PLANE.maxSpeed);

  // Stall: too slow and the wing stops flying.
  p.stalled = p.speed < PLANE.stallSpeed;
  if (p.stalled && !wasStalled) events.push({ type: 'stall' });
  const sink = p.stalled ? (PLANE.stallSpeed - p.speed) * 1.8 + 0.4 : 0.4;
  if (p.stalled) p.angle -= 0.25 * dt; // nose drops

  // Airbrake: drag up, sink up — for short finals.
  const brakeDrag = input.brake ? 14 : 0;
  p.speed = Math.max(0, p.speed - brakeDrag * dt);

  // Bounce velocity fades back to the flight-path velocity; the grace timer
  // forgives the instant after a hard touchdown so one bad landing can't hit twice.
  p.grace = Math.max(0, p.grace - dt);
  if (p.onGround) p.vyExtra = 0;
  else p.vyExtra -= p.vyExtra * 3 * dt;

  const wind = env.wind + env.gust * Math.sin(env.time * 0.9) * 0.6;
  p.vx = Math.cos(p.angle) * p.speed + wind;
  p.vy = Math.sin(p.angle) * p.speed - sink + p.vyExtra;
  if (p.onGround) {
    // Rolling on the strip: rotate when the pilot pulls back, or lift off
    // on her own once fast enough. (The speed-only path is why a landed
    // plane never "takes off" again: after touchdown the pilot/autopilot
    // is not pulling, and the speed is already below 38.)
    p.vy = 0;
    if (p.speed > 24 && (p.angle > 0.15 || p.speed > 38)) {
      p.onGround = false;
      events.push({ type: 'takeoff' });
    }
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.fuel = Math.max(0, p.fuel - (p.throttle * PLANE.fuelBurnThrottle + PLANE.fuelBurnBase) * dt);

  // Soft ceiling.
  if (p.y > 320) { p.y = 320; p.angle = Math.min(p.angle, 0); }
  // Soft walls of the world.
  if (p.x < 20) { p.x = 20; p.speed *= 0.6; }
  if (p.x > env.worldEnd) { p.x = env.worldEnd; p.speed *= 0.6; }

  // Ground contact.
  const groundH = env.terrain.heightAt(p.x);
  if (p.y > groundH + 8) p.hasFlown = true;
  if (p.y <= groundH + 1.2) {
    const runway = env.terrain.runwayAt(p.x);
    const sinkSpeed = -p.vy;
    const gentle = runway && sinkSpeed <= 7 && Math.abs(p.angle) <= 0.3 && p.speed >= 14 && p.speed <= 55;
    const survivable = runway && sinkSpeed <= 10 && Math.abs(p.angle) <= 0.38;
    if (gentle && !p.onGround && p.hasFlown) {
      p.y = groundH + 1.2;
      p.onGround = true;
      p.vy = 0;
      p.angle = 0;
      events.push({ type: 'landed', runway, sinkSpeed });
    } else if (survivable && !p.onGround && p.hasFlown && p.grace <= 0) {
      const impact = sinkSpeed - 5;
      p.damage = Math.min(PLANE.maxDamage, p.damage + impact * 7);
      events.push({ type: 'hard-landing', damage: p.damage, sinkSpeed });
      if (p.damage >= PLANE.maxDamage) {
        events.push({ type: 'crash', cause: 'hard landing' });
      } else if (p.speed <= 25) {
        // Slow enough that the airframe stays down: roll out, mission done.
        p.y = groundH + 1.2;
        p.onGround = true;
        p.vy = 0;
        p.vyExtra = 0;
        p.angle = 0;
        events.push({ type: 'landed', runway, sinkSpeed });
      } else {
        // Bounce: back into the air with a grace window, not a damage loop.
        p.y = groundH + 1.3;
        p.vyExtra = 7;
        p.grace = 0.8;
        p.angle = 0;
      }
    } else if (p.grace > 0) {
      p.y = groundH + 1.2;
      p.vyExtra = Math.max(p.vyExtra, 2);
    } else if (!p.onGround && p.hasFlown) {
      events.push({ type: 'crash', cause: groundH <= 0.5 ? 'ditched in the sea' : 'terrain strike' });
    } else {
      p.y = groundH + 1.2;
    }
  }

  // Rolling out after landing: friction bleeds speed.
  if (p.onGround) {
    p.speed = Math.max(0, p.speed - (input.brake ? 26 : 8) * dt);
    p.vx = Math.cos(p.angle) * p.speed + wind;
  }
  return events;
}

// ---- Drawing ---------------------------------------------------------------

// The aircraft, drawn at a fixed screen size so it reads at a glance.
// sx, sy: screen centre of the plane. angle: pitch in radians (nose up +).
export function drawPlane(ctx, sx, sy, angle, throttle, time, opts = {}) {
  const crashed = opts.crashed || false;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-angle);
  ctx.scale(1.25, 1.25); // the aircraft reads bigger than the world around it
  const propSpeed = 0.15 + throttle * 0.85;
  const propA = time * (6 + 26 * propSpeed);

  // Propeller disc (spinning blur) + blades.
  ctx.save();
  ctx.translate(46, 0);
  ctx.fillStyle = `rgba(30, 30, 34, ${0.10 + 0.22 * propSpeed})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 3, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,20,24,0.85)';
  ctx.lineWidth = 3;
  for (const a of [propA, propA + Math.PI]) {
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
    ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
    ctx.stroke();
  }
  ctx.restore();

  // Floats (amphibian) — the landing gear of this plane.
  ctx.fillStyle = '#274b63';
  roundRect(ctx, -34, 12, 62, 7, 3); ctx.fill();
  ctx.fillStyle = '#1d3a4d';
  roundRect(ctx, -34, 12, 62, 3, 3); ctx.fill();
  ctx.strokeStyle = '#c8ccd4';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-20, 11); ctx.lineTo(-14, 2); ctx.moveTo(18, 11); ctx.lineTo(12, 2); ctx.stroke();

  // Fuselage: cream body, red cheatline, tail.
  const body = ctx.createLinearGradient(0, -12, 0, 8);
  body.addColorStop(0, '#fdf6e3');
  body.addColorStop(0.55, '#f3e3bd');
  body.addColorStop(1, '#d9b98a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-46, -2);
  ctx.quadraticCurveTo(-48, -10, -34, -11);
  ctx.lineTo(28, -11);
  ctx.quadraticCurveTo(46, -10, 48, -3);
  ctx.quadraticCurveTo(48, 4, 30, 6);
  ctx.lineTo(-30, 7);
  ctx.quadraticCurveTo(-44, 6, -46, -2);
  ctx.closePath();
  ctx.fill();
  // Cheatline.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-44, 0);
  ctx.lineTo(44, -1);
  ctx.lineTo(42, 3);
  ctx.lineTo(-42, 4);
  ctx.closePath();
  ctx.fill();
  // Windows.
  ctx.fillStyle = '#1f3a52';
  ctx.beginPath();
  ctx.ellipse(18, -6, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, -6, 5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Registration.
  ctx.fillStyle = '#33302a';
  ctx.font = 'bold 6px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N-TIDE', -18, 3);
  // Tail.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-44, -8);
  ctx.lineTo(-52, -24);
  ctx.lineTo(-44, -24);
  ctx.lineTo(-36, -9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.font = 'bold 7px system-ui, sans-serif';
  ctx.fillText('T', -45, -16);
  // High wing + strut.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-8, -11);
  ctx.lineTo(14, -11);
  ctx.lineTo(10, -16);
  ctx.lineTo(-4, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a93226';
  ctx.fillRect(-2, -16, 4, 26);
  ctx.beginPath();
  ctx.moveTo(-2, -16);
  ctx.lineTo(2, -16);
  ctx.lineTo(16, -30);
  ctx.lineTo(10, -30);
  ctx.closePath();
  ctx.fill();
  // Wing tip light.
  ctx.fillStyle = Math.sin(time * 6) > 0 ? '#ff5a4e' : '#7a1f16';
  ctx.beginPath();
  ctx.arc(13, -28, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (crashed) {
    // Scorched, tilted: the crash pose is drawn by the caller rotating more.
    ctx.fillStyle = 'rgba(40, 30, 20, 0.35)';
    ctx.fillRect(-50, -26, 100, 40);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
