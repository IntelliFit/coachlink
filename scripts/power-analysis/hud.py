"""Card-style heads-up display for the result video.

A column of translucent rounded cards down the left edge: a small label, a large
value, an accent-coloured unit and a progress bar. Sizes follow the frame's short
side so portrait phone videos and landscape videos look the same.
"""
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ACCENT_RGB = (255, 138, 61)
LABEL_RGB = (176, 182, 190)
VALUE_RGB = (255, 255, 255)
CARD_BGR = (28, 24, 22)
CARD_ALPHA = 0.62
TRACK_BGR = (70, 66, 64)
ACCENT_BGR = (ACCENT_RGB[2], ACCENT_RGB[1], ACCENT_RGB[0])

REGULAR_FONTS = [
    os.environ.get("POWER_ANALYSIS_CJK_FONT", ""),
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
]
BOLD_FONTS = [
    os.environ.get("POWER_ANALYSIS_CJK_BOLD_FONT", ""),
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/msyhbd.ttc",
] + REGULAR_FONTS
_FONTS: Dict[Tuple[bool, int], Any] = {}


def font(size: float, bold: bool = False) -> Any:
    key = (bold, max(10, int(size)))
    if key not in _FONTS:
        for candidate in BOLD_FONTS if bold else REGULAR_FONTS:
            if candidate and os.path.exists(candidate):
                _FONTS[key] = ImageFont.truetype(candidate, size=key[1])
                break
        else:
            _FONTS[key] = ImageFont.load_default()
    return _FONTS[key]


@dataclass
class Card:
    label: str
    value: str
    unit: str = ""
    progress: Optional[float] = None
    big: bool = False


@dataclass
class TextItem:
    text: str
    x: float
    y: float
    size: float
    rgb: Tuple[int, int, int] = VALUE_RGB
    bold: bool = False
    anchor: str = "la"


@dataclass
class Layout:
    scale: float
    x: int
    y: int
    width: int
    pad: int
    gap: int
    small_height: int
    big_height: int

    @classmethod
    def for_frame(cls, width: int, height: int) -> "Layout":
        s = min(width, height) / 1080.0
        card_width = int(min(380 * s, width * 0.42))
        return cls(
            scale=s,
            x=int(28 * s),
            y=int(max(110 * s, height * 0.06)),
            width=card_width,
            pad=int(22 * s),
            gap=int(14 * s),
            small_height=int(152 * s),
            big_height=int(214 * s),
        )


def rounded_box(frame: np.ndarray, x0: int, y0: int, x1: int, y1: int, radius: int, color: Tuple[int, int, int], alpha: float) -> None:
    """Filled rounded rectangle blended into frame in place."""
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(frame.shape[1], x1), min(frame.shape[0], y1)
    if x1 <= x0 or y1 <= y0:
        return
    roi = frame[y0:y1, x0:x1]
    mask = np.zeros(roi.shape[:2], dtype=np.uint8)
    r = max(1, min(radius, (x1 - x0) // 2, (y1 - y0) // 2))
    w, h = x1 - x0, y1 - y0
    cv2.rectangle(mask, (r, 0), (w - r - 1, h - 1), 255, -1)
    cv2.rectangle(mask, (0, r), (w - 1, h - r - 1), 255, -1)
    for cx, cy in ((r, r), (w - r - 1, r), (r, h - r - 1), (w - r - 1, h - r - 1)):
        cv2.circle(mask, (cx, cy), r, 255, -1, cv2.LINE_AA)
    weight = (mask.astype(np.float32) / 255.0 * alpha)[..., None]
    roi[:] = (roi * (1 - weight) + np.array(color, dtype=np.float32) * weight).astype(np.uint8)


def draw_cards(frame: np.ndarray, cards: List[Card], layout: Layout, texts: List[TextItem]) -> int:
    """Draws card backgrounds and bars on frame; appends their text. Returns the y below the last card."""
    s, y = layout.scale, layout.y
    for card in cards:
        height = layout.big_height if card.big else layout.small_height
        x0, x1 = layout.x, layout.x + layout.width
        rounded_box(frame, x0, y, x1, y + height, int(18 * s), CARD_BGR, CARD_ALPHA)
        texts.append(TextItem(card.label, x0 + layout.pad, y + layout.pad * 0.75, 23 * s, LABEL_RGB, bold=True, anchor="lt"))
        bar_y0 = int(y + height - layout.pad * 0.95)
        baseline = bar_y0 - 16 * s
        unit_size = 28 * s
        unit_width = font(unit_size, True).getlength(card.unit) + 12 * s if card.unit else 0
        room = layout.width - 2 * layout.pad - unit_width
        value_size = (96 if card.big else 56) * s
        while value_size > 20 * s and font(value_size, True).getlength(card.value) > room:
            value_size *= 0.9
        texts.append(TextItem(card.value, x0 + layout.pad, baseline, value_size, VALUE_RGB, bold=True, anchor="ls"))
        if card.unit:
            texts.append(TextItem(card.unit, x1 - layout.pad, baseline, unit_size, ACCENT_RGB, bold=True, anchor="rs"))
        if card.progress is not None:
            bar_y1 = int(bar_y0 + 7 * s)
            bar_x0, bar_x1 = x0 + layout.pad, x1 - layout.pad
            cv2.rectangle(frame, (bar_x0, bar_y0), (bar_x1, bar_y1), TRACK_BGR, -1)
            filled = bar_x0 + int((bar_x1 - bar_x0) * float(np.clip(card.progress, 0.0, 1.0)))
            if filled > bar_x0:
                cv2.rectangle(frame, (bar_x0, bar_y0), (filled, bar_y1), ACCENT_BGR, -1)
        y += height + layout.gap
    return y


def pill(frame: np.ndarray, x: int, y: int, text: str, size: float, fill_bgr: Tuple[int, int, int], texts: List[TextItem], alpha: float = 0.88) -> Tuple[int, int, int, int]:
    """Rounded label; returns its box (x, y, width, height)."""
    width = int(font(size, True).getlength(text) + size * 1.2)
    height = int(size * 1.7)
    rounded_box(frame, x, y, x + width, y + height, height // 2, fill_bgr, alpha)
    texts.append(TextItem(text, x + width / 2, y + height / 2, size, VALUE_RGB, bold=True, anchor="mm"))
    return x, y, width, height


def render_text(frame: np.ndarray, texts: List[TextItem]) -> np.ndarray:
    """All text in one PIL pass (one colour conversion per frame)."""
    if not texts:
        return frame
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    painter = ImageDraw.Draw(image)
    for item in texts:
        painter.text((item.x, item.y), item.text, font=font(item.size, item.bold), fill=item.rgb, anchor=item.anchor)
    return cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
