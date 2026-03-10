import React from 'react';

/**
 * PlickersCard — render thẻ PCARD 9×9 binary grid hoặc Plickers cổ điển.
 * 
 * Props:
 *   - cardId: ID thẻ (1-127 cho PCARD, 0-99 cho Legacy)
 *   - variant: 'pcard' | 'legacy' — mặc định 'pcard'
 *   - name: tên thí sinh (optional)
 *   - size: kích thước SVG (default 300)
 *   - showLabels: hiển thị nhãn A/B/C/D (default true)
 */

const GRID = 9;

// vị trí các bit dữ liệu (khớp Python card_service.py)
// 8 positions: bits 0-5 (top row) + bits 6-7 (right col)
const DATA_POSITIONS = [
    [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8],  // bits 0-5
    [1, 8], [2, 8],                                   // bits 6-7
];

// góc TL 2×2 luôn trắng (orientation corner)
const ORIENTATION_CELLS = [[0, 0], [0, 1], [1, 0], [1, 1]];

// tâm lưới luôn trắng (finder)
const FINDER_CELL = [4, 4];

const LABEL_COLORS = {
    A: '#E53E3E',
    B: '#3182CE',
    C: '#D69E2E',
    D: '#38A169',
};

/** 7 data bits + 1 parity — khớp Python card_id_to_bits() */
function idToBits(cardId) {
    // Extract 7 data bits (card_id 1-127)
    const dataBits = [];
    for (let i = 6; i >= 0; i--) dataBits.push((cardId >> i) & 1); // 7 bits MSB first
    // Calculate even parity on 7 data bits
    const parity = dataBits.reduce((a, b) => a + b, 0) % 2;
    // Return 8 bits: 7 data + 1 parity
    return dataBits.concat(parity);
}

/** Tạo lưới 9×9 — khớp Python make_pcard_grid() */
function makePcardGrid(cardId) {
    const grid = Array.from({ length: GRID }, () => new Array(GRID).fill(1));

    // Orientation corner (TL 2×2) = trắng
    for (const [r, c] of ORIENTATION_CELLS) grid[r][c] = 0;

    // Finder center = trắng
    grid[FINDER_CELL[0]][FINDER_CELL[1]] = 0;

    // Data bits
    const bits = idToBits(Math.max(1, Math.min(127, cardId)));
    for (let i = 0; i < DATA_POSITIONS.length; i++) {
        const [r, c] = DATA_POSITIONS[i];
        grid[r][c] = bits[i];
    }

    return grid;
}

/**
 * PCARD Component — 9x9 binary grid
 */
