/**
 * pcard_detector.js — PCARD v8 · High-Speed Wide-Angle Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * Cải tiến so với v7:
 *  1. LOCAL adaptive threshold (thay Otsu toàn ảnh) — chịu được nền không đồng đều
 *  2. Perspective correction — warp thẻ nghiêng về vuông trước khi decode
 *  3. MIN_VOTES = 1 — 1 frame rõ là đủ khi lia nhanh (v7: 2)
 *  4. ASPECT filter nới rộng 0.45–2.2 — bắt thẻ nghiêng 40°+
 *  5. BLOB_MIN_AREA_PCT = 0.25 — bắt thẻ nhỏ/xa hơn (v7: 1.0)
 *  6. Fallback thông minh: multi-scale blob retry, bỏ brute-force sliding window
 *  7. getLastBlobRects() — overlay API cho ScannerPage vẽ highlight
 */
"use strict";

// ─── Card constants (khớp card_service.py) ────────────────────────────────────
const GRID = 7;
const ORIENTATION_CELLS = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
];
const BORDER_GUARDS = [
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 1],
  [3, 2],
  [3, 3],
  [3, 4],
  [3, 5],
  [4, 2],
  [4, 3],
  [4, 5],
  [5, 3],
  [5, 4],
];
const DATA_POSITIONS = [
  [1, 4],
  [1, 5],
  [2, 5],
  [4, 1],
  [5, 1],
  [5, 2],
  [4, 4],
  [5, 5],
];
const ANSWER_MAP = ["A", "B", "C", "D"];

// ─── Tuning ────────────────────────────────────────────────────────────────────
const CONFIDENCE_MIN = 0.55; // cao hơn v7 (0.40) để giảm false positive
const MAX_BLOBS = 30; // tăng từ 20 để bắt nhiều thẻ hơn
const BLOB_MIN_AREA_PCT = 0.25; // hạ từ 1.0 để bắt thẻ nhỏ/xa
const BLOB_MIN_PX = 28; // tối thiểu 28×28 px sau downsample
const ASPECT_MIN = 0.45; // nới từ 0.65 — bắt thẻ nghiêng 40°+
const ASPECT_MAX = 2.2; // nới từ 1.5
const CELL_SAMPLE_R = 2; // 5×5 majority vote / cell
const TARGET_W = 640;

// ─── Temporal buffer ──────────────────────────────────────────────────────────
const BUFFER_WINDOW_MS = 1500; // giảm từ 2500ms — phản hồi nhanh hơn
const MIN_VOTES = 1; // 1 frame rõ là đủ (v7: 2)

// ─── Decode helpers ───────────────────────────────────────────────────────────
function bitsToCardId(bits) {
  if (bits.length !== 8) return -1;
  const parityOk = bits.slice(0, 7).reduce((s, b) => s + b, 0) % 2 === bits[7];
  if (!parityOk) return -1;
  let val = 0;
  for (let i = 0; i < 7; i++) val |= bits[i] << (6 - i);
  return val >= 1 && val <= 100 ? val : -1;
}

function rot90CW(g) {
  const n = GRID,
    r = Array.from({ length: n }, () => new Uint8Array(n));
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) r[col][n - 1 - row] = g[row][col];
  return r;
}

function rotateK(g, k) {
  let r = g;
  for (let i = 0; i < k % 4; i++) r = rot90CW(r);
  return r;
}

function calcConfidence(rot) {
  const fixedWhite = ORIENTATION_CELLS;
  const fixedBlack = [...BORDER_GUARDS];
  for (let i = 0; i < GRID; i++) {
    fixedBlack.push([0, i], [6, i]);
    if (i > 0 && i < 6) fixedBlack.push([i, 0], [i, 6]);
  }
  let ok = 0;
  const total = fixedWhite.length + fixedBlack.length;
  for (const [r, c] of fixedWhite) if (rot[r][c] === 0) ok++;
  for (const [r, c] of fixedBlack) if (rot[r][c] === 1) ok++;
  return ok / total;
}

// ─── Step 1: Adaptive local threshold (thay Otsu toàn ảnh) ───────────────────
/**
 * Dùng integral image để tính mean vùng 48×48 xung quanh mỗi pixel.
 * Pixel đen nếu giá trị < mean - OFFSET.
 * Chịu được nền không đồng đều (bàn gỗ, bóng người, đèn không đều).
 */
