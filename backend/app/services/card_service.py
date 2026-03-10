"""
app/services/card_service.py
═══════════════════════════════════════════════════════════════════════════════
PCARD — Plickers-clone card format cho ShieldPoll

THIẾT KẾ THẺ:
  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┐
  │▓▓│▓▓│■ │b0│b1│b2│b3│b4│b5│  ← Top row: bits 0-5 (b=bit, ■=đen)
  │▓▓│▓▓│■ │  │  │  │  │  │b6│  ← Right col: bit 6
  │  │  │  │  │  │  │  │  │b7│  ← Right col: bit 7 (parity)
  │  │  │  │  │  │  │  │  │  │
  │  │  │  │  │○ │  │  │  │  │  ← Center: finder dot (trắng)
  │  │  │  │  │  │  │  │  │  │
  │  │  │  │  │  │  │  │  │  │
  │  │  │  │  │  │  │  │  │  │
  └──┴──┴──┴──┴──┴──┴──┴──┴──┘

  ▓▓ = Orientation corner (2x2 trắng, CỐ ĐỊNH ở góc TL)
  ■  = đen (phần khung)
  b0-b7 = 8 data bits (7 bit card_id + 1 parity)
  bit=1 → ô ĐEN | bit=0 → ô TRẮNG (notch)
  ○  = finder center (trắng, dùng để camera lock và tính scale)

NHẬN DIỆN HƯỚNG:
  - Tìm góc 2x2 trắng liên tiếp → đó là góc TL
  - Từ góc TL xác định được hướng xoay của thẻ
  - Mapping hướng → đáp án (như thẻ Plickers thật):
      TL lên trên → A (thẻ thẳng)
      TR lên trên → B (xoay 90° trái)
      BR lên trên → C (xoay 180°)
      BL lên trên → D (xoay 90° phải)

DECODE (frontend - jsQR KHÔNG dùng nữa):
  - Dùng OpenCV hoặc thuật toán custom detect contour hình vuông đen
  - Warp perspective → grid chuẩn 9x9
  - Đọc từng ô → bit array → card_id + hướng
  - Nhanh hơn QR rất nhiều vì không cần finder pattern phức tạp

ƯUĐIỂM SO VỚI QR CODE HIỆN TẠI:
  ✅ Nhận diện nhanh hơn (không cần decode QR phức tạp)
  ✅ Đọc được từ xa hơn (pattern đơn giản, ít chi tiết)
  ✅ Hướng xoay rõ ràng hơn (orientation corner lớn, dễ thấy)
  ✅ In nét hơn (chỉ đen/trắng, không có modules nhỏ li ti như QR)
  ✅ Robust hơn khi bị bẩn/nhàu (các ô lớn, dễ đọc)
"""

import io
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader
from typing import List, Tuple, Optional

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

GRID = 9          # 9x9 cells
CELL_PX = 60      # pixels per cell (540x540 total)
CARD_SIZE_MM = 90          # thẻ 90mm — to, dễ cầm
CARDS_PER_PAGE = 2         # 2 thẻ / trang A4
PAGE_MARGIN_MM = 12
CARD_GAP_MM = 10           # khoảng cách giữa 2 thẻ

# Data bit positions (row, col) — 8 slots = 7 data bits + 1 parity → max 127
# Top row cols 3-8: 6 bits | Right col rows 1-2: 2 bits
DATA_POSITIONS = [
    (0, 3), (0, 4), (0, 5), (0, 6), (0, 7), (0, 8),  # bits 0-5 (top row)
    (1, 8), (2, 8),                                  # bits 6-7 (right col)
]

# Orientation corner cells (luôn TRẮNG)
ORIENTATION_CELLS = [(0, 0), (0, 1), (1, 0), (1, 1)]

