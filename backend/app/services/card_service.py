"""
app/services/card_service.py
═══════════════════════════════════════════════════════════════════════════════
PCARD v7 — Thiết kế 7x7 (Solid Black Border)
Tối ưu cho 100 thí sinh, viền ngoài luôn đen để camera quét siêu nhạy ở mọi góc.
"""

import io
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader
from typing import List, Tuple, Optional, Dict

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS 7x7
# ══════════════════════════════════════════════════════════════════════════════

GRID = 7
CELL_PX = 77          # px/ô khi render ảnh (540×540 tổng)
CARD_SIZE_MM = 90     # kích thước thẻ vật lý (mm)
CARDS_PER_ROW = 2     # thẻ/hàng trong PDF
PAGE_MARGIN_MM = 12
CARD_GAP_MM = 10

# Góc định hướng (2x2 TRẮNG cố định)
ORIENTATION_CELLS: List[Tuple[int,int]] = [(1,1), (1,2), (2,1), (2,2)]

# Các ô "Bảo vệ" (ĐEN cố định) để tạo khối hình, chống nhiễu
BORDER_GUARDS: List[Tuple[int,int]] = [
    (1,3), (2,3), (2,4),
    (3,1), (3,2), (3,3), (3,4), (3,5),
    (4,2), (4,3), (4,5),
    (5,3), (5,4)
]

# Vị trí 8 bit dữ liệu (7 bit data + 1 parity) 
DATA_POSITIONS: List[Tuple[int,int]] = [
    (1,4), (1,5),
    (2,5),
    (4,1),
    (5,1), (5,2),
    (4,4),
    (5,5)
]

# Mapping: Xoay theo chiều kim đồng hồ (CW)
ANSWER_MAP = ['A', 'B', 'C', 'D']

LABEL_COLORS = {
    'A': '#E53E3E',  # đỏ
    'B': '#3182CE',  # xanh dương
    'C': '#D69E2E',  # vàng
    'D': '#38A169',  # xanh lá
}

# ══════════════════════════════════════════════════════════════════════════════
# ENCODING / DECODING
# ══════════════════════════════════════════════════════════════════════════════

def card_id_to_bits(card_id: int) -> List[int]:
    """Encode card_id (1-100) → 7 data bits + 1 parity bit = 8 bits."""
    assert 1 <= card_id <= 100, f"card_id phải từ 1–100, nhận: {card_id}"
    data_bits = [(card_id >> (6 - i)) & 1 for i in range(7)]
    parity = sum(data_bits) % 2
    return data_bits + [parity]

def bits_to_card_id(bits: List[int]) -> int:
    """Decode 8 bits → card_id."""
    if len(bits) != 8:
        return -1
    data_bits, parity = bits[:7], bits[7]
    if sum(data_bits) % 2 != parity:
        return -1  # Lỗi parity
    val = 0
    for b in data_bits:
        val = (val << 1) | b
    return val if 1 <= val <= 100 else -1

def make_pcard_grid(card_id: int) -> np.ndarray:
    """Tạo grid 7x7. 1 = ô ĐEN | 0 = ô TRẮNG."""
    grid = np.zeros((GRID, GRID), dtype=np.uint8)
    
    # 1. Viền ngoài đen 4 cạnh
    for i in range(GRID):
        grid[0, i] = 1   # trên
        grid[6, i] = 1   # dưới
        grid[i, 0] = 1   # trái
        grid[i, 6] = 1   # phải
    
    # 2. Góc định hướng
    for r, c in ORIENTATION_CELLS:
        grid[r, c] = 0
    
    # 3. Ô bảo vệ
    for r, c in BORDER_GUARDS:
        grid[r, c] = 1
    
    # 4. Data bits
    bits = card_id_to_bits(card_id)
    for i, (r, c) in enumerate(DATA_POSITIONS):
        grid[r, c] = bits[i]
    
    return grid

