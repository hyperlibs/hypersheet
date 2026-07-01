<?php

namespace HyperGrid\Database;

class JsonDbDriver implements DatabaseInterface
{
    private string $filePath;
    private array $data = [];

    public function connect(array $config): void
    {
        $this->filePath = $config['path'] ?? __DIR__ . '/data.json';
        $dir = dirname($this->filePath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        if (file_exists($this->filePath)) {
            $content = file_get_contents($this->filePath);
            $this->data = json_decode($content, true) ?? [];
        } else {
            $this->data = [];
            $this->persist();
        }
    }

    private function persist(): void
    {
        file_put_contents(
            $this->filePath,
            json_encode($this->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    private function ensureTable(string $table): void
    {
        if (!isset($this->data[$table])) {
            $this->data[$table] = [];
            $this->persist();
        }
    }

    public function fetchRows(string $table, array $columns, ?string $sortCol = null, bool $sortAsc = true): array
    {
        $this->ensureTable($table);
        $rows = $this->data[$table];

        if ($sortCol && isset($rows[0][$sortCol])) {
            usort($rows, function ($a, $b) use ($sortCol, $sortAsc) {
                $cmp = strcmp((string)($a[$sortCol] ?? ''), (string)($b[$sortCol] ?? ''));
                return $sortAsc ? $cmp : -$cmp;
            });
        }

        return $rows;
    }

    public function updateCell(string $table, string $rowId, string $column, string $value): void
    {
        $this->ensureTable($table);
        foreach ($this->data[$table] as &$row) {
            if (($row['id'] ?? null) == $rowId) {
                $row[$column] = $value;
                $this->persist();
                return;
            }
        }
    }

    public function updateRow(string $table, string $rowId, array $data): void
    {
        $this->ensureTable($table);
        foreach ($this->data[$table] as &$row) {
            if (($row['id'] ?? null) == $rowId) {
                foreach ($data as $col => $val) {
                    $row[$col] = $val;
                }
                $this->persist();
                return;
            }
        }
    }

    public function insertRow(string $table, array $data): string
    {
        $this->ensureTable($table);
        $id = (string)uuid_create();
        $data['id'] = $id;
        $this->data[$table][] = $data;
        $this->persist();
        return $id;
    }

    public function deleteRow(string $table, string $rowId): void
    {
        $this->ensureTable($table);
        $this->data[$table] = array_values(
            array_filter($this->data[$table], fn($row) => ($row['id'] ?? null) != $rowId)
        );
        $this->persist();
    }

    public function reorderRows(string $table, array $order): void
    {
        $this->ensureTable($table);
        $indexed = [];
        foreach ($this->data[$table] as $row) {
            $indexed[$row['id']] = $row;
        }
        $reordered = [];
        foreach ($order as $rowId) {
            if (isset($indexed[$rowId])) {
                $reordered[] = $indexed[$rowId];
            }
        }
        $this->data[$table] = $reordered;
        $this->persist();
    }

    public function getRow(string $table, string $rowId): ?array
    {
        $this->ensureTable($table);
        foreach ($this->data[$table] as $row) {
            if (($row['id'] ?? null) == $rowId) {
                return $row;
            }
        }
        return null;
    }

    public function disconnect(): void
    {
        // no-op for file-based storage
    }
}
