# Getting Started with Hypersheet

## Installation

### CDN (Quickest)

```html
<script defer src="https://unpkg.com/alpinejs@3/dist/cdn.min.js"></script>
<script defer src="https://unpkg.com/hypersheet@0.1/dist/providers.js"></script>
<script defer src="https://unpkg.com/hypersheet@0.1/dist/hypersheet.js"></script>
<link rel="stylesheet" href="https://unpkg.com/hypersheet@0.1/dist/hypersheet.css">
```

**Script loading order matters:** `providers.js` → `hypersheet.js` → `alpinejs`. Both `providers.js` and `hypersheet.js` use `defer` and must appear before Alpine's `defer` script so their `alpine:init` listeners register before Alpine fires the event.

### npm / Bun

```bash
bun add hypersheet
# or: npm install hypersheet
```

```js
import 'hypersheet/dist/hypersheet.css';
import 'hypersheet/dist/hypersheet.js';
import 'hypersheet/dist/providers.js';
```

---

## Quick Start: Read-Only Table

The simplest Hypersheet — a plain HTML table with Alpine.js sorting and row reordering.

```html
<div x-data="hypersheet({ rows: 3, cols: 3, sortable: true })"
     @keydown.window="handleKey($event)">
  <table class="hs-grid">
    <thead>
      <tr class="hs-header">
        <th class="hs-cell hs-w-10"></th>
        <th class="hs-cell hs-sort-btn" @click="toggleSort(0)">Name <span class="hs-sort-icon">↕</span></th>
        <th class="hs-cell hs-sort-btn" @click="toggleSort(1)">Role <span class="hs-sort-icon">↕</span></th>
        <th class="hs-cell hs-sort-btn" @click="toggleSort(2)">Status <span class="hs-sort-icon">↕</span></th>
      </tr>
    </thead>
    <tbody>
      <tr class="hs-row">
        <td class="hs-cell hs-drag-handle">⋮⋮</td>
        <td class="hs-cell">Alice</td>
        <td class="hs-cell">Admin</td>
        <td class="hs-cell"><span class="hs-chip hs-chip-active">Active</span></td>
      </tr>
      <tr class="hs-row">
        <td class="hs-cell hs-drag-handle">⋮⋮</td>
        <td class="hs-cell">Bob</td>
        <td class="hs-cell">Editor</td>
        <td class="hs-cell"><span class="hs-chip hs-chip-paused">Paused</span></td>
      </tr>
      <tr class="hs-row">
        <td class="hs-cell hs-drag-handle">⋮⋮</td>
        <td class="hs-cell">Carol</td>
        <td class="hs-cell">Viewer</td>
        <td class="hs-cell"><span class="hs-chip hs-chip-archived">Archived</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

That's it. Keyboard navigation (arrows, Home, End) works immediately. Sorting works when you click column headers. Drag handles work if SortableJS is loaded.

---

## Config-Driven Grid

Define columns declaratively. Each column specifies its field, title, cell type, and optionally a data provider.

```html
<div x-data="hypersheet({
  rows: 5,
  cols: 4,
  columns: [
    { field: 'name',    title: 'Name',   type: 'text' },
    { field: 'email',   title: 'Email',  type: 'text' },
    { field: 'role',    title: 'Role',   type: 'dropdown',
      options: [
        { value: 'admin',  label: 'Administrator' },
        { value: 'editor', label: 'Editor' },
        { value: 'viewer', label: 'Viewer' }
      ]
    },
    { field: 'status',  title: 'Status', type: 'chip',
      options: [
        { value: 'active',   label: 'Active',   chipClass: 'hs-chip-active' },
        { value: 'paused',   label: 'Paused',   chipClass: 'hs-chip-paused' },
        { value: 'archived', label: 'Archived', chipClass: 'hs-chip-archived' }
      ]
    }
  ]
})" @keydown.window="handleKey($event)">
  ...
