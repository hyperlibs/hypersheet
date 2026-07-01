package database

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

type JsonDbDriver struct {
	mu       sync.RWMutex
	filePath string
	data     map[string][]Row
}

func (d *JsonDbDriver) Connect(config map[string]string) error {
	d.filePath = config["path"]
	if d.filePath == "" {
		d.filePath = "Hypersheet.json"
	}
	d.data = make(map[string][]Row)

	dir := filepath.Dir(d.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	content, err := os.ReadFile(d.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return d.persist()
		}
		return err
	}
	return json.Unmarshal(content, &d.data)
}

func (d *JsonDbDriver) persist() error {
	content, err := json.MarshalIndent(d.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(d.filePath, content, 0644)
}

func (d *JsonDbDriver) ensureTable(table string) {
	if _, ok := d.data[table]; !ok {
		d.data[table] = []Row{}
	}
}

func (d *JsonDbDriver) FetchRows(table string, columns []string, sortCol string, sortAsc bool) ([]Row, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	d.ensureTable(table)
	rows := make([]Row, len(d.data[table]))
	copy(rows, d.data[table])

	if sortCol != "" && len(rows) > 0 {
		sort.SliceStable(rows, func(i, j int) bool {
			a := rows[i][sortCol]
			b := rows[j][sortCol]
			cmp := strings.Compare(a, b)
			if sortAsc {
				return cmp < 0
			}
			return cmp > 0
		})
	}

	return rows, nil
}

func (d *JsonDbDriver) UpdateCell(table string, rowID string, column string, value string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.ensureTable(table)
	for i, row := range d.data[table] {
		if row["id"] == rowID {
			d.data[table][i] = cloneAndSet(row, column, value)
			return d.persist()
		}
	}
	return ErrNotFound
}

func (d *JsonDbDriver) UpdateRow(table string, rowID string, data Row) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.ensureTable(table)
	for i, row := range d.data[table] {
		if row["id"] == rowID {
			updated := cloneRow(row)
			for k, v := range data {
				updated[k] = v
			}
			d.data[table][i] = updated
			return d.persist()
		}
	}
	return ErrNotFound
}

func (d *JsonDbDriver) InsertRow(table string, data Row) (string, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.ensureTable(table)
	// Generate a simple unique ID
	id := generateID()
	data["id"] = id
	d.data[table] = append(d.data[table], cloneRow(data))
	return id, d.persist()
}

func (d *JsonDbDriver) DeleteRow(table string, rowID string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.ensureTable(table)
	filtered := make([]Row, 0, len(d.data[table]))
	for _, row := range d.data[table] {
		if row["id"] != rowID {
			filtered = append(filtered, row)
		}
	}
	d.data[table] = filtered
	return d.persist()
}

func (d *JsonDbDriver) ReorderRows(table string, order []string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.ensureTable(table)
	indexed := make(map[string]Row, len(d.data[table]))
	for _, row := range d.data[table] {
		indexed[row["id"]] = row
	}
	reordered := make([]Row, 0, len(order))
	for _, rowID := range order {
		if row, ok := indexed[rowID]; ok {
			reordered = append(reordered, row)
		}
	}
	d.data[table] = reordered
	return d.persist()
}

func (d *JsonDbDriver) GetRow(table string, rowID string) (Row, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	d.ensureTable(table)
	for _, row := range d.data[table] {
		if row["id"] == rowID {
			return cloneRow(row), nil
		}
	}
	return nil, ErrNotFound
}

func (d *JsonDbDriver) Disconnect() error {
	return d.persist()
}

// Helpers
func cloneRow(r Row) Row {
	c := make(Row, len(r))
	for k, v := range r {
		c[k] = v
	}
	return c
}

func cloneAndSet(r Row, key, value string) Row {
	c := cloneRow(r)
	c[key] = value
	return c
}

var idCounter int64

func generateID() string {
	idCounter++
	return fmt.Sprintf("%d", idCounter)
}
