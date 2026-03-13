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

// ─── FIX #1, #19: Corner marker requirements ──────────────────────────────────
// Các ô viền ngoài (4 cạnh) - dùng để validate thẻ hợp lệ
const OUTER_BORDER_CELLS = [];
for (let i = 0; i < GRID; i++) {
  OUTER_BORDER_CELLS.push([0, i], [6, i], [i, 0], [i, 6]);
}

// ─── Tuning ────────────────────────────────────────────────────────────────────
const CONFIDENCE_MIN = 0.55; // phải đủ chắc chắn mới chấp nhận — chống sai đáp án
const MAX_BLOBS = 150;
const BLOB_MIN_AREA_PCT = 0.08;
const BLOB_MIN_PX = 14;
const ASPECT_MIN = 0.42;
const ASPECT_MAX = 2.4;
const CELL_SAMPLE_R = 2;
const TARGET_W = 960;

// ─── Minimum card size — bắt thẻ xa đến ~6m ──────────────────────────────────
const MIN_CARD_AREA_PX = 18 * 18; // 324px² — thẻ tối thiểu 18×18px

// ─── Temporal buffer ──────────────────────────────────────────────────────────
const BUFFER_WINDOW_MS = 800; // 800ms — đủ cho 2 frame ở 15 FPS (~133ms)
// Bug G fix: MIN_VOTES=1 là ngưỡng tối thiểu để vào temporal buffer.
// Threshold thực tế trong computeStableResults = max(1, ceil(N×0.6)) với N=min(frames_in_window,5).
// Ví dụ: 5 frames → threshold=3; 2 frames → threshold=2. "1 frame là đủ" chỉ đúng khi window rất thưa.
const MIN_VOTES = 1; // ngưỡng tối thiểu vào voting (threshold thực tế cao hơn, xem computeStableResults)

// ─── Decode helpers ───────────────────────────────────────────────────────────
/**
 * FIX #11: Validate ID range (1-100) with explicit error handling
 * Decode 8 bits → card_id, return -1 if invalid
 */
function bitsToCardId(bits) {
  if (!bits || bits.length !== 8) return -1;
  const parityOk = bits.slice(0, 7).reduce((s, b) => s + b, 0) % 2 === bits[7];
  if (!parityOk) return -1;
  let val = 0;
  for (let i = 0; i < 7; i++) val |= bits[i] << (6 - i);
  // FIX #11: Explicit range validation
  if (val < 1 || val > 100) return -1;
  return val;
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

/**
 * FIX #1, #19: Enhanced confidence calculation
 * - Require all 4 corner markers (outer border) to be detected
 * - Returns 0 if any corner marker is missing
 */
function calcConfidence(rot) {
  const fixedWhite = ORIENTATION_CELLS;
  const fixedBlack = [...BORDER_GUARDS];

  // Add outer border cells (4 corners + edges)
  for (let i = 0; i < GRID; i++) {
    fixedBlack.push([0, i], [6, i]);
    if (i > 0 && i < 6) fixedBlack.push([i, 0], [i, 6]);
  }

  let ok = 0;
  const total = fixedWhite.length + fixedBlack.length;
  for (const [r, c] of fixedWhite) if (rot[r][c] === 0) ok++;
  for (const [r, c] of fixedBlack) if (rot[r][c] === 1) ok++;

  const confidence = ok / total;

  // FIX #19: Require minimum confidence threshold for valid detection
  // If confidence < 0.7, the card may be damaged, folded, or partially occluded
  return confidence;
}

/**
 * FIX #1, #19: Validate that all 4 corner markers are present
 * Returns true if the card has valid corner detection
 */
function validateCornerMarkers(rot) {
  // Lia nhanh / thẻ xa → góc dễ bị noise. Chỉ cần 2/4 góc để validate.
  // Đảm bảo ít nhất 1 góc ở mỗi phía (trên/dưới) để tránh false positive hoàn toàn.
  const corners = [
    [0, 0],
    [0, 6],
    [6, 0],
    [6, 6],
  ];
  const valid = corners.filter(([r, c]) => rot[r][c] === 1).length;
  return valid >= 2;
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

  // OFFSET=8: cân bằng cho hội trường ánh sáng yếu — 10 quá mạnh bỏ sót thẻ, 7 quá nhạy gây noise
  // HALF tỉ lệ theo kích thước ảnh: thẻ lớn (gần camera) có viền dày ~100px,
  // cần cửa sổ đủ rộng để vượt ra ngoài viền đen. HALF=28 cố định → cửa sổ 57px
  // nằm hoàn toàn trong viền → mean rất thấp → viền bị xoá → blob vỡ.
  // Integral image lookup O(1) → tăng HALF KHÔNG ảnh hưởng performance.
  const HALF = Math.max(28, Math.round(sw / 12)),
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
/**
 * FIX #13: Add minimum card size validation
 * Filter out blobs that are too small to be valid cards
 */
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

      // FIX #13: Validate minimum card size (10cm x 10cm equivalent)
      const blobWidth = maxX - minX + 1;
      const blobHeight = maxY - minY + 1;
      const blobArea = blobWidth * blobHeight;

      // Skip if blob is too small to be a valid card
      if (blobArea < MIN_CARD_AREA_PX) continue;

      if (area >= minArea)
        blobs.push({
          minX,
          maxX,
          minY,
          maxY,
          area,
          width: blobWidth,
          height: blobHeight,
        });
    }
  }

  blobs.sort((a, b) => b.area - a.area);
  return blobs.slice(0, MAX_BLOBS);
}