function PlickersCardPCARD({
    cardId = 1,
    name = '',
    size = 300,
    showLabels = true,
    className = '',
}) {
    const labelBand = Math.round(size * 0.14);
    const patternSize = size - 2 * labelBand;
    const cellPx = patternSize / GRID;

    const grid = makePcardGrid(cardId);

    return (
        <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            className={className}
            style={{ display: 'block' }}
        >
            {/* Background trắng */}
            <rect x={0} y={0} width={size} height={size} fill="white" />

            {/* PCARD Pattern — 9×9 grid */}
            {grid.map((row, r) =>
                row.map((cell, c) => (
                    <rect
                        key={`${r}-${c}`}
                        x={labelBand + c * cellPx}
                        y={labelBand + r * cellPx}
                        width={cellPx}
                        height={cellPx}
                        fill={cell === 1 ? 'black' : 'white'}
                    />
                ))
            )}

            {/* Viền mỏng quanh pattern */}
            <rect
                x={labelBand - 1}
                y={labelBand - 1}
                width={GRID * cellPx + 2}
                height={GRID * cellPx + 2}
                fill="none"
                stroke="#ccc"
                strokeWidth={1}
            />

            {/* ---- Nhãn A B C D ---- */}
            {showLabels && (
                <>
                    {/* A — trên */}
                    <text
                        x={size / 2}
                        y={labelBand * 0.5}
                        textAnchor="middle"
                        dominantBaseline="auto"
                        fontSize={labelBand * 0.62}
                        fontWeight="bold"
                        fontFamily="Arial, sans-serif"
                        fill={LABEL_COLORS.A}
                    >A</text>

                    {/* B — phải */}
                    <text
                        x={size - labelBand * 0.5}
                        y={size / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={labelBand * 0.62}
                        fontWeight="bold"
                        fontFamily="Arial, sans-serif"
                        fill={LABEL_COLORS.B}
                    >B</text>

                    {/* C — dưới */}
                    <text
                        x={size / 2}
                        y={size - labelBand * 0.5}
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        fontSize={labelBand * 0.62}
                        fontWeight="bold"
                        fontFamily="Arial, sans-serif"
                        fill={LABEL_COLORS.C}
                    >C</text>

                    {/* D — trái */}
                    <text
                        x={labelBand * 0.5}
                        y={size / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={labelBand * 0.62}
                        fontWeight="bold"
                        fontFamily="Arial, sans-serif"
                        fill={LABEL_COLORS.D}
                    >D</text>

                    {/* Số ID */}
                    <text
                        x={labelBand + 3}
                        y={labelBand - 4}
                        textAnchor="start"
                        dominantBaseline="auto"
                        fontSize={labelBand * 0.32}
                        fontFamily="Arial, sans-serif"
                        fill="#999"
                    >#{String(cardId).padStart(2, '0')}</text>

                    {/* Tên người dùng */}
                    {name && (
                        <text
                            x={size / 2}
                            y={size - 3}
                            textAnchor="middle"
                            dominantBaseline="auto"
                            fontSize={labelBand * 0.28}
                            fontFamily="Arial, sans-serif"
                            fill="#666"
                        >
                            {name.length > 22 ? name.slice(0, 20) + '…' : name}
                        </text>
                    )}
                </>
            )}
        </svg>
    );
}

// ------------------- Legacy Plickers Card (edge notches) -------------------

/** Chuyển id (0–99) sang mảng bit 7-bit — dùng cho PlickersCard cổ điển */
function idToBitsLegacy(id) {
    const bits = [];
    for (let i = 6; i >= 0; i--) {
        bits.push((id >> i) & 1);
    }
    return bits; // 7 bits
}

/**
 * Tạo các notch (khía) trên một cạnh.
 * slots: số khía, bits: mảng bit cho cạnh này,
 * edge: 'top' | 'right' | 'bottom' | 'left'
 * S: kích thước SVG, notchW: chiều rộng khía, depth: độ sâu khía
 */
function buildEdgeNotches(edge, bits, S, depth = 18, notchW = 18, pad = 30) {
    const paths = [];
    const available = S - pad * 2;
    const step = available / bits.length;

    bits.forEach((bit, i) => {
        if (bit === 0) return; // bit 0 = không khía
        const offset = pad + i * step + (step - notchW) / 2;

        let x, y, w, h;
        switch (edge) {
            case 'top':
                x = offset; y = 0; w = notchW; h = depth;
                break;
            case 'right':
                x = S - depth; y = offset; w = depth; h = notchW;
                break;
            case 'bottom':
                x = offset; y = S - depth; w = notchW; h = depth;
                break;
            case 'left':
                x = 0; y = offset; w = depth; h = notchW;
                break;
        }
        paths.push({ x, y, w, h });
    });
    return paths;
}

/**
 * PlickersCardLegacy — render thẻ Plickers cổ điển với edge notches.
 */
function PlickersCardLegacy({
    cardId = 0,
    name = '',
    size = 300,
    showLabels = true,
    className = '',
}) {
    const S = size;
    const CENTER_W = S * 0.22;
    const cx = (S - CENTER_W) / 2;
    const cy = (S - CENTER_W) / 2;

    // Chia 7 bit thành 4 cạnh: top 2, right 2, bottom 2, left 1
    const bits = idToBitsLegacy(cardId);
    const topBits = bits.slice(0, 2);
    const rightBits = bits.slice(2, 4);
    const bottomBits = bits.slice(4, 6);
    const leftBits = bits.slice(6, 7);

    const depth = S * 0.07;
    const notchW = S * 0.07;
    const pad = S * 0.12;

    const topNotches = buildEdgeNotches('top', topBits, S, depth, notchW, pad);
    const rightNotches = buildEdgeNotches('right', rightBits, S, depth, notchW, pad);
    const bottomNotches = buildEdgeNotches('bottom', bottomBits, S, depth, notchW, pad);
    const leftNotches = buildEdgeNotches('left', leftBits, S, depth, notchW, pad);

    const allNotches = [...topNotches, ...rightNotches, ...bottomNotches, ...leftNotches];

    const labelOffset = S * 0.055;
    const labelSize = S * 0.075;
    const labelSizeSmall = S * 0.042;

    return (
        <svg
            viewBox={`0 0 ${S} ${S}`}
            width={S}
            height={S}
            className={className}
            style={{ display: 'block' }}
        >
            {/* Background trắng */}
            <rect x={0} y={0} width={S} height={S} fill="white" />

            {/* Thân thẻ đen */}
            <rect x={0} y={0} width={S} height={S} fill="black" />

            {/* Khía trắng (notches) — cắt thành trắng */}
            {allNotches.map((n, i) => (
                <rect key={i} x={n.x} y={n.y} width={n.w} height={n.h} fill="white" />
            ))}

            {/* Lỗ trung tâm trắng */}
            <rect x={cx} y={cy} width={CENTER_W} height={CENTER_W} fill="white" />

            {/* ---- Nhãn A B C D ---- */}
            {showLabels && (
                <>
                    {/* A — góc dưới-trái (khi A lên trên thì thẻ đang thẳng) */}
                    <text
                        x={labelOffset}
                        y={S - labelOffset}
                        fontSize={labelSize}
                        fill="#555"
                        fontFamily="Arial, sans-serif"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="auto"
                    >A</text>

                    {/* B — góc trên-trái (xoay 90° CW: B lên) */}
                    <text
                        x={labelOffset}
                        y={labelOffset + labelSize}
                        fontSize={labelSize}
                        fill="#555"
                        fontFamily="Arial, sans-serif"
                        fontWeight="bold"
                        textAnchor="middle"
                    >B</text>

                    {/* C — góc trên-phải */}
                    <text
                        x={S - labelOffset}
                        y={labelOffset + labelSize}
                        fontSize={labelSize}
                        fill="#555"
                        fontFamily="Arial, sans-serif"
                        fontWeight="bold"
                        textAnchor="middle"
                    >C</text>

                    {/* D — góc dưới-phải */}
                    <text
                        x={S - labelOffset}
                        y={S - labelOffset}
                        fontSize={labelSize}
                        fill="#555"
                        fontFamily="Arial, sans-serif"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="auto"
                    >D</text>

                    {/* Số ID ở giữa dưới thẻ */}
                    <text
                        x={S / 2}
                        y={S - labelOffset * 0.4}
                        fontSize={labelSizeSmall}
                        fill="#888"
                        fontFamily="Arial, sans-serif"
                        textAnchor="middle"
                        dominantBaseline="auto"
                    >{String(cardId).padStart(2, '0')}</text>

                    {/* Tên người dùng nếu có */}
                    {name && (
                        <text
                            x={S / 2}
                            y={S - labelOffset * 0.4 - labelSizeSmall * 1.4}
                            fontSize={labelSizeSmall * 0.9}
                            fill="#666"
                            fontFamily="Arial, sans-serif"
                            textAnchor="middle"
                            dominantBaseline="auto"
                        >{name.length > 20 ? name.slice(0, 18) + '…' : name}</text>
                    )}
                </>
            )}
        </svg>
    );
}

// ------------------- Main Component (Router) -------------------

/**
 * Main PlickersCard component — router to variant-specific components.
 */
export default function PlickersCard({
    cardId = 1,
    variant = 'pcard',
    name = '',
    size = 300,
    showLabels = true,
    className = '',
}) {
    if (variant === 'legacy') {
        return PlickersCardLegacy({ cardId, name, size, showLabels, className });
    }
    
    return PlickersCardPCARD({ cardId, name, size, showLabels, className });
}

// Export named components for direct use
export { PlickersCardPCARD, PlickersCardLegacy };
