package database

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/lib/pq"
)

type PostgresDriver struct {
	db *sql.DB
}

func (d *PostgresDriver) Connect(config map[string]string) error {
	host := config["host"]
	if host == "" {
		host = "localhost"
	}
	port := config["port"]
	if port == "" {
		port = "5432"
	}
	dbname := config["database"]
	if dbname == "" {
		dbname = "Hypersheet"
	}
	user := config["username"]
	if user == "" {
		user = "postgres"
	}
	password := config["password"]

	dsn := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=disable",
		host, port, dbname, user, password)
	var err error
	d.db, err = sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	return d.db.Ping()
}

func quoteIdentPG(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

func (d *PostgresDriver) FetchRows(table string, columns []string, sortCol string, sortAsc bool) ([]Row, error) {
	safeTable := quoteIdentPG(table)
	query := fmt.Sprintf("SELECT * FROM %s", safeTable)
	if sortCol != "" {
		dir := "ASC"
		if !sortAsc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", quoteIdentPG(sortCol), dir)
	}
	rows, err := d.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanRows(rows)
}

func (d *PostgresDriver) UpdateCell(table string, rowID string, column string, value string) error {
	safeTable := quoteIdentPG(table)
	safeCol := quoteIdentPG(column)
	_, err := d.db.Exec(
		fmt.Sprintf("UPDATE %s SET %s = $1 WHERE id = $2", safeTable, safeCol),
		value, rowID,
	)
	return err
}

func (d *PostgresDriver) UpdateRow(table string, rowID string, data Row) error {
	safeTable := quoteIdentPG(table)
	var sets []string
	args := []interface{}{}
	i := 1
	for col, val := range data {
		sets = append(sets, fmt.Sprintf("%s = $%d", quoteIdentPG(col), i))
		args = append(args, val)
		i++
	}
	args = append(args, rowID)
	query := fmt.Sprintf("UPDATE %s SET %s WHERE id = $%d",
		safeTable, strings.Join(sets, ", "), i)
	_, err := d.db.Exec(query, args...)
	return err
}

func (d *PostgresDriver) InsertRow(table string, data Row) (string, error) {
	safeTable := quoteIdentPG(table)
	var cols, vals []string
	args := []interface{}{}
	i := 1
	for col, val := range data {
		cols = append(cols, quoteIdentPG(col))
		vals = append(vals, fmt.Sprintf("$%d", i))
		args = append(args, val)
		i++
	}
	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) RETURNING id",
		safeTable, strings.Join(cols, ", "), strings.Join(vals, ", "))
	var id string
	err := d.db.QueryRow(query, args...).Scan(&id)
	return id, err
}

func (d *PostgresDriver) DeleteRow(table string, rowID string) error {
	safeTable := quoteIdentPG(table)
	_, err := d.db.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = $1", safeTable), rowID)
	return err
}

func (d *PostgresDriver) ReorderRows(table string, order []string) error {
	safeTable := quoteIdentPG(table)
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(fmt.Sprintf("UPDATE %s SET sort_order = $1 WHERE id = $2", safeTable))
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

func (d *PostgresDriver) GetRow(table string, rowID string) (Row, error) {
	safeTable := quoteIdentPG(table)
	row := d.db.QueryRow(fmt.Sprintf("SELECT * FROM %s WHERE id = $1", safeTable), rowID)
	return scanRow(row)
}

func (d *PostgresDriver) Disconnect() error {
	return d.db.Close()
}

// scanRows converts sql.Rows to []Row
func scanRows(rows *sql.Rows) ([]Row, error) {
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	var result []Row
	for rows.Next() {
		values := make([]interface{}, len(cols))
		valuePtrs := make([]interface{}, len(cols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}
		row := make(Row)
		for i, col := range cols {
			if values[i] != nil {
				row[col] = fmt.Sprintf("%v", values[i])
			} else {
				row[col] = ""
			}
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// scanRow scans a single row from a *sql.Row
func scanRow(row *sql.Row) (Row, error) {
	cols, err := rowToColumns(row)
	if err != nil {
		return nil, err
	}
	return cols, nil
}

func rowToColumns(row *sql.Row) (Row, error) {
	// We need to know the columns. Use a workaround with a second query.
	// In production, use column info from the caller.
	return nil, fmt.Errorf("use FetchRows or a typed query instead")
}
