# HyperGrid Rust Backend

Library for server-side rendering of HyperGrid tables. Casbin authorization is optional.

## Install

```toml
[dependencies]
hypergrid = "0.1"
```

## Quick Start

```rust
use hypergrid::{Grid, Column, CellType, Row};

let grid = Grid::new(
    None, // enforcer (None = all cells editable)
    "alice",
    vec![
        Column { name: "name".into(), label: "Name".into(), cell_type: CellType::Text },
        Column { name: "status".into(), label: "Status".into(), cell_type: CellType::Chip },
    ],
    vec![
        row("1", "Alice", "Active"),
    ],
);

let html = grid.render();
```

## With Casbin

```rust
let enforcer = Enforcer::new("model.conf", "policy.csv").await?;
let grid = Grid::new(Some(enforcer), "alice", columns, rows)
    .with_logger(my_logger);
```

## Cell Types

- `CellType::Text`
- `CellType::Chip`
- `CellType::Dropdown(Vec<String>)`
- `CellType::Checklist(Vec<ChecklistItem>)`

## API

- `Grid::render()` — full wrapped table
- `Grid::render_body_fragment()` — `<tbody>` only
- `Grid::render_header_fragment()` — `<thead>` only
