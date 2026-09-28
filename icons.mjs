// アイコン生成（依存ライブラリなし・zlib だけで PNG を書く）
// 実行: node icons.mjs   → icons/icon-192.png, icon-512.png, apple-touch-icon.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'icons'), { recursive: true });

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BG = hex('#16201B');
const GRID = hex('#1F2B25');
const COPPER = hex('#D9884F');
const PAD = hex('#F1E6D8');

// 基板の銅パターン。3本の配線がパッドに集まり、1つだけ明るい＝いま進めている研究。
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const traces = [
  [[18, 76], [34, 76], [48, 62], [48, 34]],
  [[82, 30], [66, 30], [56, 40], [56, 62], [66, 72], [82, 72]],
  [[18, 30], [30, 30], [40, 40], [40, 50]],
];
const pads = [
  { x: 18, y: 76, r: 6, c: COPPER }, { x: 48, y: 30, r: 7.5, c: PAD },
  { x: 82, y: 30, r: 6, c: COPPER }, { x: 82, y: 72, r: 6, c: COPPER },
  { x: 18, y: 30, r: 6, c: COPPER }, { x: 40, y: 54, r: 5, c: COPPER },
];

function sample(x, y) {
  // x, y は 0..100
  for (const p of pads) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d <= p.r) return d <= p.r * 0.42 ? BG : p.c;
  }
  for (const t of traces) {
    for (let i = 0; i < t.length - 1; i++) {
      if (segDist(x, y, t[i][0], t[i][1], t[i + 1][0], t[i + 1][1]) <= 2.6) return COPPER;
    }
  }
  if ((x % 12.5 < 0.5) || (y % 12.5 < 0.5)) return GRID;
  return BG;
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const N = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
        const c = sample(((px + (sx + 0.5) / N) / size) * 100, ((py + (sy + 0.5) / N) / size) * 100);
        r += c[0]; g += c[1]; b += c[2];
      }
      const i = (py * size + px) * 4;
      buf[i] = r / (N * N); buf[i + 1] = g / (N * N); buf[i + 2] = b / (N * N); buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

for (const s of [192, 512]) writeFileSync(join(here, 'icons', `icon-${s}.png`), draw(s));
writeFileSync(join(here, 'icons', 'apple-touch-icon.png'), draw(180));
console.log('built: icons/icon-192.png, icon-512.png, apple-touch-icon.png');
