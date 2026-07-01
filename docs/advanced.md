# Advanced Hypersheet

## Role-Based Editable Grid

Hypersheet integrates with [Casbin](https://casbin.org/) for column-level authorization. The backend renders cells as read-only or editable based on the current user's permissions.

### Backend (PHP example)

```php
use Hypersheet\Grid;

$enforcer = new Enforcer('model.conf', 'policy.csv');
$grid = new Grid($columns, $rows);
$grid->withAuthorization($enforcer, $userId);

// Optional: audit logging
$logger = new CasbinLogger(['enabled' => true]);
$grid->withLogger($logger);

echo $grid->render();
```

### Policy File

```csv
p, alice, name, read
p, alice, name, write
p, alice, email, read
p, alice, email, write
p, bob, name, read
p, bob, email, read
```

- **Alice** can read and write `name` and `email`.
- **Bob** can only read `name` and `email` (view-only).

The backend renders `<input>` fields for writable columns and plain text for read-only columns. No frontend changes needed.

### Frontend: Read-Only Indicator

Cells rendered as read-only by the backend will lack `data-row` and `data-col` attributes, so the grid skips them during keyboard navigation.

### User Switching

Pass the user ID dynamically:

```php
$userId = $_GET['user'] ?? 'anonymous';
$grid->withAuthorization($enforcer, $userId);
```

The same grid template renders different editability per user.

---

## Cell Decorations / Styles

Hypersheet provides utility CSS classes for cell appearance. All classes use the `hg-` prefix.

### Chip Variants

| Class | Usage |
|-------|-------|
| `hg-chip` | Base chip style |
| `hg-chip-active` | Green — active/success |
| `hg-chip-paused` | Yellow — warning/pending |
| `hg-chip-archived` | Gray — inactive/archived |

### Text Alignment

| Class | Usage |
|-------|-------|
| `hg-text-left` | Left-align cell content |
| `hg-text-center` | Center-align |
| `hg-text-right` | Right-align (numbers) |

### Cell Sizing

| Class | Width |
|-------|-------|
| `hg-w-10` | 2.5rem (drag handle) |
| `hg-w-20` | 5rem |
| `hg-w-32` | 8rem |
| `hg-w-48` | 12rem |
| `hg-w-64` | 16rem |

### Conditional Cell Formatting

Users can toggle formatting via keyboard:

| Shortcut | Effect |
|----------|--------|
| Ctrl+B | Toggle bold |
| Ctrl+U | Toggle underline |
| Alt+Enter | Cycle highlight color |
| Alt+Backspace | Remove highlight |
| Ctrl+Alt+Backspace | Reset all formatting |

Formatting state is stored in the `cellFormats` reactive property and emitted via `grid-cell-format` events.

### Custom Cell Styles via CSS

```css
/* Highlight overdue rows */
tr.hg-row[data-status="overdue"] .hg-cell {
  background-color: #fef2f2;
}

/* Custom chip color */
.hg-chip-custom {
  background-color: #ede9fe;
  color: #5b21b6;
}
```

---

## Conflict Resolution with Yjs

Hypersheet includes an optional [Yjs](https://yjs.dev/) provider for real-time collaborative editing with automatic conflict resolution using CRDTs.

### Enable Yjs

Add the `data-hypersheet-yjs` attribute to your grid container:

```html
<div x-data="hypersheet({ rows: 10, cols: 4 })"
     data-hypersheet-yjs='{"roomName":"grid-123","providerUrl":"ws://localhost:1234"}'>
```

### Manual Setup

```js
import { HypersheetYjs } from './yjs-provider.js';

const gridEl = document.getElementById('my-grid');
const yjs = new HypersheetYjs(gridEl, {
  roomName: 'grid-123',
  providerUrl: 'ws://localhost:1234',
  authority: 'user-alice',
  debug: true
});

// Later — cleanup
yjs.destroy();
```

### Yjs Events

| Event | Description |
|-------|-------------|
| `yjs-ready` | Yjs document initialized and synced |
| `yjs-status` | Provider connection status (`connected` / `disconnected`) |
| `yjs-synced` | Initial sync complete |

### Architecture

```
User A ──┐
         ├── y-websocket ── Yjs CRDT ── y-websocket ──┐ User B
User C ──┘                                             └── Hypersheet Grid
```

All peers have equal write access. Conflicts are resolved automatically by Yjs' internal merge logic (last-writer-wins for same-key concurrent edits).

---

## Provider System Architecture

```
Grid Column
    │
    ├── provider: { type: 'static', items: [...] }
    │       └── StaticProvider
    │
    ├── provider: { type: 'memory', items: [...] }
    │       └── MemoryProvider (mutable)
    │
    ├── provider: { type: 'config', source: '/data/statuses.json' }
    │       └── ConfigProvider (HTTP + polling)
    │
    ├── provider: { type: 'api', url: '/api/departments' }
    │       └── ApiProvider (REST / GraphQL)
    │
    └── provider: { type: 'database', table: 'roles', ... }
            └── DatabaseProvider (backend proxy)
```

All providers implement the same interface:

```js
interface Provider {
  async fetch(params)    // → { success, items: [{value, label}] }
  async get(value)       // → {value, label} | null
  async labels(values)   // → [label, ...]
  async validate(value)  // → boolean
  watch(fn)              // → unsubscribe function
  destroy()
}
```

---

## Layered Configuration

Provider registry supports layered configs with precedence (last wins):

```
defaults/       ← shipped with app
app.config      ← deployment config
customer.config ← tenant-specific overrides
database        ← runtime overrides
user prefs      ← per-user settings
```

```js
import { HypersheetProviders } from './providers.js';

const reg = HypersheetProviders.registry;

reg.addLayer({ statuses: ['Active', 'Paused', 'Archived'] });
reg.addLayer({ statuses: ['Active', 'Inactive'] });  // overrides

const config = reg.resolveConfig('statuses');  // → ['Active', 'Inactive']
```

---

## Multiple Grids on One Page

Each grid gets its own `hypersheet()` component. They operate independently.

```html
<div x-data="hypersheet({ rows: 5, cols: 3 })" @keydown.window="handleKey($event)">
  <!-- Grid A -->
</div>

<div x-data="hypersheet({ rows: 10, cols: 4 })" @keydown.window="handleKey($event)">
  <!-- Grid B -->
</div>
```

Shared providers via `globalProviders` keep configs in sync.

---

## Provider Events & Reactivity

When a provider's data changes (e.g., config file updates, API response, memory mutation):

| Method | Effect |
|--------|--------|
| `reloadProvider(col)` | Clears cache and refetches for one column |
| `reloadAllProviders()` | Refetches all columns |
| `provider.watch(fn)` | Subscribe to change notifications |

The `watch()` callback receives `(event, data)` where event is `'change'` and data is the new items array.

---

## Grid Events Summary

| Event | Detail | Trigger |
|-------|--------|---------|
| `grid-save` | `{ row, col, value }` | Ctrl+Enter |
| `grid-insert-row` | `{ afterRow }` | Shift+Enter |
| `grid-clear-cell` | `{ row, col }` | Backspace / Delete |
| `grid-clear-row` | `{ row }` | Ctrl+Backspace |
| `grid-cell-format` | `{ row, col, formats }` | Bold, underline, highlight |
| `grid-sort` | `{ col, asc }` | Column header click |
| `row-reordered` | `{ from, to }` | SortableJS drag |
| `cell-focus` | `{ row, col }` | Cell focus |
| `yjs-ready` | `{ docName, doc }` | Yjs init |
| `yjs-status` | `{ status }` | Yjs connection |
| `yjs-synced` | `{ synced }` | Yjs sync complete |
