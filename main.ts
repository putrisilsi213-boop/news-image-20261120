// news-image-20261120 — "The World Today: Friday 20 November 2026"
// A program that draws one image summing up the world news of Friday
// 20 November 2026 and writes it to /output/entry.png (or $MAKEFUN_OUTPUT_DIR).
// Pure Node standard library: no network, no model calls, no dependencies.
// The picture is a newspaper front page, drawn pixel by pixel from code:
// a masthead naming the day, a lead story on the first-ever Trump-Xi-Putin
// trilateral summit in Shenzhen, and six more of the day's biggest stories
// (Russian missiles in Poland, the ICJ's Myanmar genocide ruling, Cyclone
// Akvan, the Houthi strike on Riyadh's PIF Tower, the Wall Street sell-off
// and Anthropic's IPO, the EU-UK summit), plus an "Also today" strip.
// Text is rendered with a small 5x7 bitmap font written here (uppercase),
// and the PNG is encoded with zlib deflate plus a CRC32 implementation.
// Running the program twice produces byte-identical output.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const PAPER: RGB = [248, 243, 232];
const INK: RGB = [20, 20, 20];
const RED: RGB = [178, 34, 34];
const NAVY: RGB = [28, 48, 92];
const BLUE: RGB = [52, 96, 168];
const SKY: RGB = [168, 198, 226];
const LIGHT: RGB = [236, 230, 214];
const GREY: RGB = [110, 106, 96];
const WHITE: RGB = [255, 255, 255];
const GOLD: RGB = [198, 152, 46];
const GREEN: RGB = [52, 120, 66];
const ORANGE: RGB = [216, 108, 28];
const BROWN: RGB = [122, 84, 52];
const SKIN: RGB = [226, 182, 138];
const DARK: RGB = [38, 38, 44];

const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = PAPER[0];
  buf[i * 3 + 1] = PAPER[1];
  buf[i * 3 + 2] = PAPER[2];
}

function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
}

function strokeRect(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function hline(x0: number, x1: number, y: number, c: RGB): void {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) px(x, y, c);
}

function vline(x: number, y0: number, y1: number, c: RGB): void {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) px(x, y, c);
}

// Bresenham line, with optional thickness.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (t <= 1) px(x, y, c);
    else fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function filledCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) px(cx + x, cy + y, c);
  }
}

function filledEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor((rx * Math.sqrt(ry * ry - y * y)) / ry);
    for (let x = -half; x <= half; x++) px(cx + x, cy + y, c);
  }
}

// Filled triangle by scanline interpolation.
function filledTriangle(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB,
): void {
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.floor(Math.min(...xs));
      const hi = Math.ceil(Math.max(...xs));
      for (let x = lo; x <= hi; x++) px(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase). Each glyph is 7 rows of 5 bits.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '\u2014': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '\u2022': ['00000', '00000', '01100', '01100', '00000', '00000', '00000'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
};

const BLANK = ['00000', '00000', '00000', '00000', '00000', '00000', '00000'];

function norm(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .toUpperCase();
}

function charAdvance(scale: number, tight: boolean): number {
  return 6 * scale - (tight ? 1 : 0);
}

function textWidth(s: string, scale: number, tight = false): number {
  const t = norm(s);
  if (t.length === 0) return 0;
  return (t.length - 1) * charAdvance(scale, tight) + 5 * scale;
}

function drawChar(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const g = FONT[ch] ?? BLANK;
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (g[row][col] === '1') {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB, tight = false): void {
  const t = norm(s);
  const adv = charAdvance(scale, tight);
  for (let i = 0; i < t.length; i++) {
    drawChar(t[i], x + i * adv, y, scale, c);
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB, tight = false): void {
  const w = textWidth(s, scale, tight);
  drawText(s, cx - Math.floor(w / 2), y, scale, c, tight);
}

// Greedy word wrap; returns lines that fit maxWidth.
function wrapText(s: string, maxWidth: number, scale: number, tight = false): string[] {
  const adv = charAdvance(scale, tight);
  const words = norm(s).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    const tw = (trial.length - 1) * adv + 5 * scale;
    if (tw <= maxWidth || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// PNG encoder (8-bit RGB, filter 0, zlib deflate). Deterministic.
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  out.set(u32be(data.length), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(out.subarray(4, 8 + data.length), 0);
  out.set(u32be(crc32(crcData)), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const raw = new Uint8Array((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(W), 0);
  ihdr.set(u32be(H), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(idat)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Small drawn scenes used in the story panels.
// ---------------------------------------------------------------------------

function drawFlagUS(x: number, y: number, w: number, h: number): void {
  const stripe = Math.max(1, Math.floor(h / 13));
  for (let i = 0; i < 13; i++) {
    fillRect(x, y + i * stripe, w, stripe, i % 2 === 0 ? RED : WHITE);
  }
  fillRect(x, y, Math.floor(w * 0.4), stripe * 7, NAVY);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      filledCircle(x + 3 + c * 5, y + 3 + r * 4, 1, WHITE);
    }
  }
}

function drawFlagCN(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, RED);
  filledCircle(x + 6, y + 6, 3, GOLD);
  for (const [sx, sy] of [[16, 3], [19, 6], [19, 10], [16, 13]] as const) {
    filledCircle(x + sx, y + sy, 1, GOLD);
  }
}

function drawFlagRU(x: number, y: number, w: number, h: number): void {
  const third = Math.max(1, Math.floor(h / 3));
  fillRect(x, y, w, third, WHITE);
  fillRect(x, y + third, w, third, BLUE);
  fillRect(x, y + 2 * third, w, h - 2 * third, RED);
}

function drawFlagGB(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  fillRect(x, y + Math.floor(h / 2) - 2, w, 4, WHITE);
  fillRect(x + Math.floor(w / 2) - 2, y, 4, h, WHITE);
  fillRect(x, y + Math.floor(h / 2) - 1, w, 2, RED);
  fillRect(x + Math.floor(w / 2) - 1, y, 2, h, RED);
  line(x, y, x + w, y + h, WHITE, 1);
  line(x + w, y, x, y + h, WHITE, 1);
}

// Icon strips drawn at the foot of each story panel.
function drawIcon(kind: string, x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, LIGHT);
  strokeRect(x, y, w, h, 1, GREY);
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  if (kind === 'missile') {
    fillRect(x, y, w, h, NAVY);
    line(x + 12, y + h - 14, x + w - 40, y + 12, WHITE, 2);
    line(x + 30, y + h - 8, x + w - 20, y + 22, ORANGE, 2);
    filledCircle(x + w - 38, y + 12, 4, ORANGE);
    filledCircle(x + w - 38, y + 12, 2, GOLD);
    fillRect(x, y + h - 10, w, 10, GREEN);
    drawText('NATO', x + 8, y + 6, 1, WHITE);
  } else if (kind === 'scales') {
    fillRect(x, y, w, h, WHITE);
    vline(cx, y + 8, y + h - 16, INK);
    hline(cx - 34, cx + 34, y + 12, INK);
    line(cx - 34, y + 12, cx - 44, y + h - 18, INK, 2);
    line(cx - 34, y + 12, cx - 24, y + h - 18, INK, 2);
    filledTriangle(cx - 46, y + h - 18, cx - 22, y + h - 18, cx - 34, y + h - 8, GOLD);
    line(cx + 34, y + 12, cx + 44, y + h - 18, INK, 2);
    line(cx + 34, y + 12, cx + 24, y + h - 18, INK, 2);
    filledTriangle(cx + 22, y + h - 18, cx + 46, y + h - 18, cx + 34, y + h - 8, GOLD);
    fillRect(cx - 3, y + 6, 6, 4, INK);
    hline(cx - 26, cx + 26, y + h - 6, INK);
  } else if (kind === 'cyclone') {
    fillRect(x, y, w, h, SKY);
    for (let r = 4; r <= 22; r += 4) {
      const steps = 24;
      for (let s = 0; s < steps; s++) {
        const a0 = (s / steps) * Math.PI * 2;
        const a1 = ((s + 1) / steps) * Math.PI * 2;
        const rr = r + (s / steps) * 3;
        line(
          Math.round(cx + Math.cos(a0) * rr), Math.round(cy - 4 + Math.sin(a0) * rr * 0.8),
          Math.round(cx + Math.cos(a1) * rr), Math.round(cy - 4 + Math.sin(a1) * rr * 0.8),
          WHITE, 2,
        );
      }
    }
    filledCircle(cx, cy - 4, 3, INK);
    for (let i = 0; i < 7; i++) {
      const rx = x + 14 + i * 38;
      line(rx, y + h - 16, rx - 3, y + h - 8, BLUE, 2);
    }
    fillRect(x, y + h - 6, w, 6, BLUE);
  } else if (kind === 'tower') {
    fillRect(x, y, w, h, [214, 226, 238]);
    const tx = cx - 14;
    fillRect(tx, y + 8, 28, h - 8, NAVY);
    fillRect(tx + 4, y + 4, 20, 4, NAVY);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        fillRect(tx + 4 + c * 8, y + 14 + r * 7, 4, 4, GOLD);
      }
    }
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      line(
        Math.round(tx + 24 + Math.cos(ang) * 6), Math.round(y + 24 + Math.sin(ang) * 6),
        Math.round(tx + 24 + Math.cos(ang) * 15), Math.round(y + 24 + Math.sin(ang) * 15),
        ORANGE, 2,
      );
    }
    filledCircle(tx + 24, y + 24, 4, RED);
  } else if (kind === 'chart') {
    fillRect(x, y, w, h, WHITE);
    hline(x + 10, x + w - 10, y + h - 12, GREY);
    vline(x + 10, y + 8, y + h - 12, GREY);
    const pts: Array<[number, number]> = [
      [16, 14], [48, 18], [80, 16], [112, 26], [144, 24], [176, 36], [208, 34], [240, 46],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      line(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], RED, 3);
    }
    line(x + 240, y + 46, x + 252, y + 40, RED, 3);
    line(x + 252, y + 40, x + 244, y + 40, RED, 3);
    line(x + 252, y + 40, x + 252, y + 48, RED, 3);
    drawText('S+P 500 -3.7%', x + 16, y + h - 10, 1, RED);
  } else if (kind === 'stars') {
    fillRect(x, y, w, h, NAVY);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
      filledCircle(
        Math.round(cx + Math.cos(ang) * 16), Math.round(cy + Math.sin(ang) * 16), 2, GOLD,
      );
    }
    drawTextCentered('EU', cx - 34, cy - 4, 2, WHITE);
    drawTextCentered('UK', cx + 34, cy - 4, 2, WHITE);
    line(cx - 20, cy, cx - 8, cy, GOLD, 2);
    line(cx + 8, cy, cx + 20, cy, GOLD, 2);
  }
}

// ---------------------------------------------------------------------------
// The front page.
// ---------------------------------------------------------------------------

interface Panel {
  tag: string;
  tagColor: RGB;
  headline: string;
  body: string;
  icon: string;
}

const PANELS: Panel[] = [
  {
    tag: 'POLAND',
    tagColor: RED,
    headline: 'RUSSIAN MISSILES LAND IN POLAND',
    body: 'TWO MISSILES AND A DRONE CRASH IN SOUTH-EAST POLAND DURING A HUGE STRIKE ON UKRAINE. NATO CALLS IT A GRAVE VIOLATION.',
    icon: 'missile',
  },
  {
    tag: 'THE HAGUE',
    tagColor: NAVY,
    headline: 'MYANMAR GUILTY OF GENOCIDE',
    body: 'THE COURT FINDS MYANMAR COMMITTED GENOCIDE AGAINST THE ROHINGYA IN 2017. A FIRST: A STATE HELD RESPONSIBLE.',
    icon: 'scales',
  },
  {
    tag: 'INDIA',
    tagColor: BLUE,
    headline: 'CYCLONE AKVAN HITS ODISHA',
    body: 'AKVAN COMES ASHORE NEAR GOPALPUR WITH WINDS OF 70-80 KM/H. MORE THAN 300,000 PEOPLE EVACUATED. HEAVY RAIN FOLLOWS INLAND.',
    icon: 'cyclone',
  },
  {
    tag: 'RIYADH',
    tagColor: ORANGE,
    headline: 'HOUTHI MISSILE HITS RIYADH TOWER',
    body: 'A HOUTHI MISSILE DAMAGES THE PIF TOWER, HOME OF THE SAUDI WEALTH FUND, BLOWING OUT WINDOWS ON SEVEN FLOORS.',
    icon: 'tower',
  },
  {
    tag: 'MARKETS',
    tagColor: RED,
    headline: 'MARKETS TUMBLE AS AI SHARES SLIDE',
    body: "THE S+P 500 FALLS 3.7% INTO CORRECTION AND TOKYO'S NIKKEI DROPS 5.1% AS AI SHARES SELL OFF. ANTHROPIC SLIDES AFTER ITS RECORD IPO.",
    icon: 'chart',
  },
  {
    tag: 'BRUSSELS',
    tagColor: GREEN,
    headline: 'EU AND UK SIGN NEW DEALS',
    body: 'BRITAIN AND THE EU SIGN DEALS ON FOOD TRADE, CARBON MARKETS AND YOUTH MOBILITY AT THEIR SECOND SUMMIT IN BRUSSELS.',
    icon: 'stars',
  },
];

function drawPanel(p: Panel, x: number, y: number, w: number, h: number): void {
  strokeRect(x, y, w, h, 2, INK);
  fillRect(x + 2, y + 2, w - 4, 7, p.tagColor);
  drawText(p.tag, x + 14, y + 18, 2, p.tagColor);
  const headLines = wrapText(p.headline, w - 28, 3, true);
  let hy = y + 42;
  for (const ln of headLines.slice(0, 2)) {
    drawText(ln, x + 14, hy, 3, INK, true);
    hy += 23;
  }
  const bodyLines = wrapText(p.body, w - 28, 2);
  let by = hy + 6;
  for (const ln of bodyLines.slice(0, 5)) {
    drawText(ln, x + 14, by, 2, INK);
    by += 15;
  }
  drawIcon(p.icon, x + 14, y + h - 62, w - 28, 48);
}

function drawLead(): void {
  const x = 26;
  const y = 148;
  const w = 972;
  const h = 300;
  strokeRect(x, y, w, h, 2, INK);
  drawText('SHENZHEN, CHINA — THE LEAD STORY', x + 14, y + 14, 2, RED);
  drawText('THREE POWERS SIGN', x + 14, y + 42, 4, INK);
  drawText('PEACE DECLARATION', x + 14, y + 74, 4, INK);
  const sub = wrapText('TRUMP, XI AND PUTIN MEET FOR THE FIRST TIME AS A TRIO', 590, 2);
  let sy = y + 116;
  for (const ln of sub) {
    drawText(ln, x + 14, sy, 2, NAVY);
    sy += 16;
  }
  const body = wrapText(
    "THE THREE LEADERS PLEDGE THAT A NUCLEAR WAR 'CANNOT BE WON AND MUST NEVER BE FOUGHT', AND PROMISE TALKS ON CUTTING NUCLEAR RISKS. THE DECLARATION IS SILENT ON UKRAINE AND IRAN, AND SETS NO DATE FOR ARMS TALKS.",
    590,
    2,
  );
  let by = sy + 8;
  for (const ln of body.slice(0, 5)) {
    drawText(ln, x + 14, by, 2, INK);
    by += 15;
  }
  hline(x + 14, x + 604, by + 6, GREY);
  const foot = wrapText(
    'DECLARATION IN FOUR POINTS: UN REFORM, MORE FUEL, COURT IMMUNITY, NUCLEAR DIALOGUE.',
    590,
    2,
  );
  let fy = by + 14;
  for (const ln of foot) {
    drawText(ln, x + 14, fy, 2, RED);
    fy += 15;
  }

  // Illustration: three leaders at a round table, three flags behind them.
  const ix = 648;
  const iy = y + 14;
  const iw = 336;
  const ih = 224;
  fillRect(ix, iy, iw, ih, SKY);
  strokeRect(ix, iy, iw, ih, 2, INK);
  fillRect(ix, iy + ih - 34, iw, 34, GREEN);
  // Flag poles and flags.
  const flagY = iy + 12;
  vline(ix + 56, flagY, flagY + 52, INK);
  drawFlagUS(ix + 58, flagY, 66, 34);
  vline(ix + 168, flagY, flagY + 52, INK);
  drawFlagCN(ix + 170, flagY, 66, 34);
  vline(ix + 280, flagY, flagY + 52, INK);
  drawFlagRU(ix + 282, flagY, 52, 34);
  // Round table.
  filledEllipse(ix + 168, iy + ih - 30, 128, 16, BROWN);
  fillRect(ix + 40, iy + ih - 32, 256, 6, BROWN);
  // Three seated figures.
  const figures: Array<[number, RGB, RGB]> = [
    [76, [40, 60, 110], [210, 190, 160]],
    [168, [150, 30, 30], [230, 200, 160]],
    [260, [40, 40, 44], [225, 190, 150]],
  ];
  for (const [fx, suit, skin] of figures) {
    // Bust: shoulders sloping up to the neck, then a round head.
    fillRect(ix + fx - 22, iy + 112, 44, iy + ih - 34 - (iy + 112), suit);
    filledTriangle(ix + fx - 22, iy + 112, ix + fx + 22, iy + 112, ix + fx, iy + 96, suit);
    filledCircle(ix + fx, iy + 88, 13, skin);
    fillRect(ix + fx - 13, iy + 74, 26, 6, [60, 60, 60]);
  }
  drawTextCentered('THE FIRST TRILATERAL SUMMIT', ix + Math.floor(iw / 2), iy + ih + 10, 2, INK);
}

function drawPage(): void {
  strokeRect(12, 12, 1000, 1000, 3, INK);
  strokeRect(18, 18, 988, 988, 1, INK);

  // Masthead.
  drawTextCentered('THE WORLD TODAY', 512, 32, 8, INK);
  fillRect(26, 98, 972, 5, RED);
  drawTextCentered('FRIDAY, 20 NOVEMBER 2026', 512, 112, 3, INK);
  hline(26, 998, 140, INK);

  drawLead();

  // Two rows of three story panels.
  const pw = 316;
  const ph = 230;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const p = PANELS[r * 3 + c];
      drawPanel(p, 26 + c * (pw + 12), 460 + r * (ph + 12), pw, ph);
    }
  }

  // "Also today" strip.
  const by = 944;
  fillRect(26, by, 972, 60, INK);
  const l1 = 'ALSO TODAY: PERU QUAKE M6.7 • TRUMP DELAYS IRAN CALL TO 2027 • PALISADES VERDICT';
  const l2 = 'BEPICOLOMBO REACHES MERCURY AFTER 8 YEARS • US LOSES MEASLES ELIMINATION STATUS';
  drawTextCentered(l1, 512, by + 10, 2, WHITE);
  drawTextCentered(l2, 512, by + 32, 2, WHITE);
}

// ---------------------------------------------------------------------------

function main(): void {
  drawPage();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? process.argv[2] ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'entry.png');
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