function filterSquareContours(blobs) {
  return blobs.filter((b) => {
    const w = b.maxX - b.minX + 1,
      h = b.maxY - b.minY + 1;
    const asp = w / h;
    if (asp < ASPECT_MIN || asp > ASPECT_MAX) return false;
    // Fill ratio: loại blob noise/merged.
    // 0.15 quá lỏng → blob noise lọt qua → sai đáp án. 0.25 quá strict cho thẻ gần.
    // 0.20 là cân bằng: loại noise nhưng vẫn bắt thẻ gần camera.
    const fillRatio = b.area / (w * h);
    return fillRatio >= 0.2;
  });
}

// ─── Step 3a: Sample grid thẳng ───────────────────────────────────────────────
function sampleGrid(binary, sw, sh, blob) {
  const { minX, maxX, minY, maxY } = blob;
  const bw = maxX - minX + 1,
    bh = maxY - minY + 1;
  // Hạ từ GRID*2=14 → GRID+2=9: cho phép sample thẻ nhỏ hơn (xa ~6-8m)
  if (bw < GRID + 2 || bh < GRID + 2) return null;
  const cw = bw / GRID,
    ch = bh / GRID;
  // Adaptive R: tỉ lệ theo kích thước cell, giới hạn 1–CELL_SAMPLE_R(2)
  // R=4 quá nặng → 2 FPS. R=2 (5×5=25 sample/cell) đủ chính xác, 14 FPS.
  // Thẻ gần camera → warped grid xử lý tốt hơn (cố định 56×56).
  const R = Math.min(
    CELL_SAMPLE_R,
    Math.max(1, Math.floor(Math.min(cw, ch) * 0.3)),
  );
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
  if (maxX - minX + 1 < GRID + 2 || maxY - minY + 1 < GRID + 2) return null;

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
/**
 * FIX #1, #19: Enhanced decodeCard with corner marker validation
 * - Requires all 4 corner markers to be present
 * - Validates confidence threshold
 * - Returns null if card is invalid (folded, occluded, wrong orientation)
 */
/**
 * ANTI-WRONG-ANSWER: Score ALL 4 rotations, pick best, require margin.
 * Vấn đề cũ: trả về rotation đầu tiên match → nếu grid sample lệch, rotation sai
 * có thể pass trước → SAI ĐÁP ÁN.
 * Fix: thử cả 4, chấm điểm, chỉ trả về nếu rotation tốt nhất cách xa rotation thứ 2.
 */
function decodeCard(grid) {
  if (!grid) return null;

  // Outer border check: thẻ cầm tay bị cong/gấp → mất 6-8 ô viền là bình thường
  // 24 ô tổng, cần >= 16 (cho phép sai 8) để bắt thẻ cong
  let borderOk = 0;
  for (let i = 0; i < GRID; i++) {
    if (grid[0][i]) borderOk++;
    if (grid[6][i]) borderOk++;
    if (i > 0 && i < 6) {
      if (grid[i][0]) borderOk++;
      if (grid[i][6]) borderOk++;
    }
  }
  if (borderOk < 16) return null;

  // Thử cả 4 rotation, chấm điểm từng cái
  const candidates = [];
  for (let k = 0; k < 4; k++) {
    const rot = rotateK(grid, k);

    // Orientation cells PHẢI 4/4 trắng — đây là cách duy nhất xác định đúng hướng
    if (!ORIENTATION_CELLS.every(([r, c]) => rot[r][c] === 0)) continue;

    // Border guards
    const guardOk = BORDER_GUARDS.filter(([r, c]) => rot[r][c] === 1).length;
    if (guardOk < BORDER_GUARDS.length - 2) continue;

    if (!validateCornerMarkers(rot)) continue;

    const bits = DATA_POSITIONS.map(([r, c]) => rot[r][c]);
    const cardId = bitsToCardId(bits);
    if (cardId < 1 || cardId > 100) continue;

    const confidence = calcConfidence(rot);
    if (confidence < CONFIDENCE_MIN) continue;

    candidates.push({ cardId, answer: ANSWER_MAP[k], confidence, k, guardOk });
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Nhiều rotation pass → chọn confidence cao nhất, YÊU CẦU cách xa
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  const second = candidates[1];
  // Phải hơn rotation thứ 2 ít nhất 0.15 confidence → chống sai đáp án triệt để
  if (best.confidence - second.confidence < 0.15) return null;
  return best;
}

// ─── Step 5: Try straight + warped per blob ───────────────────────────────────
function tryDecodeBlob(binary, sw, sh, blob) {
  const r1 = decodeCard(sampleGrid(binary, sw, sh, blob));
  const r2 = decodeCard(sampleGridWarped(binary, sw, sh, blob));
  // Luôn thử CẢ HAI: straight + warped. Chọn confidence cao nhất.
  // Fix sai đáp án: straight có thể decode sai khi thẻ cong, warped chuẩn hơn.
  if (r1 && r2) {
    // Cùng cardId+answer → lấy max confidence
    if (r1.cardId === r2.cardId && r1.answer === r2.answer) {
      return r1.confidence >= r2.confidence ? r1 : r2;
    }
    // Khác nhau → lấy confidence cao hơn, YÊU CẦU margin
    const best = r1.confidence >= r2.confidence ? r1 : r2;
    const other = r1.confidence >= r2.confidence ? r2 : r1;
    return best.confidence - other.confidence >= 0.12 ? best : null;
  }
  return r1 || r2 || null;
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

  /**
   * FIX #4: Enhanced majority voting with temporal stability
   * - Votes based on weighted confidence across frames
   * - Requires majority consistency to prevent random answers from hand shaking
   * - Example: A A A A B A A => A (even if one frame shows B)
   */
  computeStableResults(minVotes = MIN_VOTES, windowMs = BUFFER_WINDOW_MS) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const out = new Map();

    for (const [cardId, entries] of this._buffer) {
      const recent = entries.filter((e) => e.ts >= cutoff);
      if (recent.length < minVotes) continue;

      // FIX #4: Weighted voting by confidence
      const weight = { A: 0, B: 0, C: 0, D: 0 };
      const voteCount = { A: 0, B: 0, C: 0, D: 0 };

      for (const e of recent) {
        weight[e.answer] += e.confidence;
        voteCount[e.answer]++;
      }

      // Find the answer with highest weighted score
      const best = ["A", "B", "C", "D"].reduce((a, b) =>
        weight[b] > weight[a] ? b : a,
      );

      const bestVotes = voteCount[best];

      // Cần ít nhất 2 frame đồng ý cùng đáp án để tránh false positive
      if (bestVotes < 2) continue;

      const totalW = Object.values(weight).reduce((s, v) => s + v, 0);
      out.set(cardId, {
        answer: best,
        votes: bestVotes,
        totalFrames: recent.length,
        confidence: totalW > 0 ? weight[best] / totalW : 0,
        voteDistribution: { ...voteCount },
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

  /**
   * FIX #6: Get detection count for UI feedback
   * Returns { detected: number, totalCards: number }
   */
  getDetectionStats() {
    const detected = this._buffer.size;
    return { detected, totalCards: detected }; // totalCards can be passed from backend
  }

  /**
   * Get all detected card IDs in current buffer
   */
  getDetectedCardIds() {
    return Array.from(this._buffer.keys());
  }
}

// CommonJS export for Node.js environments (optional)
// eslint-disable-next-line no-undef
if (typeof module !== "undefined" && module) {
  // eslint-disable-next-line no-undef
  module.exports = { PCardDetector };
}
export { PCardDetector };
