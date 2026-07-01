# Hypersheet JS API Reference

The Hypersheet Alpine.js plugin provides spreadsheet-like keyboard navigation and cell interaction.

## Initialization

```html
<div x-data="Hypersheet({ rows: 10, cols: 4, sortable: true })"
     @keydown.window="handleKey($event)">
```

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rows` | number | 0 | Total row count |
| `cols` | number | 0 | Total column count |
| `sortable` | bool | false | Enable SortableJS drag-reorder |

## Methods

### `focusCell(row, col, locked)`
Focus a specific cell. Set `locked=true` to prevent focus (used for Casbin-locked cells).

### `isFocused(row, col)` → bool
Returns `true` if the given cell is currently focused. Use with `:class`.

### `enterEdit()`
Enters edit mode and focuses the cell input.

### `exitEdit()`
Exits edit mode.

### `handleKey(event)`
Global keyboard handler. Bind to `@keydown.window`.

### `toggleSort(colIndex)`
Toggles column sort ascending/descending. Dispatches `grid-sort` event.

### `isSortedAsc(colIndex)` / `isSortedDesc(colIndex)` → bool
Check sort direction for a column.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow keys | Navigate cells |
| Enter | Enter edit mode |
| Escape | Exit edit mode |
| Tab | Next cell (enters edit) |
| Shift+Tab | Previous cell (enters edit) |
| Home | First column |
| End | Last column |
| Space | Toggle checkbox |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `grid-sort` | `{ col, asc }` | Column sort toggled |
| `row-reordered` | `{ from, to }` | Row drag-reorder completed |

## Requirements

- Alpine.js 3.x
- SortableJS (optional, for drag-reorder)
