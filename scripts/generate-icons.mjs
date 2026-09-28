import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 生成应用图标（Web / PWA / Android），不依赖任何图形库。
 *
 * 直接手写 PNG：每个像素 4 通道 RGBA，扫描线前置 filter 字节 0，
 * 再用 zlib 压缩，最后按 PNG 规范拼上 IHDR / IDAT / IEND 与 CRC。
 * 形状用 4×4 超采样求覆盖率，得到平滑边缘。
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BG = [0x1f, 0x4d, 0x8f]; // 品牌主色
const FG = [0xff, 0xff, 0xff];

/* ------------------------------------------------------------------ *
 * 图形定义（坐标归一化到 0–1）
 * ------------------------------------------------------------------ */

/** 字母 L：竖笔 + 横笔 */
function insideL(x, y) {
  const vertical = x >= 0.3 && x <= 0.42 && y >= 0.24 && y <= 0.7;
  const horizontal = x >= 0.3 && x <= 0.72 && y >= 0.58 && y <= 0.7;
  return vertical || horizontal;
}

/** 底部强调条，呼应「评分」的意象 */
function insideAccent(x, y) {
  return x >= 0.3 && x <= 0.72 && y >= 0.775 && y <= 0.815;
}

/** 原始图形的包围盒，用于把内容缩放进自适应图标的安全区 */
const BBOX = { x0: 0.3, x1: 0.72, y0: 0.24, y1: 0.815 };
const BBOX_CX = (BBOX.x0 + BBOX.x1) / 2;
const BBOX_CY = (BBOX.y0 + BBOX.y1) / 2;
const BBOX_H = BBOX.y1 - BBOX.y0;

/**
 * 自适应图标的前景层安全区：108dp 画布里，只有中心 66dp 的圆一定可见。
 * 把图形高度压到画布的 0.48，四个角到中心的距离约 0.297 < 安全半径 0.305。
 */
const FOREGROUND_SCALE = 0.48 / BBOX_H;

/** 圆角矩形的圆角半径（占边长比例） */
const CORNER = 0.22;

/**
 * 采样一个点，返回颜色类别（null 表示透明）。
 * variant: "legacy" 圆角方形 | "round" 圆形 | "foreground" 仅前景（透明底）
 */
function sample(nx, ny, variant) {
  if (variant === "foreground") {
    const ox = (nx - 0.5) / FOREGROUND_SCALE + BBOX_CX;
    const oy = (ny - 0.5) / FOREGROUND_SCALE + BBOX_CY;
    if (insideL(ox, oy)) return "fg";
    if (insideAccent(ox, oy)) return "accent";
    return null;
  }

  if (variant === "round") {
    const dx = nx - 0.5;
    const dy = ny - 0.5;
    if (dx * dx + dy * dy > 0.25) return null;
  } else {
    // 圆角矩形遮罩
    const cx = Math.min(Math.max(nx, CORNER), 1 - CORNER);
    const cy = Math.min(Math.max(ny, CORNER), 1 - CORNER);
    const dx = nx - cx;
    const dy = ny - cy;
    if (dx * dx + dy * dy > CORNER * CORNER) return null;
  }

  if (insideL(nx, ny)) return "fg";
  if (insideAccent(nx, ny)) return "accent";
  return "bg";
}

/* ------------------------------------------------------------------ *
 * 光栅化
 * ------------------------------------------------------------------ */

const ACCENT_MIX = 0.45; // 强调条 = 背景与白色按 45% 混合

function classColor(kind) {
  if (kind === "fg") return FG;
  if (kind === "accent") {
    return [
      BG[0] * (1 - ACCENT_MIX) + 255 * ACCENT_MIX,
      BG[1] * (1 - ACCENT_MIX) + 255 * ACCENT_MIX,
      BG[2] * (1 - ACCENT_MIX) + 255 * ACCENT_MIX,
    ];
  }
  return BG;
}

