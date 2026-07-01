<?php

namespace HyperGrid\Database;

class DatabaseFactory
{
    public static function create(string $driver): DatabaseInterface
    {
        return match ($driver) {
            'pgsql', 'postgres', 'postgresql' => new PostgresDriver(),
            'mysql', 'mariadb', 'innodb' => new MysqlDriver(),
            'sqlite', 'sqlite3' => new SqliteDriver(),
            'json', 'jsondb', 'file' => new JsonDbDriver(),
            default => throw new \InvalidArgumentException("Unsupported database driver: {$driver}"),
        };
    }
}