</div>
```

The `columns` array tells Hypersheet what each column contains. This metadata is used by the **Provider System** to dynamically resolve dropdown options, chip styles, and validation rules.

---

## Provider-Driven Grid

Each column can declare a `provider` instead of static `options`. The grid automatically fetches data from the provider and stays agnostic about where it comes from.

### Static Provider (inline data)

```js
{ field: 'role', type: 'dropdown',
  provider: { type: 'static',
    items: [
      { value: 'admin', label: 'Administrator' },
      { value: 'editor', label: 'Editor' }
    ]
  }
}
```

### Memory Provider (mutable at runtime)

```js
{ field: 'region', type: 'dropdown',
  provider: { type: 'memory',
    items: [
      { value: 'na',   label: 'North America' },
      { value: 'eu',   label: 'Europe' },
      { value: 'apac', label: 'Asia Pacific' }
    ]
  }
}
```

Memory providers can be updated at runtime via `reloadProvider(col)` or by calling methods on the provider instance.

### Config Provider (JSON file via HTTP)

```js
{ field: 'status', type: 'dropdown',
  provider: { type: 'config', source: '/data/statuses.json' }
}
```

The JSON file should return:
```json
{ "items": [
    { "value": "active",   "label": "Active" },
    { "value": "paused",   "label": "Paused" },
    { "value": "archived", "label": "Archived" }
  ]
}
```

Config providers support **polling** for hot-reload:
```js
provider: { type: 'config', source: '/data/statuses.json', pollInterval: 5000 }
```

### API Provider (REST endpoint)

```js
{ field: 'department', type: 'dropdown',
  provider: {
    type: 'api',
    url: '/api/departments?site={siteId}',
    method: 'GET',
    responsePath: 'data.items',
    auth: { token: '...' }
  }
}
```

URL interpolation (`{siteId}`) substitutes values from the `fetch()` params.

### Database Provider (backend proxy)

```js
{ field: 'doctor', type: 'dropdown',
  provider: {
    type: 'database',
    table: 'doctors',
    label: 'full_name',
    value: 'id',
    where: { active: true }
  }
}
```

Requires a backend endpoint at `/api/providers/database` that accepts `{ table, label, value, where }` and returns `{ items: [...] }`.

### Global Named Providers

Share providers across multiple grids:

```js
x-data="hypersheet({
  rows: 10, cols: 4,
  globalProviders: {
    statuses: { type: 'config', source: '/data/statuses.json' },
    roles:    { type: 'static',
                items: [
                  { value: 'admin', label: 'Administrator' },
                  { value: 'editor', label: 'Editor' }
                ]
              }
  },
  columns: [
    { field: 'role',   type: 'dropdown', provider: 'roles' },
    { field: 'status', type: 'chip',     provider: 'statuses' }
  ]
})"
```

---

## Full Editable Grid

Combine config-driven columns with Alpine.js `x-model` bindings for two-way data binding, and htmx `hx-*` attributes for AJAX persistence.

### Basic Editable Cells

```html
<td class="hs-cell" :data-row="rIdx" data-col="0"
    :class="focusedKey === rIdx + ':0' ? 'hs-focused' : ''">
  <input class="hs-cell-input" type="text"
         x-model="rows[rIdx].name"
         @focus="focusCell(rIdx, 0, false)"
         name="name">
</td>
```

### Editable Dropdown

```html
<td class="hs-cell hs-cell-dropdown" :data-row="rIdx" data-col="1"
    :class="focusedKey === rIdx + ':1' ? 'hs-focused' : ''"
    x-data="{ open: false }">
  <div @click="open = !open" class="hs-dropdown-trigger">
    <span x-text="rows[rIdx].role || 'Select...'"></span>
    <span class="hs-dropdown-arrow">▼</span>
  </div>
  <div class="hs-dropdown-menu" x-show="open" @click.away="open = false">
    <template x-for="opt in getColumnOptions(1)" :key="opt.value">
      <div class="hs-dropdown-item"
           @click="rows[rIdx].role = opt.value; open = false"
           x-text="opt.label"></div>
    </template>
  </div>
</td>
```

### Editable Chip

```html
<td class="hs-cell" :data-row="rIdx" data-col="2"
    :class="focusedKey === rIdx + ':2' ? 'hs-focused' : ''">
  <span class="hs-chip"
        :class="{
          'hs-chip-active':   rows[rIdx].status === 'active',
          'hs-chip-paused':   rows[rIdx].status === 'paused',
          'hs-chip-archived': rows[rIdx].status === 'archived'
        }">
  </span>
</td>
```

### htmx Persistence

Add `hx-*` attributes for server-side saves:

```html
<input class="hs-cell-input" type="text"
       x-model="rows[rIdx].name"
       hx-put="/api/grid/cell"
       hx-trigger="change"
       hx-vals='{"row": "__ROW__", "col": "name"}'
       name="name">
```

---

## Event Handling

Hypersheet dispatches custom events you can listen to on the parent:

| Event | Trigger |
|-------|---------|
| `grid-save` | Ctrl+Enter |
| `grid-insert-row` | Shift+Enter |
| `grid-clear-cell` | Backspace / Delete |
| `grid-clear-row` | Ctrl+Backspace |
| `grid-cell-format` | Format change |
| `grid-sort` | Column header click |
| `row-reordered` | Drag reorder (SortableJS) |

```html
<div class="container" x-data="demoApp()"
     @grid-save.window="onSave($event)">
  ...
</div>
```
