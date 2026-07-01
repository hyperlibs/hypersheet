package hypersheet

import (
	"encoding/json"
	"fmt"
	"html/template"
	"strings"

	"github.com/casbin/casbin/v2"
)

type Column struct {
	Name    string   `json:"name"`
	Label   string   `json:"label,omitempty"`
	Type    string   `json:"type,omitempty"`
	Options []string `json:"options,omitempty"`
}

type Row map[string]interface{}

type Grid struct {
	enforcer *casbin.Enforcer
	userID   string
	columns  []Column
	rows     []Row
	logger   *CasbinLogger
}

// NewGrid creates a grid with the given columns and rows.
// Casbin authorization is optional — call .WithAuth() to enable.
func NewGrid(columns []Column, rows []Row) *Grid {
	return &Grid{
		columns: columns,
		rows:    rows,
	}
}

// WithAuth enables Casbin authorization for the grid.
func (g *Grid) WithAuth(enforcer *casbin.Enforcer, userID string) *Grid {
	g.enforcer = enforcer
	g.userID = userID
	return g
}

// WithLogger enables optional Casbin audit logging.
func (g *Grid) WithLogger(logger *CasbinLogger) *Grid {
	g.logger = logger
	return g
}

func (g *Grid) SetRows(rows []Row) *Grid {
	g.rows = rows
	return g
}

func (g *Grid) SetColumns(columns []Column) *Grid {
	g.columns = columns
	return g
}

func (g *Grid) canAccess(colName, action string) bool {
	if g.enforcer == nil {
		return true
	}
	ok, _ := g.enforcer.Enforce(g.userID, fmt.Sprintf("column:%s", colName), action)
	if g.logger != nil {
		g.logger.LogCellAccess(g.userID, colName, action, ok)
	}
	return ok
}

func (g *Grid) RenderCell(rowID, colName string, value interface{}, rIdx, cIdx int, cellType string, options []string) template.HTML {
	canRead := g.canAccess(colName, "read")
	canWrite := g.canAccess(colName, "write")

	if !canRead {
		return `<td class="hs-cell hs-hidden">🔒 Hidden</td>`
	}

	safeVal := template.HTMLEscapeString(fmt.Sprintf("%v", value))

	if !canWrite {
		return template.HTML(fmt.Sprintf(`<td class="hs-cell hs-locked">🔒 %s</td>`, safeVal))
	}

	switch cellType {
	case "chip":
		return g.renderChipCell(rowID, colName, safeVal, rIdx, cIdx)
	case "dropdown":
		return g.renderDropdownCell(rowID, colName, safeVal, rIdx, cIdx, options)
	case "checklist":
		return g.renderChecklistCell(rowID, colName, value, rIdx, cIdx, options)
	default:
		return g.renderTextCell(rowID, colName, safeVal, rIdx, cIdx)
	}
}

func (g *Grid) renderTextCell(rowID, colName, value string, r, c int) template.HTML {
	colSafe := template.HTMLEscapeString(colName)
	rowSafe := template.HTMLEscapeString(rowID)
	html := fmt.Sprintf(`
<td class="hs-cell hs-cell-text" data-row="%d" data-col="%d"
    :class="isFocused(%d, %d) ? 'hs-focused' : ''"
    @click="focusCell(%d, %d, false)">
    <input type="text" value="%s" class="hs-cell-input"
           hx-put="/api/grid/cell" hx-trigger="blur"
           name="%s" hx-vals='{"row_id": "%s"}'>
</td>`, r, c, r, c, r, c, value, colSafe, rowSafe)
	return template.HTML(html)
}

func (g *Grid) renderChipCell(rowID, colName, value string, r, c int) template.HTML {
	colSafe := template.HTMLEscapeString(colName)
	rowSafe := template.HTMLEscapeString(rowID)
	chipClass := "hs-chip-gray"
	switch strings.ToLower(value) {
	case "active":
		chipClass = "hs-chip-active"
	case "paused", "pending":
		chipClass = "hs-chip-pending"
	case "archived", "inactive":
		chipClass = "hs-chip-archived"
	}
	html := fmt.Sprintf(`
<td class="hs-cell hs-cell-chip" data-row="%d" data-col="%d"
    :class="isFocused(%d, %d) ? 'hs-focused' : ''"
    @click="focusCell(%d, %d, false)"
    x-data="{ open: false }">
    <div @click="open = !open" class="hs-cursor-pointer hs-select-none">
        <span class="hs-chip %s">%s</span>
    </div>
    <div class="hs-chip-menu" x-show="open" @click.away="open = false" x-transition>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell" hx-vals='{"row_id": "%s", "%s": "Active"}'
             @click="open = false">Active</div>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell" hx-vals='{"row_id": "%s", "%s": "Paused"}'
             @click="open = false">Paused</div>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell" hx-vals='{"row_id": "%s", "%s": "Archived"}'
             @click="open = false">Archived</div>
    </div>
</td>`, r, c, r, c, r, c, chipClass, value, rowSafe, colSafe, rowSafe, colSafe, rowSafe, colSafe)
	return template.HTML(html)
}

