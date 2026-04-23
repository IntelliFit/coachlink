from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
INPUT_MD = ROOT / "docs" / "CoachLink_商业计划书_v2_1.md"
OUTPUT_PDF = ROOT / "output" / "pdf" / "CoachLink_商业计划书_v2_1.pdf"

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 1.65 * cm
MARGIN_Y = 1.55 * cm

FONT_NAME = "CoachLinkDengXian"
FONT_BOLD = "CoachLinkDengXianBold"
FONT_PATH = Path(r"C:\Windows\Fonts\Deng.ttf")
FONT_BOLD_PATH = Path(r"C:\Windows\Fonts\Dengb.ttf")
TITLE_COLOR = colors.HexColor("#1f2933")
TEXT_COLOR = colors.HexColor("#2b3340")
MUTED_COLOR = colors.HexColor("#64707d")
ACCENT = colors.HexColor("#c65f46")
ACCENT_DARK = colors.HexColor("#8f3f2e")
SOFT_BG = colors.HexColor("#f6f2ee")
SOFT_BLUE = colors.HexColor("#eef4f8")
GRID = colors.HexColor("#d9dee3")


def register_fonts() -> None:
    if not FONT_PATH.exists():
        raise FileNotFoundError(f"Missing Chinese font: {FONT_PATH}")
    pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH), validate=0))
    if FONT_BOLD_PATH.exists():
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(FONT_BOLD_PATH), validate=0))
    else:
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(FONT_PATH), validate=0))


def normalize_text(text: str) -> str:
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u2212": "-",
        "\u00a0": " ",
        "\ufe0f": "",
        "\u200b": "",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    # Strip emoji and pictographs that CJK PDF base fonts cannot render reliably.
    text = re.sub(r"[\U0001F300-\U0001FAFF]", "", text)
    return text


def clean_inline(text: str) -> str:
    text = normalize_text(text).strip()
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = text.replace("**", "")
    text = text.replace("__", "")
    text = text.replace("*", "")
    return html.escape(text)


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    styles: dict[str, ParagraphStyle] = {}

    styles["cover_title"] = ParagraphStyle(
        "cover_title",
        parent=base["Title"],
        fontName=FONT_BOLD,
        fontSize=27,
        leading=34,
        textColor=TITLE_COLOR,
        alignment=TA_LEFT,
        spaceAfter=12,
        wordWrap="CJK",
    )
    styles["cover_subtitle"] = ParagraphStyle(
        "cover_subtitle",
        parent=base["Normal"],
        fontName=FONT_NAME,
        fontSize=14,
        leading=21,
        textColor=ACCENT_DARK,
        alignment=TA_LEFT,
        spaceAfter=18,
        wordWrap="CJK",
    )
    styles["cover_body"] = ParagraphStyle(
        "cover_body",
        parent=base["Normal"],
        fontName=FONT_NAME,
        fontSize=10.5,
        leading=18,
        textColor=TEXT_COLOR,
        alignment=TA_LEFT,
        wordWrap="CJK",
    )
    styles["h1"] = ParagraphStyle(
        "h1",
        parent=base["Heading1"],
        fontName=FONT_BOLD,
        fontSize=20,
        leading=27,
        textColor=TITLE_COLOR,
        spaceBefore=10,
        spaceAfter=14,
        wordWrap="CJK",
    )
    styles["h2"] = ParagraphStyle(
        "h2",
        parent=base["Heading2"],
        fontName=FONT_BOLD,
        fontSize=16,
        leading=23,
        textColor=ACCENT_DARK,
        spaceBefore=16,
        spaceAfter=10,
        wordWrap="CJK",
    )
    styles["h3"] = ParagraphStyle(
        "h3",
        parent=base["Heading3"],
        fontName=FONT_BOLD,
        fontSize=12.5,
        leading=18,
        textColor=TITLE_COLOR,
        spaceBefore=10,
        spaceAfter=6,
        wordWrap="CJK",
    )
    styles["body"] = ParagraphStyle(
        "body",
        parent=base["BodyText"],
        fontName=FONT_NAME,
        fontSize=9.7,
        leading=16,
        textColor=TEXT_COLOR,
        alignment=TA_JUSTIFY,
        spaceAfter=7,
        wordWrap="CJK",
    )
    styles["bullet"] = ParagraphStyle(
        "bullet",
        parent=styles["body"],
        leftIndent=13,
        firstLineIndent=0,
        bulletIndent=0,
        spaceAfter=5,
    )
    styles["quote"] = ParagraphStyle(
        "quote",
        parent=styles["body"],
        leftIndent=12,
        rightIndent=8,
        borderColor=ACCENT,
        borderWidth=0,
        borderPadding=7,
        backColor=SOFT_BG,
        textColor=ACCENT_DARK,
        spaceBefore=5,
        spaceAfter=10,
    )
    styles["small"] = ParagraphStyle(
        "small",
        parent=styles["body"],
        fontSize=8.2,
        leading=12,
        textColor=MUTED_COLOR,
    )
    styles["table_header"] = ParagraphStyle(
        "table_header",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=8.2,
        leading=11,
        textColor=colors.white,
        alignment=TA_CENTER,
        wordWrap="CJK",
    )
    styles["table_cell"] = ParagraphStyle(
        "table_cell",
        parent=base["Normal"],
        fontName=FONT_NAME,
        fontSize=8.0,
        leading=11.5,
        textColor=TEXT_COLOR,
        wordWrap="CJK",
    )
    styles["code"] = ParagraphStyle(
        "code",
        parent=base["Code"],
        fontName=FONT_NAME,
        fontSize=8.2,
        leading=12,
        textColor=TITLE_COLOR,
        backColor=SOFT_BLUE,
        borderPadding=7,
        wordWrap="CJK",
    )
    return styles


