// Asset optimizer.
//
//   npm run assets
//
// - First run: moves the original art from public/assets/ to art-src/ (never shipped).
// - Every run: reads art-src/, trims transparent padding (alpha < ALPHA_EMPTY counts as empty,
//   which removes faint glow haze), resizes to ~2x the largest on-screen size, and writes PNGs
//   to public/assets/. Paired assets are placed on one shared canvas, centered identically,
//   so they can be swapped without jumping.
// - Writes src/assets/assetMeta.json with each output's canvas and content rect.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'art-src');
const OUT = path.join(ROOT, 'public', 'assets');
const META = path.join(ROOT, 'src', 'assets', 'assetMeta.json');

const ALPHA_EMPTY = 12;
const PAD = 2;

/** Files that are not shipped at all. */
const EXCLUDE = new Set(['ui_31_fx_sheet']);

/**
 * Max size [w, h] of the trimmed content in the output (~2x the largest on-screen size).
 * Images are never upscaled. 'none' = copy as-is (full-bleed backgrounds).
 */
function targetFor(name, folder) {
  if (folder === 'bg') return 'none';
  if (folder === 'cups') return [400, 400];
  if (folder === 'items') return [200, 200];
  // Magician: one uniform factor for the whole rig so parts keep their relative proportions.
  if (folder === 'magician') return { factor: 0.4 };
  const table = {
    fx_ball_gold: [180, 180],
    fx_light_burst: [640, 640],
    fx_sparkle_large: [300, 300],
    fx_sparkle_medium: [220, 220],
    fx_star_small: [160, 160],
    fx_twinkle: [160, 160],
    fx_glint_large: [200, 200],
    fx_glint_small: [140, 140],
    fx_smoke_small: [200, 200],
    fx_smoke_medium: [300, 300],
    fx_smoke_large: [400, 400],
    ui_01_btn_play: [520, 400],
    ui_02_btn_wide_green: [840, 240],
    ui_03_btn_wide_orange: [840, 240],
    ui_04_btn_wide_purple_ad: [840, 240],
    ui_14_icon_heart_full: [130, 130],
    ui_15_icon_heart_empty: [130, 130],
    ui_16_icon_coin: [130, 130],
    ui_17_icon_star_full: [280, 280],
    ui_18_icon_star_empty: [280, 280],
    ui_19_tag_number: [200, 200],
    ui_20_panel_popup: [640, 1100],
    ui_21_banner_ribbon: [900, 400],
    ui_22_badge_level: [480, 240],
    ui_23_bar_hud_top: [960, 300],
    ui_24_bubble_speech: [800, 600],
    ui_25_bar_progress_frame: [1000, 260],
    ui_25_bar_progress_fill: [1000, 260],
    ui_26_level_unlocked: [280, 280],
    ui_27_level_locked: [280, 280],
    ui_28_level_current: [280, 280],
    ui_32_pointer_glove: [400, 400],
  };
  if (table[name]) return table[name];
  if (/^ui_(0[5-9]|1[0-3])_btn_/.test(name)) return [200, 200];
  if (name.startsWith('fx_confetti')) return [100, 100];
  return [400, 400];
}

/** Assets in a group share one scale factor and one canvas, content centered. */
const GROUPS = [
  ['ui_14_icon_heart_full', 'ui_15_icon_heart_empty'],
  ['ui_17_icon_star_full', 'ui_18_icon_star_empty'],
  ['ui_26_level_unlocked', 'ui_27_level_locked', 'ui_28_level_current'],
  ['ui_25_bar_progress_frame', 'ui_25_bar_progress_fill'],
  // Round buttons (includes sound on/off).
  [
    'ui_05_btn_settings', 'ui_06_btn_pause', 'ui_07_btn_home', 'ui_08_btn_hint', 'ui_09_btn_replay',
    'ui_10_btn_sound_on', 'ui_11_btn_sound_off', 'ui_12_btn_music', 'ui_13_btn_close',
  ],
];

function listPngs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listPngs(p));
    else if (entry.name.toLowerCase().endsWith('.png')) out.push(p);
  }
  return out;
}