function render(size, variant) {
  const SS = 4;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let opaque = 0;
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const kind = sample(x, y, variant);
          if (!kind) continue;
          const c = classColor(kind);
          r += c[0];
          g += c[1];
          b += c[2];
          opaque += 1;
        }
      }

      const total = SS * SS;
      const i = (py * size + px) * 4;
      if (opaque > 0) {
        pixels[i] = Math.round(r / opaque);
        pixels[i + 1] = Math.round(g / opaque);
        pixels[i + 2] = Math.round(b / opaque);
        pixels[i + 3] = Math.round((opaque / total) * 255);
      } else {
        pixels[i + 3] = 0;
      }
    }
  }
  return pixels;
}

/* ------------------------------------------------------------------ *
 * PNG / ICO 编码
 * ------------------------------------------------------------------ */

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
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

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

function toIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);

  return Buffer.concat([header, entry, png]);
}

function write(path, size, variant) {
  const full = join(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, toPng(size, render(size, variant)));
  return full;
}

/* ------------------------------------------------------------------ *
 * 输出
 * ------------------------------------------------------------------ */

const written = [];

// --- Web / PWA ---
written.push([write("public/icon-192.png", 192, "legacy"), "192×192"]);
written.push([write("public/icon-512.png", 512, "legacy"), "512×512"]);
written.push([write("public/icon-maskable-512.png", 512, "legacy"), "512×512"]);
written.push([write("app/apple-icon.png", 180, "legacy"), "180×180"]);
writeFileSync(
  join(ROOT, "app/favicon.ico"),
  toIco(toPng(32, render(32, "legacy"))),
);
written.push([join(ROOT, "app/favicon.ico"), "32×32"]);

// --- Android ---
const ANDROID_RES = "android/app/src/main/res";
const DENSITIES = [
  ["mdpi", 1],
  ["hdpi", 1.5],
  ["xhdpi", 2],
  ["xxhdpi", 3],
  ["xxxhdpi", 4],
];

for (const [density, scale] of DENSITIES) {
  const dir = `${ANDROID_RES}/mipmap-${density}`;
  written.push([
    write(`${dir}/ic_launcher.png`, Math.round(48 * scale), "legacy"),
    `${Math.round(48 * scale)}×${Math.round(48 * scale)}`,
  ]);
  written.push([
    write(`${dir}/ic_launcher_round.png`, Math.round(48 * scale), "round"),
    `${Math.round(48 * scale)}×${Math.round(48 * scale)}`,
  ]);
  written.push([
    write(
      `${dir}/ic_launcher_foreground.png`,
      Math.round(108 * scale),
      "foreground",
    ),
    `${Math.round(108 * scale)}×${Math.round(108 * scale)}`,
  ]);
}

// 启动图：单一 1024 方形品牌图。删掉按方向切分的旧版本，
// 避免残留的默认图被优先使用（启动图是大片纯色 + 居中标，拉伸不可见）。
const splashDirs = [
  "drawable",
  "drawable-port-mdpi",
  "drawable-port-hdpi",
  "drawable-port-xhdpi",
  "drawable-port-xxhdpi",
  "drawable-port-xxxhdpi",
  "drawable-land-mdpi",
  "drawable-land-hdpi",
  "drawable-land-xhdpi",
  "drawable-land-xxhdpi",
  "drawable-land-xxxhdpi",
];

for (const dir of splashDirs) {
  const target = join(ROOT, ANDROID_RES, dir, "splash.png");
  if (existsSync(target)) rmSync(target);
}

written.push([
  write(`${ANDROID_RES}/drawable/splash.png`, 1024, "legacy"),
  "1024×1024",
]);

// 自适应图标背景色改成品牌色
writeFileSync(
  join(ROOT, ANDROID_RES, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1F4D8F</color>
</resources>
`,
);

// 状态栏 / 主题色与品牌一致
writeFileSync(
  join(ROOT, ANDROID_RES, "values/colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#1F4D8F</color>
    <color name="colorPrimaryDark">#163A6B</color>
    <color name="colorAccent">#1F4D8F</color>
    <color name="splashBackground">#1F4D8F</color>
</resources>
`,
);

console.log(`生成 ${written.length} 个图片资源：\n`);
for (const [path, size] of written) {
  console.log(`  ${path.replace(`${ROOT}/`, "").padEnd(58)} ${size}`);
}
console.log("\n自适应图标背景色 → #1F4D8F");
console.log("启动图 → drawable/splash.png");
