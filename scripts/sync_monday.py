#!/usr/bin/env python3
"""
Monday.com → docs/MONDAY_TRACKER.json sync script
===================================================
Read-only. Pulls all items from the Livera V1.1 Build Tracker board
(18410465442) and writes a structured JSON file for Replit Agent to
reference during wave planning without hitting the API every session.

Usage
-----
  python3 scripts/sync_monday.py            # sync all boards
  python3 scripts/sync_monday.py --board 18410465442  # specific board

Requirements
------------
  MONDAY_API_KEY env var — personal API token from Monday.com

Output
------
  docs/MONDAY_TRACKER.json   — full tracker dump
  docs/MONDAY_TRACKER.md     — human-readable summary by group/status
"""

import os, sys, json, pathlib, urllib.request, urllib.error, argparse
from datetime import datetime, timezone

MONDAY_API_KEY = os.environ.get("MONDAY_API_KEY", "")
MONDAY_API_URL = "https://api.monday.com/v2"

# Board IDs from PRODUCT_VISION.md
BOARDS = {
    "build_tracker":        18410465442,
    "ft_complaints":        18402056040,
    "ft_incidents":         18402056019,
    "vsc_complaints":       18409111860,
}

# Column ID → friendly key mapping (from board 18410465442)
COLUMN_MAP = {
    "text_mm2t8w3a":       "bld_id",
    "text_mm2tw4hw":       "spec_ref",
    "long_text_mm2tfg5r":  "where",
    "long_text_mm2th27d":  "done_when",
    "long_text_mm2tdy61":  "notes",
    "color_mm2t9m54":      "tag",
    "color_mm2twj76":      "complexity",
    "color_mm2t8nqk":      "status",
    "color_mm30zrxd":      "status_extended",
}

OUT_DIR = pathlib.Path("/home/runner/workspace/docs")


def gql(query: str) -> dict:
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        MONDAY_API_URL, data=payload, method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": MONDAY_API_KEY,
            "API-Version": "2024-01",
            "User-Agent": "livera-sync/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"[ERROR] Monday API HTTP {e.code}: {e.read().decode()[:300]}", file=sys.stderr)
        sys.exit(1)


def fetch_board_items(board_id: int) -> list[dict]:
    """Paginate through all items on a board."""
    items = []
    cursor = None
    page = 1
    while True:
        cursor_arg = f', cursor: "{cursor}"' if cursor else ""
        query = f"""
        {{
          boards(ids: [{board_id}]) {{
            name
            items_page(limit: 50{cursor_arg}) {{
              cursor
              items {{
                id
                name
                group {{ title }}
                column_values {{ id text }}
              }}
            }}
          }}
        }}
        """
        data = gql(query)
        board = data["data"]["boards"][0]
        page_data = board["items_page"]
        raw_items = page_data["items"]
        board_name = board["name"]

        for item in raw_items:
            row = {
                "id": item["id"],
                "name": item["name"],
                "group": item["group"]["title"],
                "board_name": board_name,
                "board_id": board_id,
            }
            for cv in item["column_values"]:
                key = COLUMN_MAP.get(cv["id"], cv["id"])
                row[key] = cv["text"] or ""
            items.append(row)

        cursor = page_data.get("cursor")
        print(f"  Page {page}: fetched {len(raw_items)} items (total so far: {len(items)})")
        page += 1
        if not cursor or not raw_items:
            break

    return items


def build_markdown_summary(items: list[dict]) -> str:
    """Generate a human-readable summary grouped by wave/group and status."""
    by_group: dict[str, list[dict]] = {}
    for item in items:
        g = item.get("group", "Ungrouped")
        by_group.setdefault(g, []).append(item)

    lines = [
        "# Livera V1.1 Build Tracker — Monday.com Snapshot",
        f"\n_Synced: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}_",
        f"\n**Total items:** {len(items)}\n",
    ]

    status_order = ["Done", "In progress", "Review", "Proto done", "Blocked", ""]

    for group, group_items in sorted(by_group.items()):
        lines.append(f"\n## {group}\n")
        lines.append(f"| BLD ID | Name | Complexity | Status | Status (ext) |")
        lines.append(f"|--------|------|------------|--------|--------------|")
        for item in sorted(group_items, key=lambda x: x.get("bld_id", "")):
            bld = item.get("bld_id", "—")
            name = item["name"][:60].replace("|", "·")
            comp = item.get("complexity", "—")
            status = item.get("status", "—") or "—"
            status_ext = item.get("status_extended", "—") or "—"
            lines.append(f"| {bld} | {name} | {comp} | {status} | {status_ext} |")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Sync Monday.com boards to docs/MONDAY_TRACKER.json")
    parser.add_argument("--board", type=int, default=None,
                        help="Specific board ID to sync (default: build_tracker only)")
    args = parser.parse_args()

    if not MONDAY_API_KEY:
        print("[ERROR] MONDAY_API_KEY env var is not set.", file=sys.stderr)
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    boards_to_sync = (
        {"custom": args.board} if args.board
        else {"build_tracker": BOARDS["build_tracker"]}
    )

    all_items = []
    for board_key, board_id in boards_to_sync.items():
        print(f"\nFetching board: {board_key} ({board_id}) ...")
        items = fetch_board_items(board_id)
        all_items.extend(items)
        print(f"  → {len(items)} items fetched")

    # Write JSON
    output = {
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "total_items": len(all_items),
        "boards": list(boards_to_sync.keys()),
        "items": all_items,
    }
    json_path = OUT_DIR / "MONDAY_TRACKER.json"
    json_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(all_items)} items → {json_path}")

    # Write Markdown summary
    md_path = OUT_DIR / "MONDAY_TRACKER.md"
    md_path.write_text(build_markdown_summary(all_items))
    print(f"Wrote markdown summary → {md_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