func (g *Grid) renderDropdownCell(rowID, colName, value string, r, c int, options []string) template.HTML {
	colSafe := template.HTMLEscapeString(colName)
	rowSafe := template.HTMLEscapeString(rowID)
	var items strings.Builder
	for _, opt := range options {
		optSafe := template.HTMLEscapeString(opt)
		items.WriteString(fmt.Sprintf(`
        <div class="hs-dropdown-item"
             hx-put="/api/grid/cell" hx-vals='{"row_id": "%s", "%s": "%s"}'
             @click="open = false">%s</div>`, rowSafe, colSafe, optSafe, optSafe))
	}
	html := fmt.Sprintf(`
<td class="hs-cell hs-cell-dropdown" data-row="%d" data-col="%d"
    :class="isFocused(%d, %d) ? 'hs-focused' : ''"
    @click="focusCell(%d, %d, false)"
    x-data="{ open: false }">
    <div @click="open = !open" class="hs-dropdown-trigger">
        <span>%s</span>
        <span class="hs-dropdown-arrow">▼</span>
    </div>
    <div class="hs-dropdown-menu" x-show="open" @click.away="open = false" x-transition>
        %s
    </div>
</td>`, r, c, r, c, r, c, value, items.String())
	return template.HTML(html)
}

func (g *Grid) renderChecklistCell(rowID, colName string, value interface{}, r, c int, tasks []string) template.HTML {
	// tasks are passed as option values
	colSafe := template.HTMLEscapeString(colName)
	rowSafe := template.HTMLEscapeString(rowID)
	var items strings.Builder
	for _, task := range tasks {
		taskSafe := template.HTMLEscapeString(task)
		items.WriteString(fmt.Sprintf(`
        <label><input type="checkbox"
              hx-put="/api/grid/task" hx-trigger="click"
              hx-vals='{"row_id": "%s", "task": "%s"}'> %s</label>`, rowSafe, taskSafe, taskSafe))
	}
	html := fmt.Sprintf(`
<td class="hs-cell" data-row="%d" data-col="%d"
    :class="isFocused(%d, %d) ? 'hs-focused' : ''"
    @click="focusCell(%d, %d, false)">
    <div class="hs-checklist">%s</div>
</td>`, r, c, r, c, r, c, items.String())
	return template.HTML(html)
}

func (g *Grid) RenderHeader() template.HTML {
	var b strings.Builder
	b.WriteString(`<thead><tr class="hs-header">`)
	b.WriteString(`<th class="hs-cell hs-w-10"></th>`)
	for idx, col := range g.columns {
		label := col.Label
		if label == "" {
			label = col.Name
		}
		safe := template.HTMLEscapeString(label)
		b.WriteString(fmt.Sprintf(`<th class="hs-cell hs-sort-btn" @click="toggleSort(%d)">%s <span class="hs-sort-icon">↕</span></th>`, idx, safe))
	}
	b.WriteString(`</tr></thead>`)
	return template.HTML(b.String())
}

func (g *Grid) RenderBody() template.HTML {
	var b strings.Builder
	b.WriteString(`<tbody hx-post="/api/grid/reorder" hx-trigger="row-reordered">`)
	for rIdx, row := range g.rows {
		rowID := fmt.Sprintf("%v", row["id"])
		if rowID == "<nil>" {
			rowID = fmt.Sprintf("%d", rIdx)
		}
		b.WriteString(fmt.Sprintf(`<tr class="hs-row" data-id="%s">`, template.HTMLEscapeString(rowID)))
		b.WriteString(`<td class="hs-cell hs-drag-handle">⋮⋮</td>`)
		for cIdx, col := range g.columns {
			colName := col.Name
			cellType := col.Type
			options := col.Options
			val := row[colName]
			if val == nil {
				val = ""
			}
			b.WriteString(string(g.RenderCell(rowID, colName, val, rIdx, cIdx, cellType, options)))
		}
		b.WriteString(`</tr>`)
	}
	b.WriteString(`</tbody>`)
	return template.HTML(b.String())
}

func (g *Grid) Render() template.HTML {
	cfg := map[string]interface{}{
		"rows":     len(g.rows),
		"cols":     len(g.columns),
		"sortable": true,
	}
	cfgJSON, _ := json.Marshal(cfg)
	html := fmt.Sprintf(`
<div x-data="Hypersheet(%s)" @keydown.window="handleKey($event)" class="hs-overflow-auto">
    <table class="hs-grid hs-border-collapse">
        %s
        %s
    </table>
</div>`, string(cfgJSON), string(g.RenderHeader()), string(g.RenderBody()))
	return template.HTML(html)
}

// RenderBodyFragment returns just the <tbody> HTML (for htmx partial swaps)
func (g *Grid) RenderBodyFragment() template.HTML {
	return g.RenderBody()
}

// RenderHeaderFragment returns just the <thead> HTML
func (g *Grid) RenderHeaderFragment() template.HTML {
	return g.RenderHeader()
}
