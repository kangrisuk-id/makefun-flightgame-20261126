// Tidewater Airlift — deterministic seeded random numbers.
// One file, one job: every procedural choice in the game draws from here, so a
// mission with the same seed always builds the same islands, clouds and birds.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Smooth 1D value noise: cosine-interpolated random control points.
export function makeNoise1D(seed, spacing, amplitude) {
  const rng = mulberry32(seed);
  const points = [];
  for (let i = 0; i < 64; i++) points.push(rng() * 2 - 1);
  return function noise(x) {
    const u = x / spacing;
    const i = Math.floor(u);
    const f = u - i;
    const a = points[((i % 64) + 64) % 64];
    const b = points[(((i + 1) % 64) + 64) % 64];
    const s = (1 - Math.cos(f * Math.PI)) / 2;
    return (a + (b - a) * s) * amplitude;
  };
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