function binarize(imageData, width, height) {
  const S = Math.max(1, Math.floor(width / TARGET_W));
  const sw = Math.floor(width / S);
  const sh = Math.floor(height / S);
  const d = imageData.data;

  // Grayscale downsample
  const gray = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      let sum = 0,
        cnt = 0;
      for (let dy = 0; dy < S && y * S + dy < height; dy++)
        for (let dx = 0; dx < S && x * S + dx < width; dx++) {
          const i = ((y * S + dy) * width + (x * S + dx)) * 4;
          sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          cnt++;
        }
      gray[y * sw + x] = cnt ? Math.round(sum / cnt) : 255;
    }

  // Integral image
  const integral = new Float64Array((sw + 1) * (sh + 1));
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++)
      integral[(y + 1) * (sw + 1) + (x + 1)] =
        gray[y * sw + x] +
        integral[y * (sw + 1) + (x + 1)] +
        integral[(y + 1) * (sw + 1) + x] -
        integral[y * (sw + 1) + x];

  // Adaptive threshold: so với mean vùng HALF*2 xung quanh, offset -8
  const HALF = 24,
    OFFSET = 8;
  const binary = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const x0 = Math.max(0, x - HALF),
        y0 = Math.max(0, y - HALF);
      const x1 = Math.min(sw - 1, x + HALF),
        y1 = Math.min(sh - 1, y + HALF);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * (sw + 1) + (x1 + 1)] -
        integral[y0 * (sw + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (sw + 1) + x0] +
        integral[y0 * (sw + 1) + x0];
      binary[y * sw + x] = gray[y * sw + x] < sum / area - OFFSET ? 1 : 0;
    }
  }

  return { binary, sw, sh };
}

// ─── Step 2: BFS blob detection ───────────────────────────────────────────────
function detectContours(binary, sw, sh, minAreaPct = BLOB_MIN_AREA_PCT) {
  const minArea = Math.max(
    BLOB_MIN_PX * BLOB_MIN_PX,
    Math.ceil((sw * sh * minAreaPct) / 100),
  );
  const visited = new Uint8Array(sw * sh);
  const blobs = [];

  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      if (!binary[sy * sw + sx] || visited[sy * sw + sx]) continue;
      const queue = [sy * sw + sx];
      visited[sy * sw + sx] = 1;
      let head = 0;
      let minX = sx,
        maxX = sx,
        minY = sy,
        maxY = sy,
        area = 0;

      while (head < queue.length) {
        const p = queue[head++];
        const px = p % sw,
          py = (p - px) / sw;
        area++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        if (px > 0) {
          const np = p - 1;
          if (!visited[np] && binary[np]) {
            visited[np] = 1;
            queue.push(np);
          }
        }
        if (px < sw - 1) {
          const np = p + 1;
          if (!visited[np] && binary[np]) {
            visited[np] = 1;
            queue.push(np);
          }
        }
        if (py > 0) {
          const np = p - sw;
          if (!visited[np] && binary[np]) {
            visited[np] = 1;
            queue.push(np);
          }
        }
        if (py < sh - 1) {
          const np = p + sw;
          if (!visited[np] && binary[np]) {
            visited[np] = 1;
            queue.push(np);
          }
        }
      }

      if (area >= minArea) blobs.push({ minX, maxX, minY, maxY, area });
    }
  }

  blobs.sort((a, b) => b.area - a.area);
  return blobs.slice(0, MAX_BLOBS);
}

function filterSquareContours(blobs) {
  return blobs.filter((b) => {
    const asp = (b.maxX - b.minX + 1) / (b.maxY - b.minY + 1);
    return asp >= ASPECT_MIN && asp <= ASPECT_MAX;
  });
}

// ─── Step 3a: Sample grid thẳng ───────────────────────────────────────────────
function sampleGrid(binary, sw, sh, blob) {
  const { minX, maxX, minY, maxY } = blob;
  const bw = maxX - minX + 1,
    bh = maxY - minY + 1;
  if (bw < GRID * 3 || bh < GRID * 3) return null;
  const cw = bw / GRID,
    ch = bh / GRID;
  const R = CELL_SAMPLE_R;
  const grid = Array.from({ length: GRID }, () => new Uint8Array(GRID));
  for (let gr = 0; gr < GRID; gr++) {
    for (let gc = 0; gc < GRID; gc++) {
      const cx = Math.round(minX + (gc + 0.5) * cw);
      const cy = Math.round(minY + (gr + 0.5) * ch);
      let dark = 0,
        total = 0;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const nx = cx + dx,
            ny = cy + dy;
          if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
            dark += binary[ny * sw + nx];
            total++;
          }
        }
      grid[gr][gc] = total > 0 && dark / total >= 0.45 ? 1 : 0;
    }
  }
  return grid;
}

