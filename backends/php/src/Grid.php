<?php

namespace Hypersheet;

class Grid
{
    private ?Enforcer $enforcer = null;
    private string $userId = 'anonymous';
    private array $rows;
    private array $columns;
    private int $rowCount;
    private int $colCount;
    private ?CasbinLogger $logger = null;

    public function __construct(array $columns = [], array $rows = [])
    {
        $this->columns = $columns;
        $this->rows = $rows;
        $this->rowCount = count($rows);
        $this->colCount = count($columns);
    }

    /** Enable Casbin authorization. If omitted, all cells are editable. */
    public function withAuth(Enforcer $enforcer, string $userId): self
    {
        $this->enforcer = $enforcer;
        $this->userId = $userId;
        return $this;
    }

    /** Enable optional Casbin audit logging. Requires withAuth(). */
    public function withLogger(CasbinLogger $logger): self
    {
        $this->logger = $logger;
        return $this;
    }

    public function setRows(array $rows): self
    {
        $this->rows = $rows;
        $this->rowCount = count($rows);
        return $this;
    }

    public function setColumns(array $columns): self
    {
        $this->columns = $columns;
        $this->colCount = count($columns);
        return $this;
    }

    private function canAccess(string $colName, string $action): bool
    {
        if (!$this->enforcer) return true;
        $granted = $this->enforcer->enforce($this->userId, "column:{$colName}", $action);
        if ($this->logger) {
            $this->logger->logCellAccess($this->userId, $colName, $action, $granted);
        }
        return $granted;
    }

    public function renderCell(string $rowId, string $colName, mixed $value, int $rIdx, int $cIdx, string $type = 'text', array $options = []): string
    {
        $canRead = $this->canAccess($colName, 'read');
        $canWrite = $this->canAccess($colName, 'write');

        if (!$canRead) {
            return '<td class="hs-cell hs-hidden">🔒 Hidden</td>';
        }

        if (!$canWrite) {
            $safe = htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
            return "<td class=\"hs-cell hs-locked\">🔒 {$safe}</td>";
        }

        return match ($type) {
            'chip' => $this->renderChipCell($rowId, $colName, $value, $rIdx, $cIdx),
            'dropdown' => $this->renderDropdownCell($rowId, $colName, $value, $rIdx, $cIdx, $options),
            'checklist' => $this->renderChecklistCell($rowId, $colName, $value, $rIdx, $cIdx, $options),
            'checkbox' => $this->renderCheckboxCell($rowId, $colName, $value, $rIdx, $cIdx),
            default => $this->renderTextCell($rowId, $colName, $value, $rIdx, $cIdx),
        };
    }

    private function renderTextCell(string $rowId, string $colName, mixed $value, int $r, int $c): string
    {
        $safe = htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
        $colSafe = htmlspecialchars($colName, ENT_QUOTES, 'UTF-8');
        $rowSafe = htmlspecialchars($rowId, ENT_QUOTES, 'UTF-8');
        return <<<HTML
<td class="hs-cell hs-cell-text" data-row="{$r}" data-col="{$c}"
    :class="isFocused({$r}, {$c}) ? 'hs-focused' : ''"
    @click="focusCell({$r}, {$c}, false)">
    <input type="text" value="{$safe}" class="hs-cell-input"
           hx-put="/api/grid/cell" hx-trigger="blur"
           name="{$colSafe}" hx-vals='{"row_id": "{$rowSafe}"}'>
</td>
HTML;
    }

    private function renderChipCell(string $rowId, string $colName, mixed $value, int $r, int $c): string
    {
        $safe = htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
        $colSafe = htmlspecialchars($colName, ENT_QUOTES, 'UTF-8');
        $rowSafe = htmlspecialchars($rowId, ENT_QUOTES, 'UTF-8');
        $chipClass = match (strtolower((string)$value)) {
            'active' => 'hs-chip-active',
            'paused', 'pending' => 'hs-chip-pending',
            'archived', 'inactive' => 'hs-chip-archived',
            default => 'hs-chip-gray',
        };
        return <<<HTML
<td class="hs-cell hs-cell-chip" data-row="{$r}" data-col="{$c}"
    :class="isFocused({$r}, {$c}) ? 'hs-focused' : ''"
    @click="focusCell({$r}, {$c}, false)"
    x-data="{ open: false }">
    <div @click="open = !open" class="hs-cursor-pointer hs-select-none">
        <span class="hs-chip {$chipClass}">{$safe}</span>
    </div>
    <div class="hs-chip-menu" x-show="open" @click.away="open = false" x-transition>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell" hx-vals='{"row_id": "{$rowSafe}", "{$colSafe}": "Active"}'
             @click="open = false">Active</div>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell" hx-vals='{"row_id": "{$rowSafe}", "{$colSafe}": "Paused"}'
             @click="open = false">Paused</div>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell" hx-vals='{"row_id": "{$rowSafe}", "{$colSafe}": "Archived"}'
             @click="open = false">Archived</div>
    </div>
</td>
HTML;
    }

