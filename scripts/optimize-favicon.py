#!/usr/bin/env python3
"""
优化 favicon 为正方形，并生成标准网站图标与 PWA 所需尺寸。
同时更新 public/site.webmanifest 与 src/app/layout.tsx 的 SEO/图标配置。

依赖: pip install -r scripts/requirements-favicon.txt
用法: 在项目根目录执行 python scripts/optimize-favicon.py
"""

from pathlib import Path
import json
import sys

try:
    from PIL import Image
except ImportError:
    print("请先安装依赖: pip install -r scripts/requirements-favicon.txt")
    sys.exit(1)

# 项目根目录（脚本在 scripts/ 下）
ROOT = Path(__file__).resolve().parent.parent
SRC_FAVICON = ROOT / "public" / "favicon.jpg"
OUT_DIR = ROOT / "public" / "icons"
MANIFEST_PATH = ROOT / "public" / "site.webmanifest"
LAYOUT_PATH = ROOT / "src" / "app" / "layout.tsx"

# 网站 favicon 常用尺寸
FAVICON_SIZES = [16, 32, 48]

# PWA 图标尺寸（含 192、512 最低要求及常用中间尺寸）
PWA_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

# Apple Touch Icon
APPLE_TOUCH_SIZE = 180

# Logo 相对画布的缩放；1.0=不缩放，<1 留白更多，>1 更满（过大可能裁切 c/k）
LOGO_SCALE = 1.1

# 填充色（剩余部分）
FILL_COLOR = (255, 255, 255, 255)


def load_and_square_with_padding(path: Path) -> Image.Image:
    """将图片变为正方形：保留全部内容，不足处用 FILL_COLOR 填充；LOGO_SCALE 可微调缩放。"""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    size = max(w, h)
    canvas = Image.new("RGBA", (size, size), FILL_COLOR)
    scale = LOGO_SCALE
    nw, nh = int(round(w * scale)), int(round(h * scale))
    nw, nh = max(1, nw), max(1, nh)
    scaled = img.resize((nw, nh), Image.Resampling.LANCZOS) if scale != 1.0 else img
    paste_x = (size - nw) // 2
    paste_y = (size - nh) // 2
    canvas.paste(scaled, (paste_x, paste_y))
    return canvas


def generate_icons(img: Image.Image) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Favicon PNG
    for s in FAVICON_SIZES:
        out = img.resize((s, s), Image.Resampling.LANCZOS)
        out.save(OUT_DIR / f"favicon-{s}x{s}.png", "PNG", optimize=True)

    # favicon.ico（多尺寸 16/32/48）
    ico_sizes = [(s, s) for s in FAVICON_SIZES]
    img_ico = img.resize((48, 48), Image.Resampling.LANCZOS)
    img_ico.save(OUT_DIR / "favicon.ico", format="ICO", sizes=ico_sizes)

    # Apple Touch Icon
    apple = img.resize((APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE), Image.Resampling.LANCZOS)
    apple.save(OUT_DIR / "apple-touch-icon.png", "PNG", optimize=True)

    # PWA icons
    for s in PWA_SIZES:
        out = img.resize((s, s), Image.Resampling.LANCZOS)
        out.save(OUT_DIR / f"icon-{s}.png", "PNG", optimize=True)

    print(f"已生成图标到 {OUT_DIR}")


def update_manifest() -> None:
    icons = []
    for s in PWA_SIZES:
        icons.append({
            "src": f"/icons/icon-{s}.png",
            "sizes": f"{s}x{s}",
            "type": "image/png",
        })

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["icons"] = icons

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"已更新 {MANIFEST_PATH}")


def update_layout() -> None:
    with open(LAYOUT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    old_block = """        icons: {
            icon: [
                { url: '/favicon.svg', type: 'image/svg+xml' },
                { url: '/favicon.jpg', type: 'image/jpeg' },
            ],
            shortcut: [{ url: '/favicon.jpg', type: 'image/jpeg' }],
            apple: [{ url: '/favicon.jpg', type: 'image/jpeg' }],
        },"""

    new_block = """        icons: {
            icon: [
                { url: '/icons/favicon.ico', type: 'image/x-icon', sizes: 'any' },
                { url: '/icons/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
                { url: '/icons/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
                { url: '/icons/favicon-48x48.png', type: 'image/png', sizes: '48x48' },
            ],
            shortcut: [{ url: '/icons/favicon.ico', type: 'image/x-icon', sizes: 'any' }],
            apple: [{ url: '/icons/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
        },"""

    if new_block in content:
        print("layout.tsx 已为 icons 新配置，跳过。")
        return
    if old_block not in content:
        print("未在 layout.tsx 中找到 icons 块，请手动更新。")
        return
    content = content.replace(old_block, new_block, 1)
    with open(LAYOUT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"已更新 {LAYOUT_PATH}")


def main() -> None:
    if not SRC_FAVICON.exists():
        print(f"未找到源图标: {SRC_FAVICON}")
        sys.exit(1)
    img = load_and_square_with_padding(SRC_FAVICON)
    generate_icons(img)
    update_manifest()
    update_layout()
    print("完成。")


if __name__ == "__main__":
    main()