// ─── Step 3b: Perspective-corrected sample ────────────────────────────────────
/**
 * Tìm 4 góc bằng cực trị x+y / x-y trong vùng blob.
 * Warp về lưới (GRID*8)×(GRID*8) bằng bilinear interpolation.
 * Rồi sample GRID×GRID từ ảnh warped.
 * → Xử lý thẻ nghiêng lên đến ~45°.
 */
function sampleGridWarped(binary, sw, sh, blob) {
  const { minX, maxX, minY, maxY } = blob;
  if (maxX - minX + 1 < GRID * 3 || maxY - minY + 1 < GRID * 3) return null;

  let tlV = Infinity,
    tlP = null;
  let trV = -Infinity,
    trP = null;
  let brV = -Infinity,
    brP = null;
  let blV = Infinity,
    blP = null;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!binary[y * sw + x]) continue;
      const s = x + y,
        dv = x - y;
      if (s < tlV) {
        tlV = s;
        tlP = { x, y };
      }
      if (dv > trV) {
        trV = dv;
        trP = { x, y };
      }
      if (s > brV) {
        brV = s;
        brP = { x, y };
      }
      if (dv < blV) {
        blV = dv;
        blP = { x, y };
      }
    }
  }
  if (!tlP || !trP || !brP || !blP) return null;

  const WARP_SZ = GRID * 8; // 56×56
  const warped = new Uint8Array(WARP_SZ * WARP_SZ);

  for (let wy = 0; wy < WARP_SZ; wy++) {
    const tv = wy / (WARP_SZ - 1);
    for (let wx = 0; wx < WARP_SZ; wx++) {
      const tu = wx / (WARP_SZ - 1);
      const sx = Math.round(
        (1 - tu) * (1 - tv) * tlP.x +
          tu * (1 - tv) * trP.x +
          (1 - tu) * tv * blP.x +
          tu * tv * brP.x,
      );
      const sy = Math.round(
        (1 - tu) * (1 - tv) * tlP.y +
          tu * (1 - tv) * trP.y +
          (1 - tu) * tv * blP.y +
          tu * tv * brP.y,
      );
      if (sx >= 0 && sx < sw && sy >= 0 && sy < sh)
        warped[wy * WARP_SZ + wx] = binary[sy * sw + sx];
    }
  }

  const cw = WARP_SZ / GRID;
  const grid = Array.from({ length: GRID }, () => new Uint8Array(GRID));
  const R = Math.max(1, Math.floor(cw * 0.3));
  for (let gr = 0; gr < GRID; gr++) {
    for (let gc = 0; gc < GRID; gc++) {
      const cx = Math.round((gc + 0.5) * cw),
        cy = Math.round((gr + 0.5) * cw);
      let dark = 0,
        total = 0;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const nx = cx + dx,
            ny = cy + dy;
          if (nx >= 0 && nx < WARP_SZ && ny >= 0 && ny < WARP_SZ) {
            dark += warped[ny * WARP_SZ + nx];
            total++;
          }
        }
      grid[gr][gc] = total > 0 && dark / total >= 0.45 ? 1 : 0;
    }
  }
  return grid;
}

// ─── Step 4: Decode card ──────────────────────────────────────────────────────
function decodeCard(grid) {
  if (!grid) return null;
  for (let i = 0; i < GRID; i++)
    if (!grid[0][i] || !grid[6][i] || !grid[i][0] || !grid[i][6]) return null;
  for (let k = 0; k < 4; k++) {
    const rot = rotateK(grid, k);
    if (!ORIENTATION_CELLS.every(([r, c]) => rot[r][c] === 0)) continue;
    if (!BORDER_GUARDS.every(([r, c]) => rot[r][c] === 1)) continue;
    const bits = DATA_POSITIONS.map(([r, c]) => rot[r][c]);
    const cardId = bitsToCardId(bits);
    if (cardId < 1) continue;
    const confidence = calcConfidence(rot);
    if (confidence < CONFIDENCE_MIN) continue;
    return { cardId, answer: ANSWER_MAP[k], confidence, k };
  }
  return null;
}

// ─── Step 5: Try straight + warped per blob ───────────────────────────────────
function tryDecodeBlob(binary, sw, sh, blob) {
  const r1 = decodeCard(sampleGrid(binary, sw, sh, blob));
  if (r1) return r1;
  const r2 = decodeCard(sampleGridWarped(binary, sw, sh, blob));
  return r2 || null;
}

