# Hypersheet CSS Reference

Hypersheet uses a Tailwind-like utility framework with the `hs-` prefix.

## Grid Layout

| Class | Purpose |
|-------|---------|
| `hs-grid` | Table element |
| `hs-header` | Header row styling |
| `hs-row` | Table row |
| `hs-cell` | Table cell |
| `hs-cell-input` | Cell input element |
| `hs-drag-handle` | Row drag handle |

## Cell Types

| Class | Purpose |
|-------|---------|
| `hs-cell-text` | Text input cell |
| `hs-cell-chip` | Chip/status cell |
| `hs-cell-dropdown` | Dropdown cell |
| `hs-cell-checkbox` | Checkbox cell |

## States

| Class | Purpose |
|-------|---------|
| `hs-focused` | Focused cell (blue ring) |
| `hs-selected` | Selected cell |
| `hs-editing` | Edit mode |
| `hs-locked` | Read-only (Casbin) |
| `hs-hidden` | Hidden (Casbin) |

## Chips

| Class | Purpose |
|-------|---------|
| `hs-chip` | Base chip |
| `hs-chip-active` | Green chip |
| `hs-chip-archived` | Red chip |
| `hs-chip-pending` | Yellow chip |
| `hs-chip-gray` | Default chip |
| `hs-chip-menu` | Chip dropdown menu |
| `hs-chip-option` | Chip menu option |

## Dropdown

| Class | Purpose |
|-------|---------|
| `hs-dropdown-trigger` | Dropdown display |
| `hs-dropdown-arrow` | Arrow indicator |
| `hs-dropdown-menu` | Dropdown popup |
| `hs-dropdown-item` | Dropdown option |

## Checklist

| Class | Purpose |
|-------|---------|
| `hs-checklist` | Checklist container |

## Utility Classes

Spacing: `hs-p-{1-4}`, `hs-gap-{1-3}`
Flex: `hs-flex`, `hs-flex-col`, `hs-items-center`, `hs-justify-between`
Text: `hs-text-{xs,sm,base,lg}`, `hs-font-{normal,medium,semibold,bold}`
Colors: `hs-bg-{color}`, `hs-text-{color}`
Borders: `hs-border`, `hs-border-b`, `hs-rounded{-md,-lg,-full}`
Position: `hs-relative`, `hs-absolute`, `hs-z-{10,20,30}`
Shadow: `hs-shadow{-md,-lg,-xl}`
Ring: `hs-ring-2`
Cursor: `hs-cursor-pointer`, `hs-cursor-grab`, `hs-cursor-not-allowed`