async function loadTrimmed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < ALPHA_EMPTY) {
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; // clear haze
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`Image is fully transparent: ${file}`);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const buf = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .png()
    .toBuffer();
  return { buf, srcW: w, srcH: h, trim: { x: minX, y: minY, w: cw, h: ch } };
}

function fitFactor(w, h, target) {
  if (!Array.isArray(target)) return target.factor;
  return Math.min(1, target[0] / w, target[1] / h);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    if (!fs.existsSync(OUT)) throw new Error('No art-src/ and no public/assets/ found.');
    console.log('First run: moving originals public/assets -> art-src');
    fs.renameSync(OUT, SRC);
  }
  fs.rmSync(OUT, { recursive: true, force: true });

  const entries = new Map();
  for (const file of listPngs(SRC)) {
    const name = path.basename(file, '.png');
    if (EXCLUDE.has(name)) continue;
    entries.set(name, { file, folder: path.basename(path.dirname(file)), name });
  }

  for (const e of entries.values()) {
    e.target = targetFor(e.name, e.folder);
    if (e.target === 'none') continue;
    Object.assign(e, await loadTrimmed(e.file));
    e.factor = fitFactor(e.trim.w, e.trim.h, e.target);
  }

  const grouped = new Set();
  const groups = GROUPS.map((g) =>
    g.map((n) => {
      const e = entries.get(n);
      if (!e) throw new Error(`Group member missing: ${n}`);
      if (grouped.has(n)) throw new Error(`Asset in two groups: ${n}`);
      grouped.add(n);
      return e;
    }),
  );
  for (const members of groups) {
    const factor = Math.min(...members.map((m) => m.factor));
    for (const m of members) m.factor = factor;
  }

  const meta = {};
  const written = new Set();
  let totalIn = 0;
  let totalOut = 0;

  async function writeOne(e, canvasW, canvasH) {
    const outDir = path.join(OUT, e.folder);
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${e.name}.png`);
    totalIn += fs.statSync(e.file).size;

    if (e.target === 'none') {
      await sharp(e.file).png({ compressionLevel: 9, effort: 10 }).toFile(outFile);
      const m = await sharp(e.file).metadata();
      meta[e.name] = { folder: e.folder, w: m.width, h: m.height, content: { x: 0, y: 0, w: m.width, h: m.height } };
    } else {
      const w = Math.max(1, Math.round(e.trim.w * e.factor));
      const h = Math.max(1, Math.round(e.trim.h * e.factor));
      const cw = canvasW ?? w + PAD * 2;
      const ch = canvasH ?? h + PAD * 2;
      const left = Math.round((cw - w) / 2);
      const top = Math.round((ch - h) / 2);
      const resized = await sharp(e.buf).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
      await sharp({ create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: resized, left, top }])
        .png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true })
        .toFile(outFile);
      meta[e.name] = {
        folder: e.folder,
        w: cw,
        h: ch,
        content: { x: left, y: top, w, h },
        // Mapping back to the original file (Phase 2 magician rig pivots).
        source: { w: e.srcW, h: e.srcH, trim: e.trim, factor: +e.factor.toFixed(5) },
      };
    }
    totalOut += fs.statSync(outFile).size;
    written.add(e.name);
  }

  for (const members of groups) {
    const sizes = members.map((m) => [Math.round(m.trim.w * m.factor), Math.round(m.trim.h * m.factor)]);
    const cw = Math.max(...sizes.map((s) => s[0])) + PAD * 2;
    const ch = Math.max(...sizes.map((s) => s[1])) + PAD * 2;
    for (const m of members) await writeOne(m, cw, ch);
  }
  for (const e of entries.values()) if (!written.has(e.name)) await writeOne(e);

  const sorted = Object.fromEntries(Object.keys(meta).sort().map((k) => [k, meta[k]]));
  fs.mkdirSync(path.dirname(META), { recursive: true });
  fs.writeFileSync(META, JSON.stringify(sorted, null, 2) + '\n');

  const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
  console.log(`Processed ${written.size} images: ${mb(totalIn)} -> ${mb(totalOut)}`);
  console.log(`Metadata written to ${path.relative(ROOT, META)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
