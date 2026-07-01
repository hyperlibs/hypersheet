"""
Hypersheet Jinja3 Engine

Jinja3-specific implementation using:
  - @pass_context (not legacy @contextfilter)
  - markupsafe.Markup (not jinja2.Markup)
  - No legacy extensions (jinja2.ext.autoescape etc.)
"""

import json
from markupsafe import Markup, escape
from jinja2 import pass_context


class HypersheetJinjaEngine:
    """Hypersheet rendering engine for Jinja3 environments.

    Register via env.globals["Hypersheet_cell"] = engine.render_cell

    Casbin authorization is optional. If no enforcer is provided,
    all cells are rendered as editable.

    Args:
        casbin_enforcer: Optional Casbin enforcer instance.
        logger: Optional CasbinLogger instance for audit logging.
    """

    def __init__(self, casbin_enforcer=None, logger=None):
        self.enforcer = casbin_enforcer
        self.logger = logger

    def can_access(self, user_id, col_name, action):
        if not self.enforcer:
            return True
        granted = self.enforcer.enforce(user_id, f"column:{col_name}", action)
        if self.logger:
            self.logger.log_cell_access(user_id, col_name, action, granted)
        return granted

    @pass_context
    def render_cell(self, context, row_id, col_name, current_value,
                    r_idx, c_idx, cell_type="text", options=None):
        """Render a single grid cell with Casbin authorization.

        Called from Jinja3 templates as:
            {{ Hypersheet_cell(row.id, "name", row.name, r_idx, 0, cell_type="text") }}
        """
        if options is None:
            options = []

        user_id = context.get("user_id", "anonymous")

        can_read = self.can_access(user_id, col_name, "read")
        can_write = self.can_access(user_id, col_name, "write")

        # Hidden — no read access
        if not can_read:
            return Markup(
                '<td class="hg-cell hg-hidden">🔒 Hidden</td>'
            )

        safe_value = escape(str(current_value))

        # Read-only — no write access (locked)
        if not can_write:
            return Markup(
                f'<td class="hg-cell hg-locked" title="Locked via Casbin">🔒 {safe_value}</td>'
            )

        # Write allowed — render by type
        if cell_type == "chip":
            return self._render_chip(row_id, col_name, safe_value, r_idx, c_idx)
        elif cell_type == "dropdown":
            return self._render_dropdown(row_id, col_name, safe_value, r_idx, c_idx, options)
        elif cell_type == "checklist":
            return self._render_checklist(row_id, col_name, options, r_idx, c_idx)
        else:
            return self._render_text(row_id, col_name, safe_value, r_idx, c_idx)

    def _render_text(self, row_id, col_name, value, r, c):
        html = f"""
<td class="hg-cell hg-cell-text" data-row="{r}" data-col="{c}"
    :class="isFocused({r}, {c}) ? 'hg-focused' : ''"
    @click="focusCell({r}, {c}, false)">
    <input type="text" value="{value}" class="hg-cell-input"
           hx-put="/api/grid/cell" hx-trigger="blur"
           name="{col_name}" hx-vals='{{"row_id": "{row_id}"}}'>
</td>"""
        return Markup(html)

    def _render_chip(self, row_id, col_name, value, r, c):
        lower = value.lower() if hasattr(value, 'lower') else str(value).lower()
        chip_map = {
            "active": "hg-chip-active",
            "paused": "hg-chip-pending",
            "pending": "hg-chip-pending",
            "archived": "hg-chip-archived",
            "inactive": "hg-chip-archived",
        }
        chip_class = chip_map.get(lower, "hg-chip-gray")
        html = f"""
<td class="hg-cell hg-cell-chip" data-row="{r}" data-col="{c}"
    :class="isFocused({r}, {c}) ? 'hg-focused' : ''"
    @click="focusCell({r}, {c}, false)"
    x-data="{{ open: false }}">
    <div @click="open = !open" class="hg-cursor-pointer hg-select-none">
        <span class="hg-chip {chip_class}">{value}</span>
    </div>
    <div class="hg-chip-menu" x-show="open" @click.away="open = false" x-transition>
        <div class="hg-chip-option"
             hx-put="/api/grid/cell"
             hx-vals='{{"row_id": "{row_id}", "{col_name}": "Active"}}'
             @click="open = false">Active</div>
        <div class="hg-chip-option"
             hx-put="/api/grid/cell"
             hx-vals='{{"row_id": "{row_id}", "{col_name}": "Paused"}}'
             @click="open = false">Paused</div>
        <div class="hg-chip-option"
             hx-put="/api/grid/cell"
             hx-vals='{{"row_id": "{row_id}", "{col_name}": "Archived"}}'
             @click="open = false">Archived</div>
    </div>
</td>"""
        return Markup(html)

    def _render_dropdown(self, row_id, col_name, value, r, c, options):
        items = ""
        for opt in options:
            safe_opt = escape(str(opt))
            items += f"""
        <div class="hg-dropdown-item"
             hx-put="/api/grid/cell"
             hx-vals='{{"row_id": "{row_id}", "{col_name}": "{safe_opt}"}}'
             @click="open = false">{safe_opt}</div>"""
        html = f"""
<td class="hg-cell hg-cell-dropdown" data-row="{r}" data-col="{c}"
    :class="isFocused({r}, {c}) ? 'hg-focused' : ''"
    @click="focusCell({r}, {c}, false)"
    x-data="{{ open: false }}">
    <div @click="open = !open" class="hg-dropdown-trigger">
        <span>{value}</span>
        <span class="hg-dropdown-arrow">▼</span>
    </div>
    <div class="hg-dropdown-menu" x-show="open" @click.away="open = false" x-transition>
        {items}
    </div>
</td>"""
        return Markup(html)

    def _render_checklist(self, row_id, col_name, tasks, r, c):
        items = ""
        for task in tasks:
            task_label = escape(str(task.get("label", task)) if isinstance(task, dict) else str(task))
            task_id = escape(str(task.get("id", task)) if isinstance(task, dict) else str(task))
            done = 'checked' if isinstance(task, dict) and task.get("done") else ''
            items += f"""
        <label><input type="checkbox" {done}
              hx-put="/api/grid/task" hx-trigger="click"
              hx-vals='{{"row_id": "{row_id}", "task_id": "{task_id}"}}'> {task_label}</label>"""
        html = f"""
<td class="hg-cell" data-row="{r}" data-col="{c}"
    :class="isFocused({r}, {c}) ? 'hg-focused' : ''"
    @click="focusCell({r}, {c}, false)">
    <div class="hg-checklist">{items}</div>
</td>"""
        return Markup(html)

    def render_grid(self, context, columns, rows):
        """Render a complete grid table. Callable from Jinja3 as Hypersheet_render_grid.

        Args:
            context: Jinja3 context (injected via @pass_context)
            columns: List of dicts with keys: name, label, type, options
            rows: List of dicts keyed by column name
        """
        grid_html = '<div x-data="Hypersheet({rows: '
        grid_html += str(len(rows))
        grid_html += ', cols: '
        grid_html += str(len(columns))
        grid_html += ', sortable: true'
        grid_html += '})" @keydown.window="handleKey($event)" class="hg-overflow-auto">'
        grid_html += '<table class="hg-grid hg-border-collapse">'

        # Header
        grid_html += '<thead><tr class="hg-header">'
        grid_html += '<th class="hg-cell hg-w-10"></th>'
        for idx, col in enumerate(columns):
            label = escape(str(col.get("label", col.get("name", ""))))
            grid_html += f'<th class="hg-cell hg-sort-btn" @click="toggleSort({idx})">{label} <span class="hg-sort-icon">↕</span></th>'
        grid_html += '</tr></thead>'

        # Body
        grid_html += '<tbody hx-post="/api/grid/reorder" hx-trigger="row-reordered">'
        for r_idx, row in enumerate(rows):
            row_id = escape(str(row.get("id", r_idx)))
            grid_html += f'<tr class="hg-row" data-id="{row_id}">'
            grid_html += '<td class="hg-cell hg-drag-handle">⋮⋮</td>'
            for c_idx, col in enumerate(columns):
                col_name = col.get("name", f"col_{c_idx}")
                cell_type = col.get("type", "text")
                options = col.get("options", [])
                value = row.get(col_name, "")
                cell_html = self.render_cell.__wrapped__(
                    self, context, row_id, col_name, value,
                    r_idx, c_idx, cell_type=cell_type, options=options
                )
                grid_html += str(cell_html)
            grid_html += '</tr>'
        grid_html += '</tbody></table></div>'

        return Markup(grid_html)

    def render_grid_header(self, columns):
        """Render just the <thead> fragment (for htmx partial swaps)."""
        html = '<thead><tr class="hg-header">'
        html += '<th class="hg-cell hg-w-10"></th>'
        for idx, col in enumerate(columns):
            label = escape(str(col.get("label", col.get("name", ""))))
            html += f'<th class="hg-cell hg-sort-btn" @click="toggleSort({idx})">{label} <span class="hg-sort-icon">↕</span></th>'
        html += '</tr></thead>'
        return Markup(html)

    def render_grid_body(self, context, columns, rows):
        """Render just the <tbody> fragment (for htmx partial swaps)."""
        html = '<tbody hx-post="/api/grid/reorder" hx-trigger="row-reordered">'
        for r_idx, row in enumerate(rows):
            row_id = escape(str(row.get("id", r_idx)))
            html += f'<tr class="hg-row" data-id="{row_id}">'
            html += '<td class="hg-cell hg-drag-handle">⋮⋮</td>'
            for c_idx, col in enumerate(columns):
                col_name = col.get("name", f"col_{c_idx}")
                cell_type = col.get("type", "text")
                options = col.get("options", [])
                value = row.get(col_name, "")
                cell_html = self.render_cell.__wrapped__(
                    self, context, row_id, col_name, value,
                    r_idx, c_idx, cell_type=cell_type, options=options
                )
                html += str(cell_html)
            html += '</tr>'
        html += '</tbody>'
        return Markup(html)
