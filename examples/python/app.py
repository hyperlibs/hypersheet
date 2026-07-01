"""
Hypersheet Python (FastAPI + Jinja3) Example
Run: uvicorn app:app --reload --port 8000
"""

import os
from pathlib import Path

import casbin
import uvicorn
from fastapi import FastAPI, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from jinja2 import Environment, FileSystemLoader

from hypersheet.engine import HypersheetJinjaEngine

app = FastAPI(title="Hypersheet Python Example")

# --- Casbin Setup ---
MODEL_CONF = """
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && keyMatch(r.obj, p.obj) && regexMatch(r.act, p.act)
"""

POLICY_CSV = """p, alice, column:name, read
p, alice, column:name, write
p, alice, column:status, read
p, alice, column:status, write
p, alice, column:tier, read
p, bob, column:name, read
p, bob, column:status, read
p, bob, column:tier, read
p, bob, column:tier, write"""

# Write config files (in-memory would be better in production)
Path("casbin_model.conf").write_text(MODEL_CONF)
Path("casbin_policy.csv").write_text(POLICY_CSV)

enforcer = casbin.Enforcer("casbin_model.conf", "casbin_policy.csv")
grid_engine = HypersheetJinjaEngine(enforcer)

# --- Jinja3 Setup ---
template_dir = Path(__file__).parent / "templates"
template_dir.mkdir(exist_ok=True)

# Write the Jinja3 template
(template_dir / "grid.html").write_text("""\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hypersheet Python Example</title>
    <script src="https://unpkg.com/alpinejs@3/dist/cdn.min.js" defer></script>
    <script src="https://unpkg.com/hypersheet@0.1/dist/hypersheet.js" defer></script>
    <link rel="stylesheet" href="https://unpkg.com/hypersheet@0.1/dist/hypersheet.css">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .user-switch { margin-bottom: 1.5rem; display: flex; gap: 0.5rem; align-items: center; }
        .user-switch a { padding: 0.25rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; text-decoration: none; color: #374151; }
        .user-switch a.active { background: #3b82f6; color: white; border-color: #3b82f6; }
    </style>
</head>
<body>
    <h1>Hypersheet — Python Example</h1>
    <div class="user-switch">
        <span>User:</span>
        <a href="/?user=alice" class="{{ 'active' if user_id == 'alice' else '' }}">Alice</a>
        <a href="/?user=bob" class="{{ 'active' if user_id == 'bob' else '' }}">Bob</a>
        <span style="color: #6b7280; font-size: 0.875rem; margin-left: 1rem;">
            (Bob has restricted column write access)
        </span>
    </div>
    {{ grid_html }}
    <p style="margin-top: 1rem; font-size: 0.75rem; color: #9ca3af;">
        Use arrow keys to navigate, Enter to edit, Escape to cancel, Tab to move between cells.
        Drag ⋮⋮ to reorder rows. Click column headers to sort.
    </p>
</body>
</html>
""")

env = Environment(loader=FileSystemLoader(str(template_dir)), autoescape=True)
env.globals["hypersheet_cell"] = grid_engine.render_cell

# --- Sample Data ---
COLUMNS = [
    {"name": "name", "label": "User Profile", "type": "text"},
    {"name": "status", "label": "Lifecycle State", "type": "chip"},
    {
        "name": "tier",
        "label": "Assigned Subscription",
        "type": "dropdown",
        "options": ["Free", "Premium", "Enterprise"],
    },
]

ROWS = [
    {"id": "1", "name": "Alice Johnson", "status": "Active", "tier": "Enterprise"},
    {"id": "2", "name": "Bob Smith", "status": "Paused", "tier": "Free"},
    {"id": "3", "name": "Carol Davis", "status": "Archived", "tier": "Premium"},
    {"id": "4", "name": "Dave Wilson", "status": "Active", "tier": "Premium"},
]


@app.get("/", response_class=HTMLResponse)
async def index(request: Request, user: str = Query("alice")):
    # Build grid HTML using render_grid wrapper
    grid_html = grid_engine.render_grid(
        {"user_id": user, "request": request},
        COLUMNS,
        ROWS,
    )

    tmpl = env.get_template("grid.html")
    return tmpl.render(grid_html=grid_html, user_id=user)


@app.put("/api/grid/cell")
async def update_cell(request: Request):
    data = await request.json()
    # In production, update database here
    return JSONResponse({"status": "ok", "updated": data})


@app.post("/api/grid/reorder")
async def reorder_rows(request: Request):
    data = await request.json()
    # In production, reorder database here
    return JSONResponse({"status": "ok", "reorder": data})


@app.post("/api/grid/task")
async def update_task(request: Request):
    data = await request.json()
    # In production, update task in database here
    return JSONResponse({"status": "ok", "task_updated": data})


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
