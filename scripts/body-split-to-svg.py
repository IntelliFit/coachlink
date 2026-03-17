#!/usr/bin/env python3
"""
将人体正面/背面示意图 (body-front.jpg, body-back.jpg) 转为无填充的 SVG 路径。

流程：
  1. 灰度化 → 二值化（Otsu 自动阈值）
  2. Canny 边缘检测得到二值边缘图
  3. findContours 得到每一个连通轮廓
  4. 对轮廓按采样率（每隔 N 个点取一点）采样，得到有序点列
  5. 每个连通轮廓输出为一条 <path>，仅描边、不保留颜色

依赖: pip install -r scripts/requirements-body-to-svg.txt
用法: 在项目根目录执行 python scripts/body-split-to-svg.py
"""

from pathlib import Path
import sys

try:
    import cv2
    import numpy as np
except ImportError:
    print("请先安装依赖: pip install -r scripts/requirements-body-to-svg.txt")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "docs" / "assets"

# 源图与输出一一对应
INPUT_OUTPUT_PAIRS = [
    (ASSETS / "body-front.jpg", ASSETS / "body-front.svg"),
    (ASSETS / "body-back.jpg", ASSETS / "body-back.svg"),
]

# 二值化：Otsu 自动阈值（0=使用 Otsu，>0 则固定阈值）
BINARIZE_THRESHOLD = 0  # 0 表示 cv2.THRESH_OTSU

# Canny 阈值（可调）
CANNY_LOW = 50
CANNY_HIGH = 150

# 轮廓点采样：每隔 sample_step 个点取 1 个
SAMPLE_STEP = 2

# 忽略周长过小的轮廓（像素）
MIN_PERIMETER = 10

# 调试：是否在每步弹出 Windows 窗口展示中间结果（按任意键进入下一步）
SHOW_DEBUG_WINDOWS = True


def to_grayscale(img):
    """转为灰度图。"""
    if len(img.shape) == 2:
        return img
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def binarize(gray, thresh=BINARIZE_THRESHOLD):
    """
    二值化：Otsu 自动阈值或固定阈值。
    thresh=0 时使用 Otsu；>0 时使用固定阈值。
    """
    if thresh == 0:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        _, binary = cv2.threshold(gray, thresh, 255, cv2.THRESH_BINARY)
    return binary


def canny_edges(binary, low=CANNY_LOW, high=CANNY_HIGH, blur_ksize=(3, 3)):
    """二值图 → 高斯模糊 → Canny → 二值边缘图。"""
    if blur_ksize:
        img = cv2.GaussianBlur(binary, blur_ksize, 0)
    else:
        img = binary
    edges = cv2.Canny(img, low, high)
    return edges


def get_connected_contours(edges):
    """
    在 Canny 二值图上用 findContours 获取每一个连通轮廓。
    返回 list of ndarray，每个为 (N, 1, 2) 的点序列。
    """
    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_LIST,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    return contours


def sample_contour_points(contour, step):
    """
    对轮廓点按步长采样，保持顺序。
    contour: (N, 1, 2)；step: 每隔 step 个取 1 个（1 表示全保留）。
    """
    pts = contour.reshape(-1, 2)
    n = len(pts)
    if n < 3:
        return pts
    step = max(1, int(step))
    indices = list(range(0, n, step))
    if indices[-1] != n - 1:
        indices.append(n - 1)
    return pts[indices]


def contour_to_path_d(contour, sample_step=1):
    """一个轮廓 → 采样后的点 → SVG path 的 d 字符串（M x y L x y ... Z）。"""
    pts = sample_contour_points(contour, sample_step)
    if len(pts) < 2:
        return None
    parts = [f"M {pts[0][0]:.1f} {pts[0][1]:.1f}"]
    for i in range(1, len(pts)):
        parts.append(f"L {pts[i][0]:.1f} {pts[i][1]:.1f}")
    parts.append("Z")
    return " ".join(parts)


def build_svg_paths_from_edges(edges, sample_step=SAMPLE_STEP, min_perimeter=MIN_PERIMETER):
    """从 Canny 边缘图得到所有连通轮廓，采样后转为 SVG path 的 d 列表。"""
    contours = get_connected_contours(edges)
    paths = []
    for cnt in contours:
        if len(cnt) < 3:
            continue
        peri = cv2.arcLength(cnt, True)
        if peri < min_perimeter:
            continue
        d = contour_to_path_d(cnt, sample_step)
        if d:
            paths.append(d)
    return paths


def _show_debug(name: str, frame, prefix: str = ""):
    """在 Windows 窗口显示一帧图像，用于调试。"""
    if not SHOW_DEBUG_WINDOWS:
        return
    win_name = f"{prefix} | {name}" if prefix else name
    cv2.imshow(win_name, frame)


def process_image(src_path: Path, out_path: Path, title: str) -> int:
    """
    对单张图片执行：灰度 → 二值化 → Canny → 轮廓采样 → 输出 SVG。
    返回 path 数量。
    """
    img = cv2.imread(str(src_path))
    if img is None:
        print(f"  无法读取图像: {src_path}")
        return 0

    prefix = src_path.stem

    # 1. 原图
    _show_debug("1-原图", img, prefix)

    gray = to_grayscale(img)
    _show_debug("2-灰度", gray, prefix)

    binary = binarize(gray)
    _show_debug("3-二值化", binary, prefix)

    edges = canny_edges(binary)
    _show_debug("4-Canny边缘", edges, prefix)

    contours = get_connected_contours(edges)
    # 5. 轮廓叠加：在原图副本上绘制轮廓
    contour_vis = img.copy()
    cv2.drawContours(contour_vis, contours, -1, (0, 255, 0), 1)
    _show_debug("5-轮廓叠加", contour_vis, prefix)

    paths = build_svg_paths_from_edges(edges, sample_step=SAMPLE_STEP, min_perimeter=MIN_PERIMETER)

    if SHOW_DEBUG_WINDOWS:
        print(f"  [{prefix}] 请查看窗口，按任意键继续...")
        cv2.waitKey(0)

    h, w = img.shape[:2]

    path_elements = "\n".join(
        f'  <path fill="none" stroke="black" stroke-width="1" d="{d}"/>'
        for d in paths
    )

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <title>{title}</title>
  <desc>由 {src_path.name} 经二值化、Canny 边缘检测与连通轮廓采样得到的矢量路径，无颜色。</desc>
{path_elements}
</svg>
'''

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(svg, encoding="utf-8")
    return len(paths)


def main():
    total_ok = 0
    for src, out in INPUT_OUTPUT_PAIRS:
        if not src.exists():
            print(f"跳过（未找到）: {src}")
            continue
        title = src.stem.replace("-", " ").title()
        n = process_image(src, out, title)
        print(f"已生成: {out}（共 {n} 条 path）")
        total_ok += 1

    if total_ok == 0:
        print("未找到任何源图像，请确保 docs/assets/ 下存在 body-front.jpg 和/或 body-back.jpg")
        sys.exit(1)

    if SHOW_DEBUG_WINDOWS:
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
