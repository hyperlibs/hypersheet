use casbin::prelude::*;
use serde_json;
use crate::casbin_logger::CasbinLogger;

/// A column definition for the grid
#[derive(Debug, Clone)]
pub struct Column {
    pub name: String,
    pub label: String,
    pub cell_type: CellType,
}

#[derive(Debug, Clone)]
pub enum CellType {
    Text,
    Chip,
    Dropdown(Vec<String>),
    Checklist(Vec<ChecklistItem>),
}

#[derive(Debug, Clone)]
pub struct ChecklistItem {
    pub id: String,
    pub label: String,
    pub done: bool,
}

/// A row of data represented as a map of column names to values
pub type Row = std::collections::HashMap<String, String>;

/// Hypersheet rendering engine for Rust
pub struct Grid {
    enforcer: Option<SyncedEnforcer>,
    user_id: String,
    columns: Vec<Column>,
    rows: Vec<Row>,
    logger: Option<CasbinLogger>,
}

impl Grid {
    pub fn new(
        enforcer: Option<SyncedEnforcer>,
        user_id: &str,
        columns: Vec<Column>,
        rows: Vec<Row>,
    ) -> Self {
        Self {
            enforcer,
            user_id: user_id.to_string(),
            columns,
            rows,
            logger: None,
        }
    }

    pub fn with_logger(mut self, logger: CasbinLogger) -> Self {
        self.logger = Some(logger);
        self
    }

    pub fn set_logger(&mut self, logger: CasbinLogger) {
        self.logger = Some(logger);
    }

    fn can_access(&self, col_name: &str, action: &str) -> bool {
        let granted = if let Some(ref enforcer) = self.enforcer {
            enforcer
                .enforce((self.user_id.as_str(), &format!("column:{}", col_name), action))
                .unwrap_or(false)
        } else {
            true // No enforcer = no restrictions
        };
        if let Some(ref logger) = self.logger {
            logger.log_cell_access(&self.user_id, col_name, action, granted);
        }
        granted
    }

