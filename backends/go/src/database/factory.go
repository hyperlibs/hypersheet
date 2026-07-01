package database

import "fmt"

// New creates a database driver by name
func New(driver string) (Database, error) {
	switch driver {
	case "pgsql", "postgres", "postgresql":
		return &PostgresDriver{}, nil
	case "mysql", "mariadb", "innodb":
		return &MysqlDriver{}, nil
	case "sqlite", "sqlite3":
		return &SqliteDriver{}, nil
	case "json", "jsondb", "file":
		return &JsonDbDriver{}, nil
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", driver)
	}
}
