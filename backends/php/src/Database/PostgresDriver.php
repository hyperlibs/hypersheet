<?php

namespace Hypersheet\Database;

class PostgresDriver implements DatabaseInterface
{
    private ?\PDO $pdo = null;

    public function connect(array $config): void
    {
        $host = $config['host'] ?? 'localhost';
        $port = $config['port'] ?? 5432;
        $dbname = $config['database'] ?? 'Hypersheet';
        $user = $config['username'] ?? 'postgres';
        $pass = $config['password'] ?? '';

        $dsn = "pgsql:host={$host};port={$port};dbname={$dbname}";
        $this->pdo = new \PDO($dsn, $user, $pass, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);
    }

    public function fetchRows(string $table, array $columns, ?string $sortCol = null, bool $sortAsc = true): array
    {
        $cols = array_map(fn($c) => '"' . str_replace('"', '""', $c) . '"', $columns);
        $colList = implode(', ', $cols);
        $sql = "SELECT * FROM \"{$table}\"";
        if ($sortCol) {
            $dir = $sortAsc ? 'ASC' : 'DESC';
            $safeCol = str_replace('"', '""', $sortCol);
            $sql .= " ORDER BY \"{$safeCol}\" {$dir}";
        }
        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll();
    }

    public function updateCell(string $table, string $rowId, string $column, string $value): void
    {
        $safeCol = str_replace('"', '""', $column);
        $stmt = $this->pdo->prepare("UPDATE \"{$table}\" SET \"{$safeCol}\" = :value WHERE id = :id");
        $stmt->execute(['value' => $value, 'id' => $rowId]);
    }

    public function updateRow(string $table, string $rowId, array $data): void
    {
        $sets = [];
        $params = ['id' => $rowId];
        foreach ($data as $col => $val) {
            $safeCol = str_replace('"', '""', $col);
            $sets[] = "\"{$safeCol}\" = :{$col}";
            $params[$col] = $val;
        }
        $setStr = implode(', ', $sets);
        $stmt = $this->pdo->prepare("UPDATE \"{$table}\" SET {$setStr} WHERE id = :id");
        $stmt->execute($params);
    }

    public function insertRow(string $table, array $data): string
    {
        $cols = [];
        $placeholders = [];
        $params = [];
        foreach ($data as $col => $val) {
            $safeCol = str_replace('"', '""', $col);
            $cols[] = "\"{$safeCol}\"";
            $placeholders[] = ":{$col}";
            $params[$col] = $val;
        }
        $colStr = implode(', ', $cols);
        $phStr = implode(', ', $placeholders);
        $stmt = $this->pdo->prepare("INSERT INTO \"{$table}\" ({$colStr}) VALUES ({$phStr}) RETURNING id");
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    public function deleteRow(string $table, string $rowId): void
    {
        $stmt = $this->pdo->prepare("DELETE FROM \"{$table}\" WHERE id = :id");
        $stmt->execute(['id' => $rowId]);
    }

    public function reorderRows(string $table, array $order): void
    {
        $this->pdo->beginTransaction();
        try {
            foreach ($order as $position => $rowId) {
                $stmt = $this->pdo->prepare("UPDATE \"{$table}\" SET sort_order = :pos WHERE id = :id");
                $stmt->execute(['pos' => $position, 'id' => $rowId]);
            }
            $this->pdo->commit();
        } catch (\Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function getRow(string $table, string $rowId): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM \"{$table}\" WHERE id = :id");
        $stmt->execute(['id' => $rowId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function disconnect(): void
    {
        $this->pdo = null;
    }
}