// ─── Step 6: Fallback — retry với blob nhỏ hơn ───────────────────────────────
function fallbackSmallBlob(binary, sw, sh, seenIds) {
  const blobs = filterSquareContours(detectContours(binary, sw, sh, 0.08));
  const found = [];
  for (const blob of blobs) {
    const r = tryDecodeBlob(binary, sw, sh, blob);
    if (!r || seenIds.has(r.cardId)) continue;
    seenIds.add(r.cardId);
    found.push(r);
  }
  return found;
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────
function processFrame(imageData, width, height) {
  const { binary, sw, sh } = binarize(imageData, width, height);
  const S = Math.max(1, Math.floor(width / TARGET_W)); // scale factor cho overlay

  const blobs = filterSquareContours(detectContours(binary, sw, sh));
  const seenIds = new Set();
  const results = [];
  const blobRects = [];

  for (const blob of blobs) {
    const r = tryDecodeBlob(binary, sw, sh, blob);
    if (!r || seenIds.has(r.cardId)) continue;
    seenIds.add(r.cardId);
    results.push(r);
    blobRects.push({
      cardId: r.cardId,
      answer: r.answer,
      confidence: r.confidence,
      x: blob.minX * S,
      y: blob.minY * S,
      w: (blob.maxX - blob.minX + 1) * S,
      h: (blob.maxY - blob.minY + 1) * S,
    });
  }

  if (results.length === 0) {
    results.push(...fallbackSmallBlob(binary, sw, sh, seenIds));
  }

  return { results, blobRects };
}

// ─── Public API ────────────────────────────────────────────────────────────────
class PCardDetector {
  constructor() {
    this.GRID = GRID;
    this.ORIENTATION_CELLS = ORIENTATION_CELLS;
    this.BORDER_GUARDS = BORDER_GUARDS;
    this.DATA_POSITIONS = DATA_POSITIONS;
    this.ANSWER_MAP = ANSWER_MAP;
    this.CONFIDENCE_MIN = CONFIDENCE_MIN;
    /** @type {Map<number, Array<{answer:string, confidence:number, ts:number}>>} */
    this._buffer = new Map();
    this._lastRects = [];
  }

  detect(source, ctx) {
    let imageData;
    if (source instanceof HTMLVideoElement) {
      const canvas = ctx.canvas;
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      ctx.drawImage(source, 0, 0);
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else if (source instanceof HTMLCanvasElement) {
      imageData = ctx.getImageData(0, 0, source.width, source.height);
    } else {
      imageData = source;
    }
    const { results, blobRects } = processFrame(
      imageData,
      imageData.width,
      imageData.height,
    );
    this._lastRects = blobRects;
    for (const r of results)
      this.updateDetectionBuffer(r.cardId, r.answer, r.confidence);
    return results;
  }

  detectOne(source, ctx) {
    const results = this.detect(source, ctx);
    return results.length ? results[0] : null;
  }

  /** Trả về bounding boxes frame gần nhất để ScannerPage vẽ overlay */
  getLastBlobRects() {
    return this._lastRects;
  }

  updateDetectionBuffer(cardId, answer, confidence) {
    const now = Date.now();
    const cutoff = now - BUFFER_WINDOW_MS;
    let entries = this._buffer.get(cardId);
    if (!entries) {
      entries = [];
      this._buffer.set(cardId, entries);
    }
    let i = 0;
    while (i < entries.length && entries[i].ts < cutoff) i++;
    if (i > 0) entries.splice(0, i);
    entries.push({ answer, confidence, ts: now });
  }

  computeStableResults(minVotes = MIN_VOTES, windowMs = BUFFER_WINDOW_MS) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const out = new Map();
    for (const [cardId, entries] of this._buffer) {
      const recent = entries.filter((e) => e.ts >= cutoff);
      if (recent.length < minVotes) continue;
      const weight = { A: 0, B: 0, C: 0, D: 0 };
      for (const e of recent) weight[e.answer] += e.confidence;
      const best = ["A", "B", "C", "D"].reduce((a, b) =>
        weight[b] > weight[a] ? b : a,
      );
      const bestVotes = recent.filter((e) => e.answer === best).length;
      if (bestVotes < minVotes) continue;
      const totalW = Object.values(weight).reduce((s, v) => s + v, 0);
      out.set(cardId, {
        answer: best,
        votes: bestVotes,
        confidence: totalW > 0 ? weight[best] / totalW : 0,
      });
    }
    return out;
  }

  clearBuffer() {
    this._buffer.clear();
  }
  clearCard(cardId) {
    this._buffer.delete(cardId);
  }
}

if (typeof module !== "undefined") module.exports = { PCardDetector };
export { PCardDetector };
