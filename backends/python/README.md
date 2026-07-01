# Hypersheet Python Backend

Library for server-side rendering of Hypersheet tables from Jinja3. Casbin authorization is optional.

## Install

```bash
pip install Hypersheet
```

## Quick Start

```python
from Hypersheet import HypersheetJinjaEngine

engine = HypersheetJinjaEngine()

# Register in Jinja3
env.globals["Hypersheet_cell"] = engine.render_cell
env.globals["Hypersheet_render_grid"] = engine.render_grid
```

## With Casbin

```python
import casbin
from Hypersheet import HypersheetJinjaEngine, CasbinLogger

enforcer = casbin.Enforcer("model.conf", "policy.csv")
logger = CasbinLogger(enabled=True)
engine = HypersheetJinjaEngine(casbin_enforcer=enforcer, logger=logger)
```

## Cell Types

`text`, `chip`, `dropdown`, `checklist`

## API (Jinja3 globals)

- `{{ Hypersheet_cell(row_id, col_name, value, r_idx, c_idx, cell_type="text", options=[]) }}`
- `{{ Hypersheet_render_grid(columns, rows) }}` — full table
- `{{ Hypersheet_render_header(columns) }}` — `<thead>` fragment
- `{{ Hypersheet_render_body(columns, rows) }}` — `<tbody>` fragment
