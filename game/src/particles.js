// Tidewater Airlift — particles, floating score text and screen shake.
// One file, one job: every bit of juice that is not the plane or the HUD.

export function createParticles() {
  return { list: [], texts: [], trauma: 0 };
}

export function spawn(particles, kind, x, y, opts = {}) {
  const n = opts.count || 1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed || 20) * (0.4 + Math.random() * 0.8);
    particles.list.push({
      kind,
      x: x + (Math.random() - 0.5) * (opts.spread || 4),
      y: y + (Math.random() - 0.5) * (opts.spread || 4),
      vx: Math.cos(a) * sp + (opts.vx || 0),
      vy: Math.sin(a) * sp + (opts.vy || 0),
      life: 0,
      maxLife: opts.life || 0.8,
      size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
      color: opts.color || '#ffffff',
      gravity: opts.gravity || 0,
    });
  }
}

export function floatText(particles, x, y, text, color = '#ffd76a') {
  particles.texts.push({ x, y, text, color, life: 0, maxLife: 1.4 });
}

export function shake(particles, amount) {
  particles.trauma = Math.min(1, particles.trauma + amount);
}

export function stepParticles(particles, dt) {
  particles.trauma = Math.max(0, particles.trauma - dt * 1.6);
  for (const p of particles.list) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= 0.98;
  }
  particles.list = particles.list.filter((p) => p.life < p.maxLife);
  for (const t of particles.texts) { t.life += dt; t.y -= 26 * dt; }
  particles.texts = particles.texts.filter((t) => t.life < t.maxLife);
}

// Camera shake offset for this frame (world units), from the trauma level.
export function shakeOffset(particles, time) {
  const s = particles.trauma * particles.trauma;
  return {
    x: s * 14 * Math.sin(time * 61.7),
    y: s * 14 * Math.cos(time * 53.3),
  };
}

export function drawParticles(ctx, particles, cam) {
  const zoom = cam.zoom;
  const x0 = cam.x - 640 / zoom;
  for (const p of particles.list) {
    const a = 1 - p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const sx = (p.x - x0) * zoom;
    const sy = cam.groundY - p.y * zoom;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(1, p.size * (p.kind === 'smoke' ? 1 + p.life * 2 : 1)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of particles.texts) {
    const a = 1 - t.life / t.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = t.color;
    ctx.strokeStyle = 'rgba(20,20,30,0.8)';
    ctx.lineWidth = 4;
    const sx = (t.x - x0) * zoom;
    const sy = cam.groundY - t.y * zoom;
    ctx.strokeText(t.text, sx, sy);
    ctx.fillText(t.text, sx, sy);
  }
  ctx.globalAlpha = 1;
}
