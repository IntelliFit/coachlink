#!/usr/bin/env python3
"""
将人体肌肉示意图 (body.jpg) 按边缘提取为无填充的 SVG 路径。

流程：
  1. 灰度化 → Canny 边缘检测得到二值边缘图
  2. 对边缘图做 findContours 得到每一个连通轮廓
  3. 对每个轮廓按采样率（每隔 N 个点取一点）采样，得到有序点列
  4. 每个连通轮廓输出为一条 <path>，仅描边、不保留颜色

依赖: pip install -r scripts/requirements-body-to-svg.txt
用法: 在项目根目录执行 python scripts/body-image-to-svg.py
"""

from pathlib import Path
import sys

try:
    import cv2
    import numpy as np
except ImportError:
    print("请先安装依赖: pip install -r scripts/requirements-body-to-svg.txt")
    sys.exit(1)

# 项目路径
ROOT = Path(__file__).resolve().parent.parent
SRC_IMAGE = ROOT / "docs" / "assets" / "body.jpg"
OUT_SVG = ROOT / "docs" / "assets" / "body.svg"

# Canny 阈值（可调）
CANNY_LOW = 50
CANNY_HIGH = 150

# 轮廓点采样：每隔 sample_step 个点取 1 个（1=不采样，2=取一半，3=取 1/3…）
SAMPLE_STEP = 2

# 忽略周长过小的轮廓（像素）
MIN_PERIMETER = 10


def canny_edges(gray, low=CANNY_LOW, high=CANNY_HIGH, blur_ksize=(3, 3)):
    """灰度图 → 高斯模糊 → Canny → 二值边缘图。"""
    if blur_ksize:
        gray = cv2.GaussianBlur(gray, blur_ksize, 0)
    edges = cv2.Canny(gray, low, high)
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
        indices.append(n - 1)  # 保证闭合：保留最后一个点
    return pts[indices]


def contour_to_path_d(contour, sample_step=1):
    """
    一个轮廓 → 采样后的点 → SVG path 的 d 字符串（M x y L x y ... Z）。
    """
    pts = sample_contour_points(contour, sample_step)
    if len(pts) < 2:
        return None
    parts = [f"M {pts[0][0]:.1f} {pts[0][1]:.1f}"]
    for i in range(1, len(pts)):
        parts.append(f"L {pts[i][0]:.1f} {pts[i][1]:.1f}")
    parts.append("Z")
    return " ".join(parts)


def build_svg_paths_from_edges(edges, sample_step=SAMPLE_STEP, min_perimeter=MIN_PERIMETER):
    """
    从 Canny 边缘图得到所有连通轮廓，采样后转为 SVG path 的 d 列表。
    """
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


def main():
    if not SRC_IMAGE.exists():
        print(f"未找到源图像: {SRC_IMAGE}")
        sys.exit(1)

    img = cv2.imread(str(SRC_IMAGE))
    if img is None:
        print("无法读取图像，请检查格式与路径。")
        sys.exit(1)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = canny_edges(gray)
    paths = build_svg_paths_from_edges(edges, sample_step=SAMPLE_STEP, min_perimeter=MIN_PERIMETER)

    h, w = img.shape[:2]

    path_elements = "\n".join(
        f'  <path fill="none" stroke="black" stroke-width="1" d="{d}"/>'
        for d in paths
    )

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <title>人体肌肉示意图 - 轮廓</title>
  <desc>由 body.jpg 经 Canny 边缘检测与连通轮廓采样得到的矢量路径，无颜色。</desc>
{path_elements}
</svg>
'''

    OUT_SVG.parent.mkdir(parents=True, exist_ok=True)
    OUT_SVG.write_text(svg, encoding="utf-8")
    print(f"已生成: {OUT_SVG}（共 {len(paths)} 条 path）")


if __name__ == "__main__":
    main()
