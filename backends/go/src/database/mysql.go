package database

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

type MysqlDriver struct {
	db *sql.DB
}

func (d *MysqlDriver) Connect(config map[string]string) error {
	host := config["host"]
	if host == "" {
		host = "localhost"
	}
	port := config["port"]
	if port == "" {
		port = "3306"
	}
	dbname := config["database"]
	if dbname == "" {
		dbname = "hypergrid"
	}
	user := config["username"]
	if user == "" {
		user = "root"
	}
	password := config["password"]
	charset := config["charset"]
	if charset == "" {
		charset = "utf8mb4"
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=%s&parseTime=true",
		user, password, host, port, dbname, charset)
	var err error
	d.db, err = sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	return d.db.Ping()
}

func backtick(s string) string {
	return "`" + strings.ReplaceAll(s, "`", "``") + "`"
}

func (d *MysqlDriver) FetchRows(table string, columns []string, sortCol string, sortAsc bool) ([]Row, error) {
	query := fmt.Sprintf("SELECT * FROM %s", backtick(table))
	if sortCol != "" {
		dir := "ASC"
		if !sortAsc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", backtick(sortCol), dir)
	}
	rows, err := d.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRows(rows)
}

func (d *MysqlDriver) UpdateCell(table string, rowID string, column string, value string) error {
	_, err := d.db.Exec(
		fmt.Sprintf("UPDATE %s SET %s = ? WHERE id = ?", backtick(table), backtick(column)),
		value, rowID,
	)
	return err
}

func (d *MysqlDriver) UpdateRow(table string, rowID string, data Row) error {
	var sets []string
	args := []interface{}{}
	for col, val := range data {
		sets = append(sets, fmt.Sprintf("%s = ?", backtick(col)))
		args = append(args, val)
	}
	args = append(args, rowID)
	query := fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", backtick(table), strings.Join(sets, ", "))
	_, err := d.db.Exec(query, args...)
	return err
}

func (d *MysqlDriver) InsertRow(table string, data Row) (string, error) {
	var cols, vals []string
	args := []interface{}{}
	for col, val := range data {
		cols = append(cols, backtick(col))
		vals = append(vals, "?")
		args = append(args, val)
	}
	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		backtick(table), strings.Join(cols, ", "), strings.Join(vals, ", "))
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

func (d *MysqlDriver) DeleteRow(table string, rowID string) error {
	_, err := d.db.Exec(fmt.Sprintf("DELETE FROM %s WHERE id = ?", backtick(table)), rowID)
	return err
}

func (d *MysqlDriver) ReorderRows(table string, order []string) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(fmt.Sprintf("UPDATE %s SET sort_order = ? WHERE id = ?", backtick(table)))
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

func (d *MysqlDriver) GetRow(table string, rowID string) (Row, error) {
	query := fmt.Sprintf("SELECT * FROM %s WHERE id = ?", backtick(table))
	row := d.db.QueryRow(query, rowID)
	return scanRow(row)
}

func (d *MysqlDriver) Disconnect() error {
	return d.db.Close()
}
