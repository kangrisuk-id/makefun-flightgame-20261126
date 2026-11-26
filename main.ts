// Tidewater Airlift — the entry hand-in (Node 22+, standard library only).
//
// The game is the static game/ folder beside this file: game/index.html plus
// its ES modules, no libraries and no network requests, so a desktop browser
// plays it fully offline. This program hands it in: it validates the entry
// against the same caps the scorer enforces, copies game/ and screenshots/
// to the output directory, and writes /output/dossier.json with the vendored
// make.fun library (buildDossier), which is the summary the judge reads.
//
// Run it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
// Serve the game locally with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps for this bounty (reference/gate.json): at most 4
// screenshots, each at most 256 KiB; game/ at most 993 files and 48 MiB in
// all, no path under game/ longer than 1000 bytes, and index.html at most
// 1 MiB. Refusing here is the same refusal the scorer would give.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message: string): never {
  throw new Error(`tidewater-airlift hand-in refused: ${message}`);
}

function walkGameFiles(dir: string, prefix: string, found: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) fail(`game/ must not contain a symlink: ${rel}`);
    if (stat.isDirectory()) walkGameFiles(path, rel, found);
    else if (stat.isFile()) found.push(rel);
    else fail(`game/ must contain only files and directories: ${rel}`);
  }
  return found;
}

function validateEntry(): void {
  const gameDir = join(here, 'game');
  const indexHtml = join(gameDir, 'index.html');
  if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) fail('game/index.html is missing');
  if (statSync(indexHtml).size > 1024 * 1024) fail('game/index.html is over 1 MiB');

  const files = walkGameFiles(gameDir, '', []);
  if (files.length > CAPS.game_max_files) fail(`game/ has ${files.length} files, over the ${CAPS.game_max_files} cap`);
  let bytes = 0;
  for (const rel of files) {
    if (Buffer.byteLength(rel, 'utf8') > CAPS.game_path_max_bytes) fail(`game/ path over 1000 bytes: ${rel}`);
    bytes += statSync(join(gameDir, rel)).size;
  }
  if (bytes > CAPS.game_max_bytes) fail(`game/ is ${bytes} bytes, over the 48 MiB cap`);

  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name)).sort();
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    fail(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
  }
  console.log(`validated: ${files.length} game files (${bytes} bytes), ${shots.length} screenshots (${shots.join(', ')})`);
}

validateEntry();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
console.log(`hand-in written to ${out} (game/, screenshots/, dossier.json)`);
