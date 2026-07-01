<?php

namespace Hypersheet\Database;

class MysqlDriver implements DatabaseInterface
{
    private ?\PDO $pdo = null;

    public function connect(array $config): void
    {
        $host = $config['host'] ?? 'localhost';
        $port = $config['port'] ?? 3306;
        $dbname = $config['database'] ?? 'Hypersheet';
        $user = $config['username'] ?? 'root';
        $pass = $config['password'] ?? '';
        $charset = $config['charset'] ?? 'utf8mb4';

        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
        $this->pdo = new \PDO($dsn, $user, $pass, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);
    }

    public function fetchRows(string $table, array $columns, ?string $sortCol = null, bool $sortAsc = true): array
    {
        $sql = "SELECT * FROM `{$table}`";
        if ($sortCol) {
            $dir = $sortAsc ? 'ASC' : 'DESC';
            $sql .= " ORDER BY `{$sortCol}` {$dir}";
        }
        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll();
    }

    public function updateCell(string $table, string $rowId, string $column, string $value): void
    {
        $stmt = $this->pdo->prepare("UPDATE `{$table}` SET `{$column}` = :value WHERE id = :id");
        $stmt->execute(['value' => $value, 'id' => $rowId]);
    }

    public function updateRow(string $table, string $rowId, array $data): void
    {
        $sets = [];
        $params = ['id' => $rowId];
        foreach ($data as $col => $val) {
            $sets[] = "`{$col}` = :{$col}";
            $params[$col] = $val;
        }
        $setStr = implode(', ', $sets);
        $stmt = $this->pdo->prepare("UPDATE `{$table}` SET {$setStr} WHERE id = :id");
        $stmt->execute($params);
    }

    public function insertRow(string $table, array $data): string
    {
        $cols = implode('`, `', array_keys($data));
        $phs = ':' . implode(', :', array_keys($data));
        $stmt = $this->pdo->prepare("INSERT INTO `{$table}` (`{$cols}`) VALUES ({$phs})");
        $stmt->execute($data);
        return $this->pdo->lastInsertId();
    }

    public function deleteRow(string $table, string $rowId): void
    {
        $stmt = $this->pdo->prepare("DELETE FROM `{$table}` WHERE id = :id");
        $stmt->execute(['id' => $rowId]);
    }

    public function reorderRows(string $table, array $order): void
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("UPDATE `{$table}` SET sort_order = :pos WHERE id = :id");
            foreach ($order as $position => $rowId) {
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
        $stmt = $this->pdo->prepare("SELECT * FROM `{$table}` WHERE id = :id");
        $stmt->execute(['id' => $rowId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function disconnect(): void
    {
        $this->pdo = null;
    }
}
