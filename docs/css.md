# HyperGrid CSS Reference

HyperGrid uses a Tailwind-like utility framework with the `hg-` prefix.

## Grid Layout

| Class | Purpose |
|-------|---------|
| `hg-grid` | Table element |
| `hg-header` | Header row styling |
| `hg-row` | Table row |
| `hg-cell` | Table cell |
| `hg-cell-input` | Cell input element |
| `hg-drag-handle` | Row drag handle |

## Cell Types

| Class | Purpose |
|-------|---------|
| `hg-cell-text` | Text input cell |
| `hg-cell-chip` | Chip/status cell |
| `hg-cell-dropdown` | Dropdown cell |
| `hg-cell-checkbox` | Checkbox cell |

## States

| Class | Purpose |
|-------|---------|
| `hg-focused` | Focused cell (blue ring) |
| `hg-selected` | Selected cell |
| `hg-editing` | Edit mode |
| `hg-locked` | Read-only (Casbin) |
| `hg-hidden` | Hidden (Casbin) |

## Chips

| Class | Purpose |
|-------|---------|
| `hg-chip` | Base chip |
| `hg-chip-active` | Green chip |
| `hg-chip-archived` | Red chip |
| `hg-chip-pending` | Yellow chip |
| `hg-chip-gray` | Default chip |
| `hg-chip-menu` | Chip dropdown menu |
| `hg-chip-option` | Chip menu option |

## Dropdown

| Class | Purpose |
|-------|---------|
| `hg-dropdown-trigger` | Dropdown display |
| `hg-dropdown-arrow` | Arrow indicator |
| `hg-dropdown-menu` | Dropdown popup |
| `hg-dropdown-item` | Dropdown option |

## Checklist

| Class | Purpose |
|-------|---------|
| `hg-checklist` | Checklist container |

## Utility Classes

Spacing: `hg-p-{1-4}`, `hg-gap-{1-3}`
Flex: `hg-flex`, `hg-flex-col`, `hg-items-center`, `hg-justify-between`
Text: `hg-text-{xs,sm,base,lg}`, `hg-font-{normal,medium,semibold,bold}`
Colors: `hg-bg-{color}`, `hg-text-{color}`
Borders: `hg-border`, `hg-border-b`, `hg-rounded{-md,-lg,-full}`
Position: `hg-relative`, `hg-absolute`, `hg-z-{10,20,30}`
Shadow: `hg-shadow{-md,-lg,-xl}`
Ring: `hg-ring-2`
Cursor: `hg-cursor-pointer`, `hg-cursor-grab`, `hg-cursor-not-allowed`