def rotate_grid_cw(grid: np.ndarray) -> np.ndarray:
    """Xoay grid 90° CW."""
    return np.rot90(grid, k=3)

def find_orientation_and_decode(grid: np.ndarray) -> Tuple[int, str]:
    """Tìm góc định hướng và giải mã."""
    cur = grid.copy()
    for k in range(4):
        tl_ok = all(cur[r, c] == 0 for r, c in ORIENTATION_CELLS)
        if tl_ok:
            border_ok = all(cur[r, c] == 1 for r, c in BORDER_GUARDS)
            if border_ok:
                bits = [int(cur[r, c]) for r, c in DATA_POSITIONS]
                card_id = bits_to_card_id(bits)
                if card_id > 0:
                    return card_id, ANSWER_MAP[k]
        cur = rotate_grid_cw(cur)
    return -1, ''

def validate_card(card_id: int) -> bool:
    bits = card_id_to_bits(card_id)
    if bits.count(0) == 0:
        return False
    grid = make_pcard_grid(card_id)
    for k in range(4):
        rotated = np.rot90(grid, k=k)
        decoded_id, decoded_ans = find_orientation_and_decode(rotated)
        # np.rot90(k=0..3) = 0°/90°CCW/180°/270°CCW rotation.
        # Card labels: A=top, B=right, C=bottom, D=left.
        # Holding B at top requires 90° CCW → np.rot90 k=1 → decoder returns ANSWER_MAP[1]='B'.
        ans_check = ANSWER_MAP[k]
        if decoded_id != card_id or decoded_ans != ans_check:
            return False
    return True

def generate_all_valid_cards() -> List[Dict]:
    result = []
    for card_id in range(1, 101):
        if not validate_card(card_id):
            continue
        bits = card_id_to_bits(card_id)
        grid = make_pcard_grid(card_id)
        result.append({
            'id': card_id,
            'bits': ''.join(str(b) for b in bits),
            'white_count': bits.count(0),
            'grid_json': json.dumps(grid.tolist()),
            'validated': True,
        })
    return result

def get_valid_card_ids() -> List[int]:
    return [cid for cid in range(1, 101) if validate_card(cid)]

def assign_cards(contestant_count: int) -> List[int]:
    valid_ids = get_valid_card_ids()
    assert contestant_count <= len(valid_ids), f"Tối đa {len(valid_ids)} thí sinh."
    return valid_ids[:contestant_count]

# ══════════════════════════════════════════════════════════════════════════════
# IMAGE & PDF GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def _load_font(size: int) -> ImageFont.ImageFont:
    for name in ["arialbd.ttf","Arial Bold.ttf","DejaVuSans-Bold.ttf", "NotoSans-Bold.ttf","FreeSansBold.ttf"]:
        try: return ImageFont.truetype(name, size)
        except Exception: continue
    return ImageFont.load_default()

def _hex_to_rgb(hex_color: str) -> Tuple[int,int,int]:
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0,2,4))