def draw_first_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(SOFT_BG)
    canvas.rect(0, PAGE_HEIGHT - 4.6 * cm, PAGE_WIDTH, 4.6 * cm, fill=1, stroke=0)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, PAGE_HEIGHT - 4.6 * cm, 0.35 * cm, 4.6 * cm, fill=1, stroke=0)
    canvas.setFont(FONT_NAME, 8)
    canvas.setFillColor(MUTED_COLOR)
    canvas.drawString(MARGIN_X, 0.85 * cm, "CoachLink Business Plan v2.1")
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, 0.85 * cm, "2026.04")
    canvas.restoreState()


def draw_later_pages(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont(FONT_NAME, 8)
    canvas.setFillColor(MUTED_COLOR)
    canvas.drawString(MARGIN_X, PAGE_HEIGHT - 0.9 * cm, "CoachLink 商业计划书 v2.1")
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 0.9 * cm, "自由教练商业化操作系统")
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.3)
    canvas.line(MARGIN_X, PAGE_HEIGHT - 1.08 * cm, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 1.08 * cm)
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, 0.72 * cm, f"{doc.page}")
    canvas.restoreState()


def cover_page(styles: dict[str, ParagraphStyle], doc_width: float) -> list[Flowable]:
    metrics = [
        ["注册用户", "1,296", "已批准教练", "15"],
        ["活跃教练", "3", "付费订阅用户", "14"],
        ["教练订阅关系", "126", "完成训练记录", "794"],
        ["完成整套计划", "5", "上传训练视频用户", "16"],
    ]
    metric_table = Table(
        [
            [
                Paragraph(clean_inline(cell), styles["table_header"] if idx % 2 == 0 else styles["table_cell"])
                for idx, cell in enumerate(row)
            ]
            for row in metrics
        ],
        colWidths=[doc_width * 0.16, doc_width * 0.22, doc_width * 0.18, doc_width * 0.22],
        hAlign="LEFT",
    )
    metric_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), ACCENT),
                ("BACKGROUND", (2, 0), (2, -1), ACCENT),
                ("BACKGROUND", (1, 0), (1, -1), colors.white),
                ("BACKGROUND", (3, 0), (3, -1), colors.white),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
                ("TEXTCOLOR", (2, 0), (2, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, GRID),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    return [
        Spacer(1, 0.25 * cm),
        Paragraph("CoachLink 商业计划书 v2.1", styles["cover_title"]),
        Paragraph("线上自由教练的商业化操作系统", styles["cover_subtitle"]),
        Paragraph(
            "从“力量训练工具”升级为“自由教练商业化基础设施”：不替教练抢流量，"
            "而是帮助教练把已有内容影响力沉淀为可订阅、可交付、可续费的线上训练服务。",
            styles["cover_body"],
        ),
        Spacer(1, 0.55 * cm),
        metric_table,
        Spacer(1, 0.55 * cm),
        Paragraph(
            "当前阶段判断：产品闭环已初步跑通，但增长瓶颈不在功能数量，而在教练从入驻到收款的首个成功路径。"
            "下一阶段应优先打造标杆教练、简化发布服务流程，并把交付数据转化为续费理由。",
            styles["quote"],
        ),
        Spacer(1, 0.3 * cm),
        Paragraph("版本：v2.1  |  日期：2026年4月  |  输出：增强排版 PDF", styles["small"]),
        PageBreak(),
    ]


def strip_intro(lines: list[str]) -> list[str]:
    if not lines:
        return lines
    i = 0
    if lines[i].startswith("# "):
        i += 1
    while i < len(lines) and (not lines[i].strip() or lines[i].startswith(">")):
        i += 1
    if i < len(lines) and lines[i].strip() == "---":
        i += 1
    while i < len(lines) and not lines[i].strip():
        i += 1
    return lines[i:]


def parse_table(table_lines: list[str], styles: dict[str, ParagraphStyle], doc_width: float) -> Table | None:
    rows: list[list[str]] = []
    for line in table_lines:
        parts = [part.strip() for part in line.strip().strip("|").split("|")]
        if not parts:
            continue
        if all(re.fullmatch(r":?-{3,}:?", part) for part in parts):
            continue
        rows.append(parts)
    if not rows:
        return None

    col_count = max(len(row) for row in rows)
    normalized = [row + [""] * (col_count - len(row)) for row in rows]
    col_widths = [doc_width / col_count] * col_count
    data = []
    for row_idx, row in enumerate(normalized):
        row_style = styles["table_header"] if row_idx == 0 else styles["table_cell"]
        data.append([Paragraph(clean_inline(cell), row_style) for cell in row])

    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fbfbfa")]),
            ]
        )
    )
    return table


