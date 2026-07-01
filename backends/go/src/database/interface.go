package database

import "errors"

var (
	ErrNotFound = errors.New("row not found")
	ErrNoDriver = errors.New("no database driver registered")
)

type Row map[string]string

type Database interface {
	// Connect establishes the database connection
	Connect(config map[string]string) error

	// FetchRows returns all rows from a table, optionally sorted
	FetchRows(table string, columns []string, sortCol string, sortAsc bool) ([]Row, error)

	// UpdateCell updates a single cell value
	UpdateCell(table string, rowID string, column string, value string) error

	// UpdateRow updates multiple columns in a row
	UpdateRow(table string, rowID string, data Row) error

	// InsertRow inserts a new row and returns its ID
	InsertRow(table string, data Row) (string, error)

	// DeleteRow removes a row by ID
	DeleteRow(table string, rowID string) error

	// ReorderRows updates sort_order for all rows
	ReorderRows(table string, order []string) error

	// GetRow returns a single row by ID
	GetRow(table string, rowID string) (Row, error)

	// Disconnect closes the database connection
	Disconnect() error
}
