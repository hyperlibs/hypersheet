package database

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

type SqliteDriver struct {
	db *sql.DB
}

func (d *SqliteDriver) Connect(config map[string]string) error {
	path := config["path"]
	if path == "" {
		path = ":memory:"
	}
	var err error
	d.db, err = sql.Open("sqlite3", path)
	if err != nil {
		return err
	}
	// Enable WAL mode for better concurrent access
	d.db.Exec("PRAGMA journal_mode=WAL")
	d.db.Exec("PRAGMA foreign_keys=ON")
	return d.db.Ping()
}

func (d *SqliteDriver) FetchRows(table string, columns []string, sortCol string, sortAsc bool) ([]Row, error) {
	query := fmt.Sprintf("SELECT * FROM %q", table)
	if sortCol != "" {
		dir := "ASC"
		if !sortAsc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %q %s", sortCol, dir)
	}
	rows, err := d.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRows(rows)
}

func (d *SqliteDriver) UpdateCell(table string, rowID string, column string, value string) error {
	query := fmt.Sprintf("UPDATE %q SET %q = ? WHERE id = ?", table, column)
	_, err := d.db.Exec(query, value, rowID)
	return err
}

func (d *SqliteDriver) UpdateRow(table string, rowID string, data Row) error {
	var sets []string
	args := []interface{}{}
	for col, val := range data {
		sets = append(sets, fmt.Sprintf("%q = ?", col))
		args = append(args, val)
	}
	args = append(args, rowID)
	query := fmt.Sprintf("UPDATE %q SET %s WHERE id = ?", table, strings.Join(sets, ", "))
	_, err := d.db.Exec(query, args...)
	return err
}

func (d *SqliteDriver) InsertRow(table string, data Row) (string, error) {
	var cols, vals []string
	args := []interface{}{}
	for col, val := range data {
		cols = append(cols, fmt.Sprintf("%q", col))
		vals = append(vals, "?")
		args = append(args, val)
	}
	query := fmt.Sprintf("INSERT INTO %q (%s) VALUES (%s)",
		table, strings.Join(cols, ", "), strings.Join(vals, ", "))
	result, err := d.db.Exec(query, args...)
	if err != nil {
		return "", err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%d", id), nil
}

func (d *SqliteDriver) DeleteRow(table string, rowID string) error {
	_, err := d.db.Exec(fmt.Sprintf("DELETE FROM %q WHERE id = ?", table), rowID)
	return err
}

func (d *SqliteDriver) ReorderRows(table string, order []string) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(fmt.Sprintf("UPDATE %q SET sort_order = ? WHERE id = ?", table))
	if err != nil {
		return err
	}
	defer stmt.Close()

	for pos, rowID := range order {
		if _, err := stmt.Exec(pos, rowID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (d *SqliteDriver) GetRow(table string, rowID string) (Row, error) {
	row := d.db.QueryRow(fmt.Sprintf("SELECT * FROM %q WHERE id = ?", table), rowID)
	return scanRow(row)
}

func (d *SqliteDriver) Disconnect() error {
	return d.db.Close()
}