def make_pcard_image(card_id: int, size_px: int = 540) -> Image.Image:
    label_band = int(size_px * 0.14)
    card_area  = size_px - 2 * label_band
    cell_px    = card_area // GRID
    
    img  = Image.new("RGB", (size_px, size_px), (255,255,255))
    draw = ImageDraw.Draw(img)
    
    grid = make_pcard_grid(card_id)
    ox, oy = label_band, label_band
    
    for r in range(GRID):
        for c in range(GRID):
            x0, y0 = ox + c*cell_px, oy + r*cell_px
            color = (0,0,0) if grid[r,c] == 1 else (255,255,255)
            # Khử răng cưa cho ô đen
            draw.rectangle([x0, y0, x0+cell_px, y0+cell_px], fill=color)
    
    # Chỉ vẽ đường kẻ trên ô TRẮNG — không vẽ đè ô đen
    grid_color = (180,180,180)
    for r in range(GRID):
        for c in range(GRID):
            if grid[r, c] == 0:  # chỉ ô trắng mới vẽ viền
                x0 = ox + c * cell_px
                y0 = oy + r * cell_px
                draw.rectangle([x0, y0, x0+cell_px, y0+cell_px],
                                fill=(255,255,255), outline=grid_color, width=1)

    # Viền ngoài toàn grid — đen tuyền để camera nhận dạng cạnh rõ ràng
    draw.rectangle([ox, oy, ox+GRID*cell_px, oy+GRID*cell_px], outline=(0,0,0), width=2)
    
    font_lbl   = _load_font(int(label_band * 0.65))
    font_small = _load_font(int(label_band * 0.28))
    pcx = ox + (GRID*cell_px) // 2
    pcy = oy + (GRID*cell_px) // 2
    
    label_cfg = [
        ('A', pcx,               label_band//2,          0),
        ('B', size_px-label_band//2, pcy,                90),
        ('C', pcx,               size_px-label_band//2,  0),
        ('D', label_band//2,     pcy,                   -90),
    ]
    
    for lbl, lx, ly, angle in label_cfg:
        color = _hex_to_rgb(LABEL_COLORS[lbl])
        bb = draw.textbbox((0,0), lbl, font=font_lbl)
        tw, th = bb[2]-bb[0], bb[3]-bb[1]
        if angle != 0:
            tmp = Image.new("RGBA", (tw+10, th+10), (255,255,255,0))
            td  = ImageDraw.Draw(tmp)
            td.text((5,5), lbl, fill=(*color,255), font=font_lbl)
            tmp = tmp.rotate(-angle, expand=True)
            img.paste(tmp, (lx-tmp.width//2, ly-tmp.height//2), tmp)
        else:
            draw.text((lx-tw//2, ly-th//2), lbl, fill=color, font=font_lbl)
    
    id_str = f"#{card_id:03d}"
    draw.text((3,3), id_str, fill=(160,160,160), font=font_small)
    bb_id = draw.textbbox((0,0), id_str, font=font_small)
    draw.text((size_px-bb_id[2]-3, size_px-bb_id[3]-3), id_str, fill=(160,160,160), font=font_small)
    
    return img

def generate_cards_pdf(contestants: List[Tuple[int, str]]) -> bytes:
    buf = io.BytesIO()
    c   = rl_canvas.Canvas(buf, pagesize=A4)

    pw, ph = A4

    card_size = CARD_SIZE_MM * mm
    gap       = CARD_GAP_MM * mm
    name_band = 10 * mm

    block_h = card_size + name_band

    # canh giữa theo chiều ngang
    x = (pw - card_size) / 2

    # vị trí card trên / card dưới
    top_y    = ph - block_h - 30
    bottom_y = top_y - block_h - gap

    for idx, (card_id, name) in enumerate(contestants):

        if idx > 0 and idx % 2 == 0:
            c.showPage()

        y = top_y if idx % 2 == 0 else bottom_y

        img_pil = make_pcard_image(card_id, size_px=540)

        img_buf = io.BytesIO()
        img_pil.save(img_buf, format="PNG", dpi=(300,300))
        img_buf.seek(0)

        c.drawImage(
            ImageReader(img_buf),
            x,
            y + name_band,
            width=card_size,
            height=card_size,
            preserveAspectRatio=True
        )

        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.15,0.15,0.15)

        display = f"#{card_id:03d}  {name[:30]}" if name else f"#{card_id:03d}"

        c.drawCentredString(
            x + card_size/2,
            y + 2*mm,
            display
        )

    c.save()
    buf.seek(0)

    return buf.read()

def generate_blank_cards_pdf(count: int, start_id: int = 1) -> bytes:
    valid_ids = get_valid_card_ids()
    if not valid_ids:
        # If no valid cards, return empty PDF
        return generate_cards_pdf([])
    end_id    = min(start_id + count - 1, valid_ids[-1])
    ids_to_gen = [i for i in valid_ids if start_id <= i <= end_id][:count]
    return generate_cards_pdf([(cid, '') for cid in ids_to_gen])