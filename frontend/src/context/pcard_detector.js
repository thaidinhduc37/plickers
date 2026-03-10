/**
 * pcard_detector.js â€” v3
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * PCARD Detector â€” nháº­n diá»‡n tháº» PCARD 9Ã—9 trong frame camera.
 *
 * Bugs fixed v2â†’v3:
 *   1. fillRatio sai: BFS sample STEP px â†’ count thá»±c < area/STEPÂ²
 *      Fix: nhÃ¢n count * STEPÂ² trÆ°á»›c khi so sÃ¡nh vá»›i area
 *   2. Box blur trÆ°á»›c BFS Ä‘á»ƒ ná»‘i cÃ¡c Ã´ Ä‘en rá»i ráº¡c thÃ nh 1 blob
 *   3. Multi-point cell sampling (5 Ä‘iá»ƒm, Ä‘a sá»‘)
 *   4. Fallback: thá»­ decode tháº³ng vÃ¹ng scan zone nhiá»u tá»‰ lá»‡ crop
 *   5. Adaptive threshold (Otsu) thay vÃ¬ cá»©ng 128
 *   6. Downsample cho tá»‘c Ä‘á»™ xá»­ lÃ½
 *  5. TÃ¬m orientation corner (2x2 tráº¯ng) â†’ xÃ¡c Ä‘á»‹nh hÆ°á»›ng
 *  6. Decode card_id tá»« 8 data bits
 *
 * KhÃ´ng cáº§n thÆ° viá»‡n ngoÃ i â€” cháº¡y thuáº§n canvas API.
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GRID = 9;
const WARP_SIZE = 270; // internal warp resolution (30px/cell)
const CELL_PX = WARP_SIZE / GRID; // 30px

// DATA_POSITIONS — khớp CHÍNH XÁC với backend card_service.py
// 8 positions: bits 0-5 (top row) + bits 6-7 (right col)
// bits[0..6] = 7 data bits (MSB first)
// bits[7]    = even parity
const DATA_POSITIONS = [
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7],
  [0, 8], // bits 0-5
  [1, 8],
  [2, 8], // bits 6-7
];

// Orientation corner cells (luÃ´n TRáº®NG khi Ä‘Ãºng hÆ°á»›ng)
const ORIENTATION_CELLS = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

// Answer mapping: k rotations CW applied during normalize â†’ original orientation
// Matches backend: k=0: A | k=1: B | k=2: C | k=3: D
const ANSWER_MAP = ["A", "B", "C", "D"];

// â”€â”€ Otsu threshold â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function otsuThreshold(gray, n) {
  const hist = new Int32Array(256);
  for (let i = 0; i < n; i++) hist[gray[i]]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0,
    wB = 0,
    varMax = 0,
    thresh = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > varMax) {
      varMax = v;
      thresh = t;
    }
  }
  return thresh;
}

// â”€â”€ Downsample RGBA â†’ grayscale at 1/factor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function downsampleGray(rgba, sw, sh, factor) {
  const dw = Math.floor(sw / factor);
  const dh = Math.floor(sh / factor);
  const gray = new Uint8Array(dw * dh);
  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      const j = (dy * factor * sw + dx * factor) * 4;
      gray[dy * dw + dx] =
        (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
    }
  }
  return { gray, dw, dh };
}

// â”€â”€ Box blur (x then y pass) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function boxBlur(gray, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let s = 0,
      cnt = 0;
    for (let x = -r; x < w; x++) {
      if (x + r < w) {
        s += gray[y * w + x + r];
        cnt++;
      }
      if (x - r - 1 >= 0) {
        s -= gray[y * w + x - r - 1];
        cnt--;
      }
      if (x >= 0) tmp[y * w + x] = s / cnt;
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0,
      cnt = 0;
    for (let y = -r; y < h; y++) {
      if (y + r < h) {
        s += tmp[(y + r) * w + x];
        cnt++;
      }
      if (y - r - 1 >= 0) {
        s -= tmp[(y - r - 1) * w + x];
        cnt--;
      }
      if (y >= 0) out[y * w + x] = Math.round(s / cnt);
    }
  }
  return out;
}

// â”€â”€ Rotate 9Ã—9 grid 90Â° CW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function rotateGridCW(g) {
  const n = g.length;
  const r = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) r[j][n - 1 - i] = g[i][j];
  return r;
}

// â”€â”€ bits â†’ card_id (matches backend bits_to_card_id) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function bitsToCardId(bits) {
  if (bits.length !== 8) return -1;
  const data = bits.slice(0, 7);
  const parity = bits[7];
  if (data.reduce((a, b) => a + b, 0) % 2 !== parity) return -1;
  let val = 0;
  for (const b of data) val = (val << 1) | b;
  return val >= 1 ? val : -1;
}

// â”€â”€ Decode grid: try 4 rotations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function decodeGrid(grid) {
  // Center finder must be white (rotation-invariant check)
  if (grid[4][4] !== 0) return null;

  // Overall grid must be mostly dark — PCARD starts all-black with few white cuts
  let darkCount = 0;
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) darkCount += grid[r][c];
  if (darkCount < 52) return null; // < 52/81 (~64%) dark → not a PCARD

  let cur = grid;
  for (let k = 0; k < 4; k++) {
    const tlOk = ORIENTATION_CELLS.every(([r, c]) => cur[r][c] === 0);
    if (tlOk) {
      // Cells immediately outside the 2×2 corner must be dark
      // [0,2],[1,2] = right edge; [2,0],[2,1] = bottom edge
      const borderOk =
        cur[0][2] === 1 &&
        cur[1][2] === 1 &&
        cur[2][0] === 1 &&
        cur[2][1] === 1;
      if (borderOk) {
        const bits = DATA_POSITIONS.map(([r, c]) => cur[r][c]);
        const cardId = bitsToCardId(bits);
        if (cardId > 0) return { cardId, answer: ANSWER_MAP[k] };
      }
    }
    cur = rotateGridCW(cur);
  }
  return null;
}

// â”€â”€ Read 9Ã—9 grid from raw RGBA data region â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function readGridFromRGBA(data, imgW, imgH, x0, y0, size) {
  const cw = size / GRID;
  const ch = size / GRID;
  const grid = [];
  for (let r = 0; r < GRID; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID; c++) {
      const samples = [
        [x0 + (c + 0.5) * cw, y0 + (r + 0.5) * ch],
        [x0 + (c + 0.25) * cw, y0 + (r + 0.25) * ch],
        [x0 + (c + 0.75) * cw, y0 + (r + 0.25) * ch],
        [x0 + (c + 0.25) * cw, y0 + (r + 0.75) * ch],
        [x0 + (c + 0.75) * cw, y0 + (r + 0.75) * ch],
      ];
      let dark = 0;
      for (const [px, py] of samples) {
        const xi = Math.max(0, Math.min(imgW - 1, Math.round(px)));
        const yi = Math.max(0, Math.min(imgH - 1, Math.round(py)));
        const idx = (yi * imgW + xi) * 4;
        const br =
          (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
        if (br < 128) dark++;
      }
      grid[r][c] = dark >= 3 ? 1 : 0;
    }
  }
  return grid;
}

// â”€â”€ Bilinear warp (quad â†’ WARP_SIZE square) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function warpQuadToCanvas(srcData, srcW, srcH, quad, dstCtx) {
  const [p0, p1, p2, p3] = quad;
  const dst = dstCtx.createImageData(WARP_SIZE, WARP_SIZE);
  for (let dy = 0; dy < WARP_SIZE; dy++) {
    const ty = dy / (WARP_SIZE - 1);
    for (let dx = 0; dx < WARP_SIZE; dx++) {
      const tx = dx / (WARP_SIZE - 1);
      const sx =
        (1 - ty) * ((1 - tx) * p0[0] + tx * p1[0]) +
        ty * ((1 - tx) * p3[0] + tx * p2[0]);
      const sy =
        (1 - ty) * ((1 - tx) * p0[1] + tx * p1[1]) +
        ty * ((1 - tx) * p3[1] + tx * p2[1]);
      const xi = Math.max(0, Math.min(srcW - 1, Math.round(sx)));
      const yi = Math.max(0, Math.min(srcH - 1, Math.round(sy)));
      const si = (yi * srcW + xi) * 4,
        di = (dy * WARP_SIZE + dx) * 4;
      dst.data[di] = srcData[si];
      dst.data[di + 1] = srcData[si + 1];
      dst.data[di + 2] = srcData[si + 2];
      dst.data[di + 3] = 255;
    }
  }
  dstCtx.putImageData(dst, 0, 0);
}

// â”€â”€ Try decode region defined by a quad â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function tryDecodeQuad(srcData, srcW, srcH, quad, warpCtx) {
  warpQuadToCanvas(srcData, srcW, srcH, quad, warpCtx);
  const wd = warpCtx.getImageData(0, 0, WARP_SIZE, WARP_SIZE);
  const grid = readGridFromRGBA(wd.data, WARP_SIZE, WARP_SIZE, 0, 0, WARP_SIZE);
  const res = decodeGrid(grid);
  if (!res) return null;
  // Confidence: contrast between white cells (orientation corner + finder)
  // and cells that are guaranteed dark in any valid PCARD (interior non-data cells)
  const WHITE_SAMPLE = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [4, 4],
  ];
  const DARK_SAMPLE = [
    [2, 2],
    [3, 3],
    [5, 5],
    [6, 6],
    [2, 6],
    [6, 2],
    [3, 5],
    [5, 3],
  ];
  const sampleBr = (cells) => {
    let s = 0;
    for (const [r, c] of cells) {
      const px = Math.round(c * CELL_PX + CELL_PX * 0.5);
      const py = Math.round(r * CELL_PX + CELL_PX * 0.5);
      const i = (py * WARP_SIZE + px) * 4;
      s +=
        (wd.data[i] * 299 + wd.data[i + 1] * 587 + wd.data[i + 2] * 114) / 1000;
    }
    return s / cells.length;
  };
  const contrast = (sampleBr(WHITE_SAMPLE) - sampleBr(DARK_SAMPLE)) / 255;
  return { ...res, confidence: Math.max(0, Math.min(1.0, contrast)) };
}

// â”€â”€ Find square blob candidates (BFS on blurred binary) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function findSquareCandidates(gray, w, h, thresh, minSizePx) {
  const STEP = 3;
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bin[i] = gray[i] < thresh ? 1 : 0;

  const visited = new Uint8Array(w * h);
  const cands = [];
  const MIN_A = minSizePx * minSizePx * 0.2;
  const MAX_A = w * h * 0.85;
  const stack = [];

  for (let sy = 0; sy < h; sy += STEP) {
    for (let sx = 0; sx < w; sx += STEP) {
      const i0 = sy * w + sx;
      if (!bin[i0] || visited[i0]) continue;
      stack.length = 0;
      stack.push(i0);
      visited[i0] = 1;
      let x0 = sx,
        x1 = sx,
        y0 = sy,
        y1 = sy,
        cnt = 0;
      while (stack.length) {
        const cur = stack.pop(),
          cx = cur % w,
          cy = (cur / w) | 0;
        if (cx < x0) x0 = cx;
        if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy;
        if (cy > y1) y1 = cy;
        cnt++;
        if (cnt > 150000) break;
        for (const n of [
          cur - STEP,
          cur + STEP,
          cur - w * STEP,
          cur + w * STEP,
        ]) {
          if (n >= 0 && n < bin.length && bin[n] && !visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }
      const bw = x1 - x0,
        bh = y1 - y0,
        area = bw * bh;
      if (area < MIN_A || area > MAX_A) continue;
      const ar = bw / bh;
      if (ar < 0.5 || ar > 2.0) continue;
      // fillRatio fix: BFS counts at STEP resolution, compensate
      if ((cnt * STEP * STEP) / area < 0.2) continue;
      cands.push({ x: x0, y: y0, w: bw, h: bh, area });
    }
  }
  cands.sort((a, b) => b.area - a.area);
  return cands.slice(0, 8);
}

// â”€â”€ Main Detector Class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export class PCardDetector {
  constructor() {
    this._warpCanvas = null;
    this._warpCtx = null;
    this._init();
  }

  _init() {
    if (typeof OffscreenCanvas !== "undefined") {
      this._warpCanvas = new OffscreenCanvas(WARP_SIZE, WARP_SIZE);
    } else {
      this._warpCanvas = document.createElement("canvas");
      this._warpCanvas.width = WARP_SIZE;
      this._warpCanvas.height = WARP_SIZE;
    }
    this._warpCtx = this._warpCanvas.getContext("2d", {
      willReadFrequently: true,
    });
  }

  /**
   * Detect PCARD trong frame.
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   * @returns {{ cardId, answer, confidence, bbox } | null}
   */
  detect(canvas, ctx) {
    const W = canvas.width,
      H = canvas.height;
    const fullData = ctx.getImageData(0, 0, W, H);

    // Downsample for fast blob detection (max ~480px side)
    const SCALE = Math.max(1, Math.floor(Math.min(W, H) / 480));
    const { gray: gDS, dw, dh } = downsampleGray(fullData.data, W, H, SCALE);

    // Blur to bridge gaps between black cells
    const blurR = Math.max(3, Math.round(Math.min(dw, dh) * 0.015));
    const blurred = boxBlur(gDS, dw, dh, blurR);

    const thresh = otsuThreshold(blurred, dw * dh);
    const minSizeDS = Math.min(dw, dh) * 0.07;
    const cands = findSquareCandidates(blurred, dw, dh, thresh, minSizeDS);

    for (const c of cands) {
      const m = Math.min(c.w, c.h) * 0.05 * SCALE;
      const fx = c.x * SCALE,
        fy = c.y * SCALE,
        fw = c.w * SCALE,
        fh = c.h * SCALE;
      const quad = [
        [fx - m, fy - m],
        [fx + fw + m, fy - m],
        [fx + fw + m, fy + fh + m],
        [fx - m, fy + fh + m],
      ];
      const result = tryDecodeQuad(fullData.data, W, H, quad, this._warpCtx);
      if (result) return { ...result, bbox: { x: fx, y: fy, w: fw, h: fh } };
    }

    // Fallback: try direct crop of scan zone at multiple scales
    const sz = Math.min(W, H) * 0.82;
    const ox0 = (W - sz) / 2,
      oy0 = (H - sz) / 2;
    for (const f of [0.9, 0.75, 0.6, 0.45, 0.98]) {
      const s = sz * f;
      const ox = ox0 + (sz - s) / 2,
        oy = oy0 + (sz - s) / 2;
      const quad = [
        [ox, oy],
        [ox + s, oy],
        [ox + s, oy + s],
        [ox, oy + s],
      ];
      const result = tryDecodeQuad(fullData.data, W, H, quad, this._warpCtx);
      if (result && result.confidence > 0.6)
        return { ...result, bbox: { x: ox, y: oy, w: s, h: s } };
    }

    return null;
  }
}

export default PCardDetector;
