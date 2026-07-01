# Hypersheet

**HTML-first, spreadsheet-like data grid component library.**

Hypersheet is a lightweight, hypermedia-driven data grid built on [Alpine.js](https://alpinejs.dev/) and [htmx](https://htmx.org/). It delivers Excel-like inline editing, keyboard navigation, cell-level UI components (chips, dropdowns, checklists), column sorting, and row reordering — without heavy JavaScript bundles.

## Philosophy

- **HTML-first**: The server renders semantic HTML. No client-side rendering frameworks.
- **Hypermedia-driven**: Cell saves, row reorders, and column sorts use htmx attributes for AJAX.
- **Frontend polish**: Alpine.js handles keyboard navigation, cell focus, and UI micro-interactions.
- **Backend agnostic**: Official backend packages for **PHP**, **Python**, **Go**, and **Rust**.
- **Authorization native**: Built-in [Casbin](https://casbin.org/) column-level security at render time.

## Quick Start

```html
<!-- Include dependencies -->
<script src="https://unpkg.com/alpinejs@3/dist/cdn.min.js" defer></script>
<script src="https://unpkg.com/hypersheet@0.1/dist/hypersheet.js" defer></script>
<link rel="stylesheet" href="https://unpkg.com/hypersheet@0.1/dist/hypersheet.css">

<!-- Use the grid -->
<div x-data="hypersheet({ rows: 10, cols: 4, sortable: true })"
     @keydown.window="handleKey($event)">
  <table class="hg-grid">
    <thead>
      <tr class="hg-header">
        <th class="hg-cell hg-w-10"></th>
        <th class="hg-cell hg-sort-btn" @click="toggleSort(0)">Name <span class="hg-sort-icon">↕</span></th>
        <th class="hg-cell">Status</th>
        <th class="hg-cell">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr class="hg-row">
        <td class="hg-cell hg-drag-handle">⋮⋮</td>
        <td class="hg-cell" data-row="0" data-col="0">John Doe</td>
        <td class="hg-cell" data-row="0" data-col="1"><span class="hg-chip hg-chip-active">Active</span></td>
        <td class="hg-cell" data-row="0" data-col="2">
          <div class="hg-dropdown-trigger">Actions <span class="hg-dropdown-arrow">▼</span></div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

## Features

| Feature | Details |
|---------|---------|
| Keyboard navigation | Arrow keys, Tab, Enter, Escape, Home, End |
| Inline editing | Click or Enter to edit, blur or Enter to save |
| Cell types | Text, Chips, Dropdowns, Checklists |
| Column sorting | Click header to sort asc/desc |
| Row reordering | Drag handle + SortableJS |
| Column locking | Casbin RBAC at server render |
| htmx integration | hx-put, hx-post, hx-trigger on cells |
| Lightweight | ~3KB JS (gzip), ~5KB CSS (gzip) |

## Backend Packages

| Language | Package | Status |
|----------|---------|--------|
| PHP | `composer require hypersheet/hypersheet` | ✅ Alpha |
| Go | `go get github.com/hyperlibs/hypersheet` | ✅ Alpha |
| Python | `pip install hypersheet` | ✅ Alpha |
| Rust | `cargo add hypersheet` | ✅ Alpha |

## Documentation

- [Hypersheet CSS Reference](./docs/css.md)
- [Hypersheet JS API](./docs/js.md)
- [PHP Backend](./backends/php/README.md)
- [Go Backend](./backends/go/README.md)
- [Python Backend](./backends/python/README.md)
- [Rust Backend](./backends/rust/README.md)

## License

MIT
