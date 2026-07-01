<?php

namespace Hypersheet\Database;

interface DatabaseInterface
{
    public function connect(array $config): void;

    public function fetchRows(string $table, array $columns, ?string $sortCol = null, bool $sortAsc = true): array;

    public function updateCell(string $table, string $rowId, string $column, string $value): void;

    public function updateRow(string $table, string $rowId, array $data): void;

    public function insertRow(string $table, array $data): string;

    public function deleteRow(string $table, string $rowId): void;

    public function reorderRows(string $table, array $order): void;

    public function getRow(string $table, string $rowId): ?array;

    public function disconnect(): void;
}
