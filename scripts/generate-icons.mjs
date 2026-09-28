import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 生成应用图标（PNG / ICO），不依赖任何图形库。
 *
 * 直接手写 PNG：每个像素 4 通道 RGBA，扫描线前置 filter 字节 0，
 * 再用 zlib 压缩，最后按 PNG 规范拼上 IHDR / IDAT / IEND 与 CRC。
 * 形状用 4×4 超采样求覆盖率，得到平滑边缘。
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BG = [0x1f, 0x4d, 0x8f]; // 品牌主色
const FG = [0xff, 0xff, 0xff];

/** 字母 L 的几何形状：竖笔 + 横笔（坐标归一化到 0–1） */
function insideL(x, y) {
  const vertical = x >= 0.3 && x <= 0.42 && y >= 0.24 && y <= 0.7;
  const horizontal = x >= 0.3 && x <= 0.72 && y >= 0.58 && y <= 0.7;
  return vertical || horizontal;
}

/** 一条横贯底部的强调条，呼应「评分」的意象（留出安全边距，适配 maskable 图标） */
function insideAccent(x, y) {
  return x >= 0.3 && x <= 0.72 && y >= 0.775 && y <= 0.815;
}

function render(size) {
  const SS = 4; // 每个像素 4×4 超采样
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let bgCoverage = 0;
      let fgCoverage = 0;
      let accentCoverage = 0;

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          if (insideL(x, y)) fgCoverage += 1;
          else if (insideAccent(x, y)) accentCoverage += 1;
          else bgCoverage += 1;
        }
      }

      const total = SS * SS;
      const l = fgCoverage / total;
      const a = accentCoverage / total;
      const b = bgCoverage / total;

      // 叠加顺序：背景 → 强调条（半透明白）→ 字母
      const accentMix = 0.45;
      const r = BG[0] * b + (BG[0] * (1 - accentMix) + 255 * accentMix) * a + FG[0] * l;
      const g = BG[1] * b + (BG[1] * (1 - accentMix) + 255 * accentMix) * a + FG[1] * l;
      const bl = BG[2] * b + (BG[2] * (1 - accentMix) + 255 * accentMix) * a + FG[2] * l;

      const i = (py * size + px) * 4;
      pixels[i] = Math.round(r);
      pixels[i + 1] = Math.round(g);
      pixels[i + 2] = Math.round(bl);
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

/* ---------------- PNG 编码 ---------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function toPng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0: None
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 把一张 32×32 PNG 包成单图 ICO（Vista 之后支持内嵌 PNG） */
function toIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry[0] = 32; // width
  entry[1] = 32; // height
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // size
  entry.writeUInt32LE(6 + 16, 12); // offset

  return Buffer.concat([header, entry, png]);
}

/* ---------------- 输出 ---------------- */

const targets = [
  { path: "public/icon-192.png", size: 192 },
  { path: "public/icon-512.png", size: 512 },
  { path: "public/icon-maskable-512.png", size: 512 },
  // app/apple-icon.png 是 Next.js 的约定文件，会自动生成 <link rel="apple-touch-icon">
  { path: "app/apple-icon.png", size: 180 },
];

for (const { path, size } of targets) {
  const full = join(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, toPng(size, render(size)));
  console.log(`生成 ${path}  (${size}×${size})`);
}

const favicon = join(ROOT, "app/favicon.ico");
writeFileSync(favicon, toIco(toPng(32, render(32))));
console.log("生成 app/favicon.ico (32×32)");
