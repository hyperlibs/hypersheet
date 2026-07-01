# Hypersheet Go Backend

Library for server-side rendering of Hypersheet tables. Casbin authorization is optional.

## Install

```bash
go get github.com/hyperlibs/hypersheet/go
```

## Quick Start

```go
import Hypersheet "github.com/hyperlibs/hypersheet/go"

grid := Hypersheet.NewGrid(
    []Hypersheet.Column{
        {Name: "name", Label: "Name", Type: "text"},
        {Name: "status", Label: "Status", Type: "chip"},
    },
    []Hypersheet.Row{
        {"id": "1", "name": "Alice", "status": "Active"},
    },
)

gridHTML := grid.Render() // template.HTML
```

## With Casbin Authorization

```go
grid.WithAuth(enforcer, "alice")
grid.WithLogger(logger)
```

## With Database

```go
import "github.com/hyperlibs/hypersheet/go/database"

db, _ := database.New("pgsql")
db.Connect(map[string]string{"host": "localhost", "database": "Hypersheet"})
rows, _ := db.FetchRows("users", []string{"name", "status"}, "", true)
```

## Cell Types

`text`, `chip`, `dropdown`, `checklist`

## API

- `Grid.Render()` — full wrapped table
- `Grid.RenderBodyFragment()` — `<tbody>` only
- `Grid.RenderHeaderFragment()` — `<thead>` only