    private function renderDropdownCell(string $rowId, string $colName, mixed $value, int $r, int $c, array $options): string
    {
        $safe = htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
        $colSafe = htmlspecialchars($colName, ENT_QUOTES, 'UTF-8');
        $rowSafe = htmlspecialchars($rowId, ENT_QUOTES, 'UTF-8');
        $items = '';
        foreach ($options as $opt) {
            $optSafe = htmlspecialchars((string)$opt, ENT_QUOTES, 'UTF-8');
            $items .= <<<ITEM
<div class="hs-dropdown-item"
     hx-put="/api/grid/cell" hx-vals='{"row_id": "{$rowSafe}", "{$colSafe}": "{$optSafe}"}'
     @click="open = false">{$optSafe}</div>
ITEM;
        }
        return <<<HTML
<td class="hs-cell hs-cell-dropdown" data-row="{$r}" data-col="{$c}"
    :class="isFocused({$r}, {$c}) ? 'hs-focused' : ''"
    @click="focusCell({$r}, {$c}, false)"
    x-data="{ open: false }">
    <div @click="open = !open" class="hs-dropdown-trigger">
        <span>{$safe}</span>
        <span class="hs-dropdown-arrow">▼</span>
    </div>
    <div class="hs-dropdown-menu" x-show="open" @click.away="open = false" x-transition>
        {$items}
    </div>
</td>
HTML;
    }

    private function renderCheckboxCell(string $rowId, string $colName, mixed $value, int $r, int $c): string
    {
        $colSafe = htmlspecialchars($colName, ENT_QUOTES, 'UTF-8');
        $rowSafe = htmlspecialchars($rowId, ENT_QUOTES, 'UTF-8');
        $checked = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'checked' : '';
        return <<<HTML
<td class="hs-cell hs-cell-checkbox" data-row="{$r}" data-col="{$c}"
    :class="isFocused({$r}, {$c}) ? 'hs-focused' : ''"
    @click="focusCell({$r}, {$c}, false)">
    <input type="checkbox" {$checked}
           hx-put="/api/grid/cell" hx-trigger="click"
           hx-vals='{"row_id": "{$rowSafe}", "{$colSafe}": ""}'>
</td>
HTML;
    }

    private function renderChecklistCell(string $rowId, string $colName, array $tasks, int $r, int $c): string
    {
        $colSafe = htmlspecialchars($colName, ENT_QUOTES, 'UTF-8');
        $rowSafe = htmlspecialchars($rowId, ENT_QUOTES, 'UTF-8');
        $items = '';
        foreach ($tasks as $task) {
            $idSafe = htmlspecialchars((string)($task['id'] ?? ''), ENT_QUOTES, 'UTF-8');
            $labelSafe = htmlspecialchars((string)($task['label'] ?? ''), ENT_QUOTES, 'UTF-8');
            $done = !empty($task['done']) ? 'checked' : '';
            $items .= <<<ITEM
<label><input type="checkbox" {$done}
      hx-put="/api/grid/task" hx-trigger="click"
      hx-vals='{"row_id": "{$rowSafe}", "task_id": "{$idSafe}"}'> {$labelSafe}</label>
ITEM;
        }
        return <<<HTML
<td class="hs-cell" data-row="{$r}" data-col="{$c}"
    :class="isFocused({$r}, {$c}) ? 'hs-focused' : ''"
    @click="focusCell({$r}, {$c}, false)">
    <div class="hs-checklist">{$items}</div>
</td>
HTML;
    }

    public function renderHeader(): string
    {
        $html = '<thead><tr class="hs-header">';
        $html .= '<th class="hs-cell hs-w-10"></th>';
        foreach ($this->columns as $idx => $col) {
            $name = htmlspecialchars((string)($col['label'] ?? $col['name'] ?? ''), ENT_QUOTES, 'UTF-8');
            $html .= "<th class=\"hs-cell hs-sort-btn\" @click=\"toggleSort({$idx})\">{$name} <span class=\"hs-sort-icon\">↕</span></th>";
        }
        $html .= '</tr></thead>';
        return $html;
    }

    public function renderBody(): string
    {
        $html = '<tbody hx-post="/api/grid/reorder" hx-trigger="row-reordered">';
        foreach ($this->rows as $rIdx => $row) {
            $rowId = (string)($row['id'] ?? $rIdx);
            $html .= '<tr class="hs-row" data-id="' . htmlspecialchars($rowId, ENT_QUOTES, 'UTF-8') . '">';
            $html .= '<td class="hs-cell hs-drag-handle">⋮⋮</td>';
            foreach ($this->columns as $cIdx => $col) {
                $colName = $col['name'] ?? "col_{$cIdx}";
                $type = $col['type'] ?? 'text';
                $options = $col['options'] ?? [];
                $value = $row[$colName] ?? $row[$cIdx] ?? '';
                $html .= $this->renderCell($rowId, $colName, $value, $rIdx, $cIdx, $type, $options);
            }
            $html .= '</tr>';
        }
        $html .= '</tbody>';
        return $html;
    }

    public function render(): string
    {
        $config = json_encode([
            'rows' => $this->rowCount,
            'cols' => $this->colCount,
            'sortable' => true,
        ], JSON_THROW_ON_ERROR);
        return <<<HTML
<div x-data="Hypersheet({$config})" @keydown.window="handleKey($event)" class="hs-overflow-auto">
    <table class="hs-grid hs-border-collapse">
        {$this->renderHeader()}
        {$this->renderBody()}
    </table>
</div>
HTML;
    }

    /** Render just the table body fragment (for htmx partial swaps) */
    public function renderBodyFragment(): string
    {
        return $this->renderBody();
    }

    /** Render just the table header fragment */
    public function renderHeaderFragment(): string
    {
        return $this->renderHeader();
    }
}
