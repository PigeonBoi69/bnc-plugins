// Packs an app colour style from sources/<name>/ into <name>.bnctheme (a zip: data.json first, then each app's icon).
//   node tools/pack-theme.mjs red          pack one style
//   node tools/pack-theme.mjs --all        pack every folder in sources/
//   node tools/pack-theme.mjs --check      change nothing; fail if a .bnctheme does not match its sources/ folder
// Packing is reproducible (fixed timestamps, sorted entries), so re-packing an unchanged style gives identical bytes.
import JSZip from 'jszip';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = join(root, 'sources');
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

function files(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full, base));
    else out.push(full.slice(base.length + 1).replace(/\\/g, '/'));
  }
  return out;
}

async function build(name) {
  const dir = join(sources, name);
  if (!existsSync(join(dir, 'data.json'))) throw new Error(`sources/${name}/data.json is missing`);
  const zip = new JSZip();
  const list = files(dir);
  // data.json first (readers look for it at the top), then everything else in a stable order
  for (const rel of ['data.json', ...list.filter((f) => f !== 'data.json')]) {
    zip.file(rel, readFileSync(join(dir, rel)), { date: FIXED_DATE, createFolders: false });
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

const args = process.argv.slice(2);
const check = args.includes('--check');
const names = args.includes('--all') || check ? readdirSync(sources).filter((n) => statSync(join(sources, n)).isDirectory()) : args.filter((a) => !a.startsWith('--'));
if (!names.length) {
  console.error('Usage: node tools/pack-theme.mjs <name> | --all | --check');
  process.exit(2);
}

let bad = 0;
for (const name of names) {
  const out = join(root, `${name}.bnctheme`);
  const bytes = await build(name);
  if (check) {
    // compare contents (not bytes): every file in the packed zip must equal its source file
    if (!existsSync(out)) {
      console.log(`MISSING  ${name}.bnctheme (run: npm run pack)`);
      bad++;
      continue;
    }
    const packed = await JSZip.loadAsync(readFileSync(out));
    const names2 = Object.values(packed.files).filter((f) => !f.dir).map((f) => f.name).sort();
    const want = files(join(sources, name)).sort();
    let ok = JSON.stringify(names2) === JSON.stringify(want);
    for (const rel of want) {
      const entry = packed.file(rel);
      if (!entry || Buffer.compare(Buffer.from(await entry.async('uint8array')), readFileSync(join(sources, name, rel))) !== 0) ok = false;
    }
    console.log(`${ok ? 'OK      ' : 'DIFFERS '} ${name}.bnctheme`);
    if (!ok) bad++;
  } else {
    writeFileSync(out, bytes);
    console.log(`packed ${name}.bnctheme (${(bytes.length / 1024).toFixed(0)} KB, ${files(join(sources, name)).length} files)`);
  }
}
if (bad) {
  console.error(`\n${bad} style(s) do not match sources/. Run: npm run pack`);
  process.exit(1);
}
