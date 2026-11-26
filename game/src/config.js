// Tidewater Airlift — game configuration: constants, palettes and mission definitions.
// One file, one job: every number that tunes the game lives here.

export const VIEW = {
  width: 1280,
  height: 720,
  // World metres shown per screen pixel at the default camera zoom.
  zoom: 3.0,
  seaLevel: 0,
};

export const PLANE = {
  lengthM: 11, // metres, used for collision clearance
  maxThrottle: 1,
  thrustAccel: 26, // m/s^2 at full throttle
  dragK: 0.011, // quadratic drag coefficient
  liftK: 0.055, // lift countering gravity, scales with speed^2
  gravity: 9.8,
  stallSpeed: 17, // m/s — below this the nose drops and the plane sinks
  maxSpeed: 62,
  pitchRate: 1.15, // rad/s at full pitch input
  maxPitch: 0.62, // rad
  stability: 0.35, // how strongly the nose eases back toward level
  fuelCapacity: 100,
  fuelBurnThrottle: 0.55, // units/s at full throttle
  fuelBurnBase: 0.05, // units/s always
  maxDamage: 100,
};

export const SCORE = {
  ring: 100,
  landingSoftMax: 300, // touchdown gentleness bonus
  landingSoftVy: 6, // m/s touchdown sink that still earns the full bonus
  timeBonusPerSecond: 5,
  fuelBonusPerUnit: 2,
  noDamageBonus: 150,
};

// Golden-hour palettes, one per mission. Each mission is a time of day.
export const PALETTES = {
  dawn: {
    name: 'Dawn',
    skyTop: '#2b3a6e', skyMid: '#e8805a', skyLow: '#ffc46b',
    sun: '#ffd98a', sunGlow: 'rgba(255, 190, 110, 0.55)',
    farMountain: '#5d5a8f', nearMountain: '#3f4a6b',
    sea: '#2e6f8e', seaDeep: '#1d4e6b', seaGlitter: 'rgba(255, 210, 140, 0.5)',
    sand: '#e8cf9a', grass: '#5f9e5a', grassDark: '#3f7a44',
    cloud: 'rgba(255, 235, 220, 0.85)',
    hud: '#ffb347', hudDim: 'rgba(255, 179, 71, 0.55)',
  },
  noon: {
    name: 'Noon',
    skyTop: '#1f6fd0', skyMid: '#6db7ec', skyLow: '#cfeefb',
    sun: '#fff3c4', sunGlow: 'rgba(255, 244, 190, 0.5)',
    farMountain: '#5a7fa8', nearMountain: '#3e6b8f',
    sea: '#1f7fb0', seaDeep: '#14608a', seaGlitter: 'rgba(255, 255, 255, 0.55)',
    sand: '#f0dcae', grass: '#58a05c', grassDark: '#3c7f46',
    cloud: 'rgba(255, 255, 255, 0.92)',
    hud: '#7ee787', hudDim: 'rgba(126, 231, 135, 0.55)',
  },
  dusk: {
    name: 'Dusk',
    skyTop: '#1d1440', skyMid: '#7a3b6e', skyLow: '#ff8f5e',
    sun: '#ff9d6b', sunGlow: 'rgba(255, 140, 90, 0.55)',
    farMountain: '#4a3560', nearMountain: '#33264a',
    sea: '#3a3a6e', seaDeep: '#262650', seaGlitter: 'rgba(255, 150, 100, 0.5)',
    sand: '#d9b98a', grass: '#4a7a52', grassDark: '#33573c',
    cloud: 'rgba(255, 190, 170, 0.75)',
    hud: '#ff9d6b', hudDim: 'rgba(255, 157, 107, 0.55)',
  },
};

// Mission definitions. The route is always west -> east: take off from the home
// strip, thread the rings, land on the destination strip.
export const MISSIONS = [
  {
    id: 1,
    name: 'First Light',
    subtitle: 'Coral Bay to Gull Rock — a gentle first sortie',
    palette: 'dawn',
    seed: 20261126,
    wind: -2, // m/s headwind (negative = against the flight direction)
    gust: 1.5,
    parTime: 130, // seconds for the full time bonus
    rings: [
      { x: 1150, y: 95 }, { x: 1750, y: 150 }, { x: 2450, y: 110 },
    ],
    birds: 0,
    briefing: 'Take off from Coral Bay, thread all 3 rings, and put her down softly on Gull Rock. Watch your fuel — the tank only holds so much sunrise.',
  },
  {
    id: 2,
    name: 'Storm Front',
    subtitle: 'Gull Rock to Heron Point — wind, birds, and a tighter tank',
    palette: 'noon',
    seed: 20261127,
    wind: -6,
    gust: 4,
    parTime: 145,
    rings: [
      { x: 1050, y: 80 }, { x: 1500, y: 170 }, { x: 2050, y: 120 },
      { x: 2650, y: 190 }, { x: 3300, y: 130 },
    ],
    birds: 5,
    briefing: 'A front is coming in off the sea. Five rings, a crosswind that gusts, and gulls working the same thermals you are. Land clean on Heron Point.',
  },
  {
    id: 3,
    name: 'Night Mail',
    subtitle: 'Heron Point to Lighthouse Cay — last light, last flight',
    palette: 'dusk',
    seed: 20261128,
    wind: -4,
    gust: 6,
    parTime: 160,
    rings: [
      { x: 950, y: 90 }, { x: 1350, y: 160 }, { x: 1850, y: 100 },
      { x: 2400, y: 180 }, { x: 2950, y: 120 }, { x: 3500, y: 160 },
    ],
    birds: 8,
    briefing: 'The mail has to fly before dark. Six rings, gusting wind, and a narrow strip lit by the lighthouse. Bring her home.',
  },
];

export const RUNWAY = {
  lengthM: 420,
  // Runway strips are placed by terrain.js at these world-x centres.
  homeX: 450,
  destX: 4650,
};

export const RING = { radiusM: 26, collectM: 30 };

export const STORAGE_KEY = 'tidewater-airlift-best-v1';