def flush_paragraph(
    story: list[Flowable],
    paragraph_lines: list[str],
    styles: dict[str, ParagraphStyle],
) -> None:
    if not paragraph_lines:
        return
    text = " ".join(line.strip() for line in paragraph_lines)
    if text:
        story.append(Paragraph(clean_inline(text), styles["body"]))
    paragraph_lines.clear()


def collect_list(
    lines: list[str],
    start: int,
    ordered: bool,
    styles: dict[str, ParagraphStyle],
) -> tuple[ListFlowable, int]:
    items: list[ListItem] = []
    i = start
    pattern = r"^\d+\.\s+(.+)" if ordered else r"^-\s+(.+)"
    while i < len(lines):
        match = re.match(pattern, lines[i].strip())
        if not match:
            break
        paragraph = Paragraph(clean_inline(match.group(1)), styles["bullet"])
        items.append(ListItem(paragraph, leftIndent=10))
        i += 1
    bullet_type = "1" if ordered else "bullet"
    return ListFlowable(items, bulletType=bullet_type, start="1", leftIndent=10), i


def parse_markdown(markdown: str, styles: dict[str, ParagraphStyle], doc_width: float) -> list[Flowable]:
    lines = strip_intro(markdown.splitlines())
    story: list[Flowable] = []
    paragraph_lines: list[str] = []
    section_count = 0
    i = 0

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            flush_paragraph(story, paragraph_lines, styles)
            i += 1
            continue

        if stripped == "---":
            flush_paragraph(story, paragraph_lines, styles)
            story.append(Spacer(1, 0.15 * cm))
            story.append(HRFlowable(width="100%", thickness=0.4, color=GRID, spaceBefore=4, spaceAfter=8))
            i += 1
            continue

        if stripped.startswith("|"):
            flush_paragraph(story, paragraph_lines, styles)
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            table = parse_table(table_lines, styles, doc_width)
            if table:
                story.append(Spacer(1, 0.1 * cm))
                story.append(table)
                story.append(Spacer(1, 0.25 * cm))
            continue

        if stripped.startswith("```"):
            flush_paragraph(story, paragraph_lines, styles)
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            if i < len(lines):
                i += 1
            story.append(Paragraph(clean_inline("<br/>".join(code_lines)), styles["code"]))
            story.append(Spacer(1, 0.2 * cm))
            continue

        if stripped.startswith("## "):
            flush_paragraph(story, paragraph_lines, styles)
            section_count += 1
            if section_count > 1:
                story.append(PageBreak())
            story.append(Paragraph(clean_inline(stripped[3:]), styles["h1"]))
            i += 1
            continue

        if stripped.startswith("### "):
            flush_paragraph(story, paragraph_lines, styles)
            story.append(Paragraph(clean_inline(stripped[4:]), styles["h2"]))
            i += 1
            continue

        if stripped.startswith("#### "):
            flush_paragraph(story, paragraph_lines, styles)
            story.append(Paragraph(clean_inline(stripped[5:]), styles["h3"]))
            i += 1
            continue

        if stripped.startswith(">"):
            flush_paragraph(story, paragraph_lines, styles)
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote_lines.append(lines[i].strip().lstrip(">").strip())
                i += 1
            story.append(Paragraph(clean_inline(" ".join(quote_lines)), styles["quote"]))
            continue

        if re.match(r"^-\s+", stripped):
            flush_paragraph(story, paragraph_lines, styles)
            flow, i = collect_list(lines, i, ordered=False, styles=styles)
            story.append(flow)
            story.append(Spacer(1, 0.08 * cm))
            continue

        if re.match(r"^\d+\.\s+", stripped):
            flush_paragraph(story, paragraph_lines, styles)
            flow, i = collect_list(lines, i, ordered=True, styles=styles)
            story.append(flow)
            story.append(Spacer(1, 0.08 * cm))
            continue

        paragraph_lines.append(stripped)
        i += 1

    flush_paragraph(story, paragraph_lines, styles)
    return story


def count_pages(pdf_path: Path) -> int:
    data = pdf_path.read_bytes()
    return len(re.findall(rb"/Type\s*/Page\b", data))


def main() -> None:
    register_fonts()
    styles = make_styles()

    if not INPUT_MD.exists():
        raise FileNotFoundError(f"Missing input markdown: {INPUT_MD}")

    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    markdown = INPUT_MD.read_text(encoding="utf-8")

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        rightMargin=MARGIN_X,
        leftMargin=MARGIN_X,
        topMargin=MARGIN_Y,
        bottomMargin=MARGIN_Y,
        title="CoachLink 商业计划书 v2.1",
        author="CoachLink",
        subject="自由教练商业化操作系统",
    )

    story: list[Flowable] = []
    story.extend(cover_page(styles, doc.width))
    story.extend(parse_markdown(markdown, styles, doc.width))

    doc.build(story, onFirstPage=draw_first_page, onLaterPages=draw_later_pages)
    pages = count_pages(OUTPUT_PDF)
    print(f"Generated {OUTPUT_PDF}")
    print(f"Size: {OUTPUT_PDF.stat().st_size} bytes")
    print(f"Pages: {pages}")


if __name__ == "__main__":
    main()