    fn escape(s: &str) -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#39;")
    }

    fn hx_vals(entries: &[(&str, &str)]) -> String {
        let mut map = serde_json::Map::new();
        for (k, v) in entries {
            map.insert(k.to_string(), serde_json::Value::String((*v).to_string()));
        }
        let json_str = serde_json::to_string(&serde_json::Value::Object(map)).unwrap_or_default();
        // htmx uses single quotes for hx-vals with double quotes inside
        json_str
    }

    /// Render a single cell
    pub fn render_cell(
        &self,
        row_id: &str,
        col_name: &str,
        value: &str,
        r_idx: usize,
        c_idx: usize,
        cell_type: &CellType,
    ) -> String {
        let can_read = self.can_access(col_name, "read");
        let can_write = self.can_access(col_name, "write");

        if !can_read {
            return r#"<td class="hs-cell hs-hidden">🔒 Hidden</td>"#.to_string();
        }

        let safe_val = Self::escape(value);
        let safe_col = Self::escape(col_name);
        let safe_row = Self::escape(row_id);

        if !can_write {
            return format!(
                r#"<td class="hs-cell hs-locked">🔒 {}</td>"#,
                safe_val
            );
        }

        match cell_type {
            CellType::Text => self.render_text_cell(&safe_row, &safe_col, &safe_val, r_idx, c_idx),
            CellType::Chip => self.render_chip_cell(&safe_row, &safe_col, &safe_val, r_idx, c_idx),
            CellType::Dropdown(opts) => {
                self.render_dropdown_cell(&safe_row, &safe_col, &safe_val, r_idx, c_idx, opts)
            }
            CellType::Checklist(items) => {
                self.render_checklist_cell(&safe_row, &safe_col, r_idx, c_idx, items)
            }
        }
    }

    fn render_text_cell(&self, row_id: &str, col_name: &str, value: &str, r: usize, c: usize) -> String {
        format!(
            r#"<td class="hs-cell hs-cell-text" data-row="{}" data-col="{}"
    :class="isFocused({}, {}) ? 'hs-focused' : ''"
    @click="focusCell({}, {}, false)">
    <input type="text" value="{}" class="hs-cell-input"
           hx-put="/api/grid/cell" hx-trigger="blur"
           name="{}" hx-vals='{{"row_id": "{}"}}'>
</td>"#,
            r, c, r, c, r, c, value, col_name, row_id
        )
    }

    fn render_chip_cell(&self, row_id: &str, col_name: &str, value: &str, r: usize, c: usize) -> String {
        let chip_class = match value.to_lowercase().as_str() {
            "active" => "hs-chip-active",
            "paused" | "pending" => "hs-chip-pending",
            "archived" | "inactive" => "hs-chip-archived",
            _ => "hs-chip-gray",
        };
        format!(
            r#"<td class="hs-cell hs-cell-chip" data-row="{}" data-col="{}"
    :class="isFocused({}, {}) ? 'hs-focused' : ''"
    @click="focusCell({}, {}, false)"
    x-data="{{ open: false }}">
    <div @click="open = !open" class="hs-cursor-pointer hs-select-none">
        <span class="hs-chip {}">{}</span>
    </div>
    <div class="hs-chip-menu" x-show="open" @click.away="open = false" x-transition>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell"
             hx-vals='{{"row_id": "{}", "{}": "Active"}}'
             @click="open = false">Active</div>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell"
             hx-vals='{{"row_id": "{}", "{}": "Paused"}}'
             @click="open = false">Paused</div>
        <div class="hs-chip-option"
             hx-put="/api/grid/cell"
             hx-vals='{{"row_id": "{}", "{}": "Archived"}}'
             @click="open = false">Archived</div>
    </div>
</td>"#,
            r, c, r, c, r, c, chip_class, value, row_id, col_name, row_id, col_name, row_id, col_name
        )
    }

    fn render_dropdown_cell(
        &self,
        row_id: &str,
        col_name: &str,
        value: &str,
        r: usize,
        c: usize,
        options: &[String],
    ) -> String {
        let items: String = options
            .iter()
            .map(|opt| {
                let safe = Self::escape(opt);
                format!(
                    r#"<div class="hs-dropdown-item"
             hx-put="/api/grid/cell"
             hx-vals='{{"row_id": "{}", "{}": "{}"}}'
             @click="open = false">{}</div>"#,
                    row_id, col_name, safe, safe
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        format!(
            r#"<td class="hs-cell hs-cell-dropdown" data-row="{}" data-col="{}"
    :class="isFocused({}, {}) ? 'hs-focused' : ''"
    @click="focusCell({}, {}, false)"
    x-data="{{ open: false }}">
    <div @click="open = !open" class="hs-dropdown-trigger">
        <span>{}</span>
        <span class="hs-dropdown-arrow">▼</span>
    </div>
    <div class="hs-dropdown-menu" x-show="open" @click.away="open = false" x-transition>
        {}
    </div>
</td>"#,
            r, c, r, c, r, c, value, items
        )
    }

    fn render_checklist_cell(
        &self,
        row_id: &str,
        col_name: &str,
        r: usize,
        c: usize,
        items: &[ChecklistItem],
    ) -> String {
        let checkboxes: String = items
            .iter()
            .map(|item| {
                let checked = if item.done { "checked" } else { "" };
                let safe_id = Self::escape(&item.id);
                let safe_label = Self::escape(&item.label);
                format!(
                    r#"<label><input type="checkbox" {}
          hx-put="/api/grid/task" hx-trigger="click"
          hx-vals='{{"row_id": "{}", "task_id": "{}"}}'> {}</label>"#,
                    checked, row_id, safe_id, safe_label
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        format!(
            r#"<td class="hs-cell" data-row="{}" data-col="{}"
    :class="isFocused({}, {}) ? 'hs-focused' : ''"
    @click="focusCell({}, {}, false)">
    <div class="hs-checklist">{}</div>
</td>"#,
            r, c, r, c, r, c, checkboxes
        )
    }

    /// Render the table header
    pub fn render_header(&self) -> String {
        let mut html = String::from(r#"<thead><tr class="hs-header"><th class="hs-cell hs-w-10"></th>"#);
        for (idx, col) in self.columns.iter().enumerate() {
            let label = if col.label.is_empty() {
                Self::escape(&col.name)
            } else {
                Self::escape(&col.label)
            };
            html.push_str(&format!(
                r#"<th class="hs-cell hs-sort-btn" @click="toggleSort({})">{} <span class="hs-sort-icon">↕</span></th>"#,
                idx, label
            ));
        }
        html.push_str("</tr></thead>");
        html
    }

    /// Render the table body
    pub fn render_body(&self) -> String {
        let mut html =
            String::from(r#"<tbody hx-post="/api/grid/reorder" hx-trigger="row-reordered">"#);
        for (r_idx, row) in self.rows.iter().enumerate() {
            let row_id = Self::escape(row.get("id").unwrap_or(&r_idx.to_string()));
            html.push_str(&format!(r#"<tr class="hs-row" data-id="{}">"#, row_id));
            html.push_str(r#"<td class="hs-cell hs-drag-handle">⋮⋮</td>"#);
            for (c_idx, col) in self.columns.iter().enumerate() {
                let val = row.get(&col.name).cloned().unwrap_or_default();
                html.push_str(&self.render_cell(&row_id, &col.name, &val, r_idx, c_idx, &col.cell_type));
            }
            html.push_str("</tr>");
        }
        html.push_str("</tbody>");
        html
    }

    /// Render the complete grid
    pub fn render(&self) -> String {
        let config = serde_json::json!({
            "rows": self.rows.len(),
            "cols": self.columns.len(),
            "sortable": true,
        });
        format!(
            r#"<div x-data="Hypersheet({})" @keydown.window="handleKey($event)" class="hs-overflow-auto">
    <table class="hs-grid hs-border-collapse">
        {}
        {}
    </table>
</div>"#,
            config.to_string(),
            self.render_header(),
            self.render_body(),
        )
    }

    /// Render just the <tbody> fragment (for htmx partial swaps)
    pub fn render_body_fragment(&self) -> String {
        self.render_body()
    }

    /// Render just the <thead> fragment
    pub fn render_header_fragment(&self) -> String {
        self.render_header()
    }
}
