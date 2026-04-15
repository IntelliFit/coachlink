#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CoachLink 前端全量 PRD 文档生成器
读取 tmp_*.json 数据 + 扫描 Web 目录结构，生成树状 PRD 文档。
"""

import json
import os
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = BASE_DIR.parent.parent

def slugify(name):
    return re.sub(r"[^\w\-]+", "-", name).strip("-").lower()

def write_file(path, content):
    full = BASE_DIR / path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")

def normalize_states(states):
    if isinstance(states, list):
        return [str(s) for s in states]
    if isinstance(states, dict):
        return [f"{k}：{v}" for k, v in states.items()]
    return []

def normalize_interactions(interactions):
    out = []
    for item in interactions:
        if isinstance(item, dict):
            out.append((
                item.get("name", item.get("name", "")),
                item.get("type", item.get("type", "")),
                item.get("behavior", item.get("action", item.get("behavior", ""))),
                item.get("target", None),
            ))
        elif isinstance(item, (list, tuple)) and len(item) >= 3:
            out.append(tuple(item))
    return out

def render_prd(page_id, title, route, module_name, summary, interactions, states, related):
    lines = [
        f"# {title}",
        "",
        f"- **路由**：`{route}`",
        f"- **所属模块**：{module_name}",
        f"- **功能概述**：{summary}",
        "",
        "## 交互元素清单",
        "",
        "| 元素名称 | 类型 | 触发行为 | 跳转目标 |",
        "|---|---|---|---|",
    ]
    for item in interactions:
        target = item[3] if len(item) > 3 and item[3] else "—"
        if target and not target.startswith(("http", "#", "./", "../", "`")):
            target = f"`{target}`"
        lines.append(f"| {item[0]} | {item[1]} | {item[2]} | {target} |")
    lines += ["", "## 页面状态与异常态", ""]
    if states:
        for st in states:
            lines.append(f"- {st}")
    else:
        lines.append("- 无特殊状态")
    lines += ["", "## 相关页面", ""]
    for rel in related:
        lines.append(f"- [{rel['title']}]({rel['path']})")
    lines.append("")
    return "\n".join(lines)

def build_related(pages, current_id, current_dir):
    related = []
    for p in pages:
        if p["id"] == current_id:
            continue
        # 如果同目录
        rel_path = f"./{p['file_name']}"
        related.append({"title": p["title"], "path": rel_path})
    return related

# ============================================================
# 1. 读取已有 JSON 数据
# ============================================================

def load_json(path):
    with open(BASE_DIR / path, "r", encoding="utf-8") as f:
        return json.load(f)

data_auth_discovery = load_json("tmp_auth_discovery.json")
data_coach = load_json("tmp_coach.json")
data_training = load_json("tmp_training.json")
data_me = load_json("tmp_me.json")
data_web_dc = load_json("tmp_web_dashboard_coach.json")
data_web_admin = load_json("tmp_web_admin.json")

# ============================================================
# 2. 转换数据为统一格式
# ============================================================

all_files = []  # 用于记录生成文件清单

def process_weapp_auth():
    pages = []
    for item in data_auth_discovery[:5]:
        pid = slugify(item["pageName"])
        pages.append({
            "id": pid,
            "file_name": f"{pid}.md",
            "title": item["pageName"],
            "route": item["routePath"],
            "summary": item["description"],
            "interactions": normalize_interactions(item.get("interactiveElements", [])),
            "states": normalize_states(item.get("states", [])),
            "dir": "weapp/01-auth",
        })
    # README
    readme = "# 认证模块（小程序）\n\n"
    for p in pages:
        readme += f"- [{p['title']}](./{p['file_name']})\n"
    write_file("weapp/01-auth/README.md", readme)
    for p in pages:
        related = build_related(pages, p["id"], p["dir"])
        content = render_prd(p["id"], p["title"], p["route"], "小程序 / 认证", p["summary"], p["interactions"], p["states"], related)
        write_file(f"{p['dir']}/{p['file_name']}", content)
        all_files.append(f"{p['dir']}/{p['file_name']}")

def process_weapp_discovery():
    pages = []
    for item in data_auth_discovery[5:]:
        pid = slugify(item["pageName"])
        # avoid dup slug
        if pid == "index":
            pid = "discovery-index"
        pages.append({
            "id": pid,
            "file_name": f"{pid}.md",
            "title": item["pageName"],
            "route": item["routePath"],
            "summary": item["description"],
            "interactions": normalize_interactions(item.get("interactiveElements", [])),
            "states": normalize_states(item.get("states", [])),
            "dir": "weapp/02-discovery",
        })
    # 补充 generate-plan-waiting
    for p in pages:
        if p["title"] == "计划生成等待页":
            p["id"] = "generate-plan-waiting"
            p["file_name"] = "generate-plan-waiting.md"
    readme = "# 发现与首页模块（小程序）\n\n"
    for p in pages:
        readme += f"- [{p['title']}](./{p['file_name']})\n"
    write_file("weapp/02-discovery/README.md", readme)
    for p in pages:
        related = build_related(pages, p["id"], p["dir"])
        content = render_prd(p["id"], p["title"], p["route"], "小程序 / 发现", p["summary"], p["interactions"], p["states"], related)
        write_file(f"{p['dir']}/{p['file_name']}", content)
        all_files.append(f"{p['dir']}/{p['file_name']}")

def process_weapp_training():
    pages = []
    for item in data_training["pages"]:
        pid = slugify(item["pageName"])
        if pid == "index":
            pid = "training-index"
        pages.append({
            "id": pid,
            "file_name": f"{pid}.md",
            "title": item["pageName"],
            "route": item.get("route", item.get("routePath", "")),
            "summary": item["description"],
            "interactions": normalize_interactions(item.get("interactions", item.get("interactiveElements", []))),
            "states": normalize_states(item.get("states", [])),
            "dir": "weapp/03-training",
        })
    readme = "# 训练模块（小程序）\n\n"
    for p in pages:
        readme += f"- [{p['title']}](./{p['file_name']})\n"
    write_file("weapp/03-training/README.md", readme)
    for p in pages:
        related = build_related(pages, p["id"], p["dir"])
        content = render_prd(p["id"], p["title"], p["route"], "小程序 / 训练", p["summary"], p["interactions"], p["states"], related)
        write_file(f"{p['dir']}/{p['file_name']}", content)
        all_files.append(f"{p['dir']}/{p['file_name']}")

def process_weapp_me():
    pages = []
    for item in data_me["pages"]:
        pid = slugify(item["pageName"])
        pages.append({
            "id": pid,
            "file_name": f"{pid}.md",
            "title": item["pageName"],
            "route": item.get("route", item.get("routePath", "")),
            "summary": item["description"],
            "interactions": normalize_interactions(item.get("interactions", item.get("interactiveElements", []))),
            "states": normalize_states(item.get("states", [])),
            "dir": "weapp/04-me",
        })
    readme = "# 个人中心模块（小程序）\n\n"
    for p in pages:
        readme += f"- [{p['title']}](./{p['file_name']})\n"
    write_file("weapp/04-me/README.md", readme)
    for p in pages:
        related = build_related(pages, p["id"], p["dir"])
        content = render_prd(p["id"], p["title"], p["route"], "小程序 / 个人中心", p["summary"], p["interactions"], p["states"], related)
        write_file(f"{p['dir']}/{p['file_name']}", content)
        all_files.append(f"{p['dir']}/{p['file_name']}")

def process_weapp_coach():
    pages = []
    for item in data_coach["pages"]:
        pid = slugify(item["pageName"])
        pages.append({
            "id": pid,
            "file_name": f"{pid}.md",
            "title": item["pageName"],
            "route": item.get("routePath", ""),
            "summary": item["description"],
            "interactions": normalize_interactions(item.get("interactions", item.get("interactiveElements", []))),
            "states": normalize_states(item.get("states", [])),
            "dir": "weapp/05-coach",
        })
    readme = "# 教练端模块（小程序）\n\n"
    for p in pages:
        readme += f"- [{p['title']}](./{p['file_name']})\n"
    write_file("weapp/05-coach/README.md", readme)
    for p in pages:
        related = build_related(pages, p["id"], p["dir"])
        content = render_prd(p["id"], p["title"], p["route"], "小程序 / 教练端", p["summary"], p["interactions"], p["states"], related)
        write_file(f"{p['dir']}/{p['file_name']}", content)
        all_files.append(f"{p['dir']}/{p['file_name']}")

# ============================================================
# Web 端处理
# ============================================================

def process_web_dashboard_coach():
    pages = []
    for item in data_web_dc["pages"]:
        pid = slugify(item["name"])
        pages.append({
            "id": pid,
            "file_name": f"{pid}.md",
            "title": item["name"],
            "route": item.get("route", ""),
            "summary": item["description"],
            "interactions": normalize_interactions(item.get("interactiveElements", [])),
            "states": normalize_states(item.get("states", [])),
            "dir": "web/05-dashboard" if item["route"].startswith("/dashboard") else "web/04-coach",
        })
    # split by dir
    for dir_name in ["web/05-dashboard", "web/04-coach"]:
        sub = [p for p in pages if p["dir"] == dir_name]
        if not sub:
            continue
        readme = f"# {'教练工作台' if 'dashboard' in dir_name else '教练端（Web）'}\n\n"
        for p in sub:
            readme += f"- [{p['title']}](./{p['file_name']})\n"
        write_file(f"{dir_name}/README.md", readme)
        for p in sub:
            related = build_related(sub, p["id"], p["dir"])
            module_label = "Web / 教练工作台" if "dashboard" in dir_name else "Web / 教练端"
            content = render_prd(p["id"], p["title"], p["route"], module_label, p["summary"], p["interactions"], p["states"], related)
            write_file(f"{p['dir']}/{p['file_name']}", content)
            all_files.append(f"{p['dir']}/{p['file_name']}")

def process_web_admin():
    pages = []
    for item in data_web_admin["pages"]:
        pid = slugify(item["pageName"])
        pages.append({
            "id": pid,
            "file_name": f"{pid}.md",
            "title": item["pageName"],
            "route": item.get("routePath", ""),
            "summary": item["description"],
            "interactions": normalize_interactions(item.get("interactableElements", [])),
            "states": normalize_states(item.get("states", [])),
            "dir": "web/06-admin",
        })
    readme = "# 管理后台（Web）\n\n"
    for p in pages:
        readme += f"- [{p['title']}](./{p['file_name']})\n"
    write_file("web/06-admin/README.md", readme)
    for p in pages:
        related = build_related(pages, p["id"], p["dir"])
        content = render_prd(p["id"], p["title"], p["route"], "Web / 管理后台", p["summary"], p["interactions"], p["states"], related)
        write_file(f"{p['dir']}/{p['file_name']}", content)
        all_files.append(f"{p['dir']}/{p['file_name']}")

def process_web_public():
    """基于 src/app/ 目录扫描生成 Web 公共页 + 学员端基础 PRD"""
    app_dir = PROJECT_ROOT / "src" / "app"
    # 收集所有 page.tsx 文件，排除已处理的 dashboard / admin / coach
    page_files = sorted(app_dir.rglob("page.tsx"))
    mapped_dirs = {
        "dashboard": "web/05-dashboard",
        "admin": "web/06-admin",
        "coach": "web/04-coach",
    }
    categorized = {}
    for pf in page_files:
        rel_parts = pf.relative_to(app_dir).parts[:-1]  # exclude page.tsx
        if not rel_parts:
            route = "/"
            page_name = "首页"
        else:
            route = "/" + "/".join(rel_parts)
            # heuristic name from last part
            page_name = rel_parts[-1].replace("-", " ").replace("_", " ").title()
            if page_name.startswith("["):
                page_name = rel_parts[-2].title() + " 详情" if len(rel_parts) > 1 else "详情页"
        # determine category dir
        first = rel_parts[0] if rel_parts else ""
        cat_dir = mapped_dirs.get(first, "web/03-me" if first == "me" else "web/01-public")
        if first in ("dashboard", "admin"):
            continue  # skip already processed
        pid = slugify(page_name) + "-" + slugify(route)
        categorized.setdefault(cat_dir, []).append({
            "id": pid,
            "file_name": f"{pid}.md",
            "title": page_name,
            "route": route,
            "summary": f"Web 端页面，路由 {route}。",
            "interactions": [],
            "states": [],
            "dir": cat_dir,
        })
    # 写入各分类
    for cat_dir, pages in categorized.items():
        # deduplicate by id
        seen = set()
        unique_pages = []
        for p in pages:
            if p["id"] not in seen:
                seen.add(p["id"])
                unique_pages.append(p)
        pages = unique_pages
        label = {
            "web/01-public": "公共页与其他（Web）",
            "web/03-me": "学员端（Web）",
            "web/04-coach": "教练端公共页（Web）",
        }.get(cat_dir, "Web")
        readme = f"# {label}\n\n"
        for p in pages:
            readme += f"- [{p['title']}](./{p['file_name']})\n"
        write_file(f"{cat_dir}/README.md", readme)
        for p in pages:
            related = build_related(pages, p["id"], p["dir"])
            content = render_prd(p["id"], p["title"], p["route"], label, p["summary"], p["interactions"], p["states"], related)
            write_file(f"{p['dir']}/{p['file_name']}", content)
            all_files.append(f"{p['dir']}/{p['file_name']}")

# ============================================================
# 生成总索引
# ============================================================

def generate_index():
    content = """# CoachLink 前端 PRD 总索引

本文档树涵盖小程序端与 Web 端所有页面的功能点、交互元素与状态说明，采用相对路径链接组织。

## 一、小程序端（WeApp）

- [01 认证模块](./weapp/01-auth/README.md)
- [02 发现与首页模块](./weapp/02-discovery/README.md)
- [03 训练模块](./weapp/03-training/README.md)
- [04 个人中心模块](./weapp/04-me/README.md)
- [05 教练端模块](./weapp/05-coach/README.md)

## 二、Web 端（Next.js）

- [01 公共页与其他](./web/01-public/README.md)
- [03 学员端](./web/03-me/README.md)
- [04 教练端](./web/04-coach/README.md)
- [05 教练工作台](./web/05-dashboard/README.md)
- [06 管理后台](./web/06-admin/README.md)

---

> 本 PRD 由代码扫描与页面分析自动生成，后续重构请以本文档为锚点，逐页对照交互与状态进行设计还原。
"""
    write_file("README.md", content)

# ============================================================
# 主流程
# ============================================================

if __name__ == "__main__":
    process_weapp_auth()
    process_weapp_discovery()
    process_weapp_training()
    process_weapp_me()
    process_weapp_coach()
    process_web_dashboard_coach()
    process_web_admin()
    process_web_public()
    generate_index()
    print(f"PRD 生成完成，共 {len(all_files)} 个页面文档。")
