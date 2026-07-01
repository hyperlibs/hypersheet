# HyperGrid Python Backend

Library for server-side rendering of HyperGrid tables from Jinja3. Casbin authorization is optional.

## Install

```bash
pip install hypergrid
```

## Quick Start

```python
from hypergrid import HyperGridJinjaEngine

engine = HyperGridJinjaEngine()

# Register in Jinja3
env.globals["hypergrid_cell"] = engine.render_cell
env.globals["hypergrid_render_grid"] = engine.render_grid
```

## With Casbin

```python
import casbin
from hypergrid import HyperGridJinjaEngine, CasbinLogger

enforcer = casbin.Enforcer("model.conf", "policy.csv")
logger = CasbinLogger(enabled=True)
engine = HyperGridJinjaEngine(casbin_enforcer=enforcer, logger=logger)
```

## Cell Types

`text`, `chip`, `dropdown`, `checklist`

## API (Jinja3 globals)

- `{{ hypergrid_cell(row_id, col_name, value, r_idx, c_idx, cell_type="text", options=[]) }}`
- `{{ hypergrid_render_grid(columns, rows) }}` — full table
- `{{ hypergrid_render_header(columns) }}` — `<thead>` fragment
- `{{ hypergrid_render_body(columns, rows) }}` — `<tbody>` fragment
