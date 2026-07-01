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
  <table class="hs-grid">
    <thead>
      <tr class="hs-header">
        <th class="hs-cell hs-w-10"></th>
        <th class="hs-cell hs-sort-btn" @click="toggleSort(0)">Name <span class="hs-sort-icon">↕</span></th>
        <th class="hs-cell">Status</th>
        <th class="hs-cell">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr class="hs-row">
        <td class="hs-cell hs-drag-handle">⋮⋮</td>
        <td class="hs-cell" data-row="0" data-col="0">John Doe</td>
        <td class="hs-cell" data-row="0" data-col="1"><span class="hs-chip hs-chip-active">Active</span></td>
        <td class="hs-cell" data-row="0" data-col="2">
          <div class="hs-dropdown-trigger">Actions <span class="hs-dropdown-arrow">▼</span></div>
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

### Beginner
- [Getting Started](./docs/getting-started.md) — setup, init, config-driven, provider-driven, readonly, editable
- [CSS Reference](./docs/css.md) — all utility classes

### Advanced
- [Advanced Guide](./docs/advanced.md) — role-based editing, decorations, Yjs conflict resolution, provider architecture
- [JS API Reference](./docs/js.md) — Alpine plugin methods

### Platform Guides
- [Platform Integration](./docs/platforms.md) — WordPress, Laravel, Django, FastAPI, Flask, Next.js, Hugo + 20+ more

### Backend Packages
- [PHP Backend](./backends/php/README.md)
- [Go Backend](./backends/go/README.md)
- [Python Backend](./backends/python/README.md)
- [Rust Backend](./backends/rust/README.md)

## License

MIT
