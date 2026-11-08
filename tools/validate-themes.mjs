// Checks every *.bnctheme in this repository the way the BNC apps' readers do, for every BNC app.
//   node tools/validate-themes.mjs
// Rules (see docs/MAKING-PLUGINS.md): data.json at the top; a unique id; a name; "colors.accent" as #rrggbb;
// each app entry's icon exists inside the zip, is a PNG, is square and at least 32x32.
import JSZip from 'jszip';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEX = /^#[0-9a-f]{6}$/i;
const APPS = ['bnc-ambient', 'bnc-docs', 'bnc-presentation', 'bnc-sheets', 'bnc-pdf', 'bnc-draw', 'bnc-wifi']; // apps every style here is expected to cover

const pngSize = (b) => (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null);

let problems = 0;
const fail = (file, msg) => {
  console.log(`  FAIL ${file}: ${msg}`);
  problems++;
};

const ids = new Map();
const files = readdirSync(root).filter((f) => f.endsWith('.bnctheme')).sort();
for (const file of files) {
  const zip = await JSZip.loadAsync(readFileSync(join(root, file))).catch(() => null);
  if (!zip) {
    fail(file, 'not a zip file');
    continue;
  }
  const dataFile = zip.file('data.json');
  if (!dataFile) {
    fail(file, 'data.json is missing from the top of the zip');
    continue;
  }
  let data;
  try {
    data = JSON.parse(await dataFile.async('string'));
  } catch (e) {
    fail(file, `data.json is not valid JSON (${e.message})`);
    continue;
  }
  if (!/^[\w.\-]{1,64}$/.test(data.id ?? '')) fail(file, 'needs an "id" (letters, numbers, . - _)');
  if (!data.name) fail(file, 'needs a "name"');
  if (!HEX.test(data.colors?.accent ?? '')) fail(file, '"colors.accent" must look like #rrggbb');
  if (data.colors?.accentInk && !HEX.test(data.colors.accentInk)) fail(file, '"colors.accentInk" must look like #rrggbb');
  if (ids.has(data.id)) fail(file, `id "${data.id}" is also used by ${ids.get(data.id)}`);
  ids.set(data.id, file);

  const covered = [];
  for (const [app, entry] of Object.entries(data.apps ?? {})) {
    if (!entry?.icon) continue;
    const icon = zip.file(entry.icon);
    if (!icon) {
      fail(file, `${app}: icon "${entry.icon}" is not in the zip`);
      continue;
    }
    const size = pngSize(Buffer.from(await icon.async('uint8array')));
    if (!size) fail(file, `${app}: ${entry.icon} is not a PNG`);
    else if (size.w !== size.h || size.w < 32) fail(file, `${app}: icon must be square and at least 32x32 (is ${size.w}x${size.h})`);
    else covered.push(app);
  }
  const missing = APPS.filter((a) => !covered.includes(a));
  console.log(`${missing.length ? 'note' : 'ok  '} ${file.padEnd(16)} v${(data.version ?? '?').padEnd(6)} accent ${data.colors?.accent}  apps: ${covered.length}/${APPS.length}${missing.length ? '  (no icon for ' + missing.join(', ') + ')' : ''}`);
}

for (const f of readdirSync(root).filter((f) => f.endsWith('.bncvis') || f.endsWith('.bncplugin'))) {
  const head = readFileSync(join(root, f), 'utf8').replace(/^﻿/, '');
  if (!/^\s*\/\*\s*@bnc-plugin\b/.test(head)) fail(f, 'must start with a /* @bnc-plugin { ... } */ header');
  else console.log(`ok   ${f.padEnd(16)} visualizer`);
}

console.log(problems ? `\n${problems} problem(s).` : `\nAll ${files.length} styles are valid.`);
process.exit(problems ? 1 : 0);