# Finder center cell (luôn TRẮNG)
FINDER_CELL = (GRID // 2, GRID // 2)  # (4, 4)

# Màu nhãn ABCD (viền ngoài thẻ)
LABEL_COLORS = {
    'A': '#E53E3E',  # đỏ
    'B': '#3182CE',  # xanh
    'C': '#D69E2E',  # vàng
    'D': '#38A169',  # xanh lá
}

# ══════════════════════════════════════════════════════════════════════════════
# ENCODING / DECODING
# ══════════════════════════════════════════════════════════════════════════════

def card_id_to_bits(card_id: int) -> List[int]:
    """
    Encode card_id (1-127) → 7 data bits + 1 parity bit = 8 bits total.
    b0 = MSB, b6 = LSB, b7 = even parity.
    bit=1 → ô đen | bit=0 → ô trắng (notch)
    """
    assert 1 <= card_id <= 127, f"Card ID phải từ 1-127, nhận: {card_id}"
    # Extract 7 data bits from card_id
    data_bits = [(card_id >> (6 - i)) & 1 for i in range(7)]
    # Calculate even parity on 7 data bits
    parity = sum(data_bits) % 2
    # Return 8 bits: 7 data + 1 parity
    return data_bits + [parity]


def bits_to_card_id(bits: List[int]) -> int:
    """
    Decode 8 bits → card_id (7 data bits + 1 parity bit).
    Trả về -1 nếu parity lỗi hoặc bits không hợp lệ.
    """
    if len(bits) != 8:
        return -1
    data_bits = bits[:7]  # 7 data bits
    parity = bits[7]      # parity bit
    # Verify even parity on 7 data bits
    if sum(data_bits) % 2 != parity:
        return -1  # parity error
    val = 0
    for b in data_bits:
        val = (val << 1) | b
    return val if val >= 1 else -1


def make_pcard_grid(card_id: int) -> np.ndarray:
    """
    Tạo grid 9x9.
    1 = ô ĐEN (filled black)
    0 = ô TRẮNG (white notch/hole)
    """
    grid = np.ones((GRID, GRID), dtype=np.uint8)  # bắt đầu đen hết

    # Orientation corner: góc TL = 2x2 TRẮNG (cố định)
    for r, c in ORIENTATION_CELLS:
        grid[r, c] = 0

    # Finder: tâm = TRẮNG
    fr, fc = FINDER_CELL
    grid[fr, fc] = 0

    # Data bits
    bits = card_id_to_bits(card_id)
    for i, (r, c) in enumerate(DATA_POSITIONS):
        grid[r, c] = bits[i]  # 1=đen, 0=trắng

    return grid


def rotate_grid_90cw(grid: np.ndarray) -> np.ndarray:
    """Xoay grid 90° theo chiều kim đồng hồ"""
    return np.rot90(grid, k=3)


def find_orientation_and_decode(grid: np.ndarray) -> Tuple[int, str]:
    ANSWERS = ['A', 'B', 'C', 'D']  # Thứ tự: 0°, 90° CW, 180°, 270° CW
    current = grid.copy()
    for k in range(4):
        # Kiểm tra góc TL (2x2 trắng)
        tl_ok = all(current[r, c] == 0 for r, c in ORIENTATION_CELLS)
        if tl_ok:
            bits = [int(current[r, c]) for r, c in DATA_POSITIONS]
            card_id = bits_to_card_id(bits)
            if card_id > 0:
                return card_id, ANSWERS[k]
        current = np.rot90(current, k=3)  # Xoay 90° theo chiều kim đồng hồ (k=3 = 270° ngược = 90° xuôi)
    return -1, ''

# ══════════════════════════════════════════════════════════════════════════════
# IMAGE GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def _load_font(size: int) -> ImageFont.ImageFont:
    for name in ["arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf",
                 "NotoSans-Bold.ttf", "FreeSansBold.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def make_pcard_image(card_id: int, name: str = '', size_px: int = 540) -> Image.Image:
    """
    Tạo ảnh thẻ PCARD hoàn chỉnh với:
    - Vùng thẻ vuông: hình vuông đen với pattern nhị phân
    - Nhãn A/B/C/D ở 4 cạnh ngoài (màu sắc tương ứng)
    - Số thẻ ở góc
    - Tên ở dưới (optional)

    Layout:
      ┌─────────────────────────────┐
      │        D (trái, xoay)       │
      │  ┌──────────────────────┐   │
      │A │    PCARD PATTERN     │ B │
      │  └──────────────────────┘   │
      │        C (phải, xoay)       │
      └─────────────────────────────┘
    
    Nhãn in RA NGOÀI pattern giống Plickers thật.
    """
    # Kích thước
    label_band = int(size_px * 0.15)   # dải nhãn xung quanh
    card_area = size_px - 2 * label_band
    cell_px = card_area // GRID

    total = size_px
    img_w = total
    img_h = total

    img = Image.new("RGB", (img_w, img_h), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # ── Vẽ pattern PCARD ─────────────────────────────────────────────────────
    grid = make_pcard_grid(card_id)
    ox = label_band  # offset x
    oy = label_band  # offset y

    for r in range(GRID):
        for c in range(GRID):
            x0 = ox + c * cell_px
            y0 = oy + r * cell_px
            x1 = x0 + cell_px
            y1 = y0 + cell_px
            color = (0, 0, 0) if grid[r, c] == 1 else (255, 255, 255)
            draw.rectangle([x0, y0, x1, y1], fill=color)

    # Viền mỏng quanh pattern để tách khỏi nền
    draw.rectangle(
        [ox - 1, oy - 1, ox + GRID * cell_px + 1, oy + GRID * cell_px + 1],
        outline=(180, 180, 180), width=1
    )

    # ── Nhãn A/B/C/D ─────────────────────────────────────────────────────────
    font_label = _load_font(int(label_band * 0.7))
    font_small = _load_font(int(label_band * 0.3))
    pattern_cx = ox + (GRID * cell_px) // 2
    pattern_cy = oy + (GRID * cell_px) // 2

    label_cfg = [
        ('A', pattern_cx, label_band // 2, 0),              # top center
        ('B', img_w - label_band // 2, pattern_cy, 90),     # right center
        ('C', pattern_cx, img_h - label_band // 2, 0),      # bottom center
        ('D', label_band // 2, pattern_cy, -90),             # left center
    ]

    for lbl, lx, ly, angle in label_cfg:
        color = _hex_to_rgb(LABEL_COLORS[lbl])
        # Vẽ chữ
        bbox = draw.textbbox((0, 0), lbl, font=font_label)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

        if angle != 0:
            # Tạo ảnh phụ để xoay chữ
            tmp = Image.new("RGBA", (tw + 10, th + 10), (255, 255, 255, 0))
            td = ImageDraw.Draw(tmp)
            td.text((5, 5), lbl, fill=(*color, 255), font=font_label)
            tmp = tmp.rotate(-angle, expand=True)
            paste_x = lx - tmp.width // 2
            paste_y = ly - tmp.height // 2
            img.paste(tmp, (paste_x, paste_y), tmp)
        else:
            draw.text((lx - tw // 2, ly - th // 2), lbl, fill=color, font=font_label)

    # ── Số thẻ ở góc ─────────────────────────────────────────────────────────
    id_str = f"#{card_id:02d}"
    draw.text((2, 2), id_str, fill=(160, 160, 160), font=font_small)
    bbox_id = draw.textbbox((0, 0), id_str, font=font_small)
    draw.text((img_w - bbox_id[2] - 2, img_h - bbox_id[3] - 2), id_str,
              fill=(160, 160, 160), font=font_small)

    return img


def make_pcard_image_with_name(card_id: int, name: str, total_px: int = 600) -> Image.Image:
    """Thẻ + tên thí sinh bên dưới"""
    card_img = make_pcard_image(card_id, size_px=int(total_px * 0.88))
    card_w, card_h = card_img.size

    name_band = total_px - card_h
    full_img = Image.new("RGB", (total_px, total_px), (255, 255, 255))
    # Căn giữa card trong full_img
    paste_x = (total_px - card_w) // 2
    full_img.paste(card_img, (paste_x, 0))

    # Tên
    draw = ImageDraw.Draw(full_img)
    font_name = _load_font(max(14, name_band - 4))
    if name:
        bbox = draw.textbbox((0, 0), name, font=font_name)
        tw = bbox[2] - bbox[0]
        draw.text(
            (total_px // 2 - tw // 2, card_h + 2),
            name[:28],
            fill=(40, 40, 40),
            font=font_name,
        )

    return full_img


# ══════════════════════════════════════════════════════════════════════════════
# PDF GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def generate_cards_pdf(contestants: List[Tuple[int, str]]) -> bytes:
    """
    Tạo PDF thẻ PCARD — 2 thẻ/trang A4, căn giữa trang.
    """
    buffer = io.BytesIO()
    c = rl_canvas.Canvas(buffer, pagesize=A4)
    page_w, page_h = A4

    card_size = CARD_SIZE_MM * mm
    gap = CARD_GAP_MM * mm
    name_band = 10 * mm

    # 2 cột, 1 hàng — căn giữa ngang
    row_w = 2 * card_size + gap
    start_x = (page_w - row_w) / 2

    # Căn giữa dọc
    block_h = card_size + name_band
    card_y = (page_h - block_h) / 2   # toạ độ y (bottom) của ảnh

    for idx, (card_id, name) in enumerate(contestants):
        if idx > 0 and idx % 2 == 0:
            c.showPage()

        col = idx % 2
        x = start_x + col * (card_size + gap)

        card_img = make_pcard_image(card_id, size_px=540)
        buf = io.BytesIO()
        card_img.save(buf, format="PNG", dpi=(300, 300))
        buf.seek(0)

        c.drawImage(ImageReader(buf), x, card_y + name_band,
                    width=card_size, height=card_size,
                    preserveAspectRatio=True)

        # Tên + số thẻ
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.15, 0.15, 0.15)
        display = f"#{card_id:02d}  {name[:30]}" if name else f"#{card_id:02d}"
        c.drawCentredString(x + card_size / 2, card_y + 2 * mm, display)

    c.save()
    buffer.seek(0)
    return buffer.read()


def generate_blank_cards_pdf(count: int, start_id: int = 1) -> bytes:
    """Thẻ trắng — không có tên, chỉ có ID và pattern"""
    contestants = [(start_id + i, '') for i in range(count)]
    return generate_cards_pdf(contestants)