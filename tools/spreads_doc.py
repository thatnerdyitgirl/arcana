"""Генерирует docs/SPREADS.md из knowledge/spreads/triplets.json."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "knowledge/spreads/triplets.json").read_text())
out = ["# Расклады Arcana — 6 тем × 6 триплетов", "",
       "Генерируется из `knowledge/spreads/triplets.json`: `python3 tools/spreads_doc.py`.", ""]
theme = None
for i, s in enumerate(data["spreads"], 1):
    if s["theme"] != theme:
        theme = s["theme"]; out += [f"## {theme}", ""]
    out += [f"### {i}. {s['name']}", f"{s['when']}", ""]
    out += [f"{n}. {p['name']}" for n, p in enumerate(s["positions"], 1)]
    out += ["", f"**Почему интересен:** {s['why']}  ", f"**Теги:** `{', '.join(s['tags'])}`"]
    if s.get("replaces"): out.append(f"  \n**Заменяет:** {', '.join(s['replaces'])}")
    out.append("")
(root / "docs/SPREADS.md").write_text("\n".join(out))
print("ok", len(data["spreads"]))
