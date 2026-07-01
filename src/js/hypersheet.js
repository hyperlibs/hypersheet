/**
 * Hypersheet - Alpine.js Plugin
 * Spreadsheet-like keyboard navigation, inline editing, cell formatting.
 * Requires Alpine.js 3.x and SortableJS (optional, for drag-reorder).
 *
 * Keybindings:
 *   Arrow keys          Navigate cells
 *   Enter               Toggle edit mode on focused cell
 *   Shift+Enter         Insert row below current row
 *   Ctrl+Enter          Force save / sync (dispatches 'grid-save' event)
 *   Escape              Exit edit mode
 *   Tab / Shift+Tab     Next / previous cell (enters edit)
 *   Backspace           Clear cell content (prompt if configured)
 *   Ctrl+Backspace      Clear entire row (prompt if configured)
 *   Alt+Enter           Highlight cell (cycles color)
 *   Alt+Backspace       Reset cell to default color
 *   Ctrl+B              Toggle bold on cell
 *   Ctrl+U              Toggle underline on cell
 *   Ctrl+Alt+Backspace  Reset all formatting on cell
 *   Home / End          First / last column
 *   Space               Toggle checkbox in focused cell
 *
 * Usage:
 *   <div x-data="hypersheet({ rows: 10, cols: 5, sortable: true })"
 *        @keydown.window="handleKey($event)">
 *     <table class="hg-grid">...</table>
 *   </div>
 *
 * To receive callbacks from grid actions, listen for custom events:
 *   @grid-save          Fired on Ctrl+Enter with { row, col }
 *   @grid-insert-row    Fired on Shift+Enter with { afterRow }
 *   @grid-clear-cell    Fired on Backspace with { row, col }
 *   @grid-clear-row     Fired on Ctrl+Backspace with { row }
 *   @grid-cell-format   Fired on format change with { row, col, formats }
 *   @row-reordered      Fired after SortableJS drag
 *   @grid-sort          Fired on column header click
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('hypersheet', (config = {}) => ({
    // --- Core State ---
    activeRow: config.initialRow || 0,
    activeCol: config.initialCol || 0,
    focusedKey: (config.initialRow || 0) + ':' + (config.initialCol || 0),
    editMode: false,
    maxRows: config.rows || 0,
    maxCols: config.cols || 0,
    sortable: config.sortable || false,
    sortCol: config.sortCol || null,
    sortAsc: config.sortAsc !== undefined ? config.sortAsc : true,

    // --- Column Definitions ---
    // Array of { field, title, type, options, provider }
    // When provider is set, options are resolved dynamically
    columns: config.columns || [],

    // --- Cell Formatting ---
    // Stored as "row:col" -> { bold, underline, highlight }
    cellFormats: {},

    // --- Prompt Configuration ---
    promptOnClear: config.promptOnClear !== undefined ? config.promptOnClear : false,
    promptOnClearRow: config.promptOnClearRow !== undefined ? config.promptOnClearRow : true,

    // --- Schema Engine ---
    _schema: null,
    _userRoles: [],

    // --- Provider System ---
    _registry: null,
    _columnProviders: {},

    // --- Validation State ---
    validationErrors: [],

    // --- Init ---
    init() {
      this.$watch('activeRow', () => this._updateFocusedKey());
      this.$watch('activeCol', () => this._updateFocusedKey());

      // Resolve user roles from data attribute
      this._userRoles = ((document.body && document.body.dataset.roles) || '').split(',').map(function (r) { return r.trim(); }).filter(Boolean);

      // Resolve schema if schema engine is available
      if (typeof HypersheetSchema !== 'undefined') {
        var schemaConfig = config.schema || config;
        this._schema = HypersheetSchema.resolveSchema(schemaConfig, null, this._userRoles);
        // Apply defaults from schema
        if (this._schema.columns.length > 0) {
          this.columns = this._schema.columns;
        }
        // Register providers from schema
        if (this._schema.providers && typeof HypersheetProviders !== 'undefined') {
          var reg = HypersheetProviders.registry;
          Object.keys(this._schema.providers).forEach(function (name) {
            reg.define(name, this._schema.providers[name]);
          }.bind(this));
        }
      }

      // Wire up provider registry if available
      if (typeof HypersheetProviders !== 'undefined') {
        if (!this._registry) this._registry = HypersheetProviders.registry;
        if (config.providers) {
          Object.keys(config.providers).forEach(function (name) {
            this._registry.define(name, config.providers[name]);
          }.bind(this));
        }
        if (config.globalProviders) {
          var reg = this._registry;
          Object.keys(config.globalProviders).forEach(function (name) {
            reg.define(name, config.globalProviders[name]);
          });
        }
        // Init column providers
        this.columns.forEach(function (col, i) {
          this._columnProviders[i] = null;
          if (col.provider) this._loadColumnOptions(i);
        }.bind(this));
      }

      if (this.sortable && window.Sortable) {
        const tbody = this.$el.querySelector('tbody');
        if (tbody) {
          new Sortable(tbody, {
            handle: '.hg-drag-handle',
            animation: 150,
            ghostClass: 'hg-opacity-40',
            onEnd: (evt) => {
              this._emit('row-reordered', {
                from: evt.oldIndex,
                to: evt.newIndex
              });
            }
          });
        }
      }
    },

    // --- Provider Integration ---
    getColumn(col) {
      return this.columns[col] || null;
    },

    getColumnOptions(col) {
      var colDef = this.columns[col];
      if (!colDef) return [];
      // If provider was resolved, return cached options
      if (colDef.provider && this._columnProviders[col]) {
        var provider = this._columnProviders[col];
        if (provider._resolved) return provider._resolved;
        return colDef.options || [];
      }
      return colDef.options || [];
    },

    _loadColumnOptions(col) {
      var colDef = this.columns[col];
      if (!colDef || !colDef.provider || !this._registry) return;
      var provider = this._registry.resolve(colDef);
      this._columnProviders[col] = provider;
      provider.fetch().then(function (result) {
        if (result.success) {
          provider._resolved = result.items;
          // Trigger Alpine reactivity by reassigning
          this.columns = this.columns.slice();
        }
      }.bind(this)).catch(function () {});
    },

    reloadProvider(col) {
      if (this._columnProviders[col]) {
        this._columnProviders[col]._cache = null;
        this._columnProviders[col]._resolved = null;
        this._loadColumnOptions(col);
      }
    },

    reloadAllProviders() {
      this.columns.forEach(function (col, i) { this.reloadProvider(i); }.bind(this));
    },

    getColumnProvider(col) {
      return this._columnProviders[col] || null;
    },

    // --- Validation ---
    validateCell(row, col) {
      var colDef = this.columns[col];
      if (!colDef || typeof HypersheetSchema === 'undefined') return [];
      var val = this.getCellValue(row, col);
      var errors = HypersheetSchema.validateCell(val, colDef, this._dataRows ? this._dataRows : null);
      this.validationErrors = this.validationErrors.filter(function (e) { return e.row !== row || e.field !== colDef.field; });
      errors.forEach(function (e) { e.row = row; this.validationErrors.push(e); }.bind(this));
      return errors;
    },

    validateRow(row) {
      var allErrors = [];
      this.columns.forEach(function (col, c) {
        var errs = this.validateCell(row, c);
        allErrors = allErrors.concat(errs);
      }.bind(this));
      return allErrors;
    },

    validateGrid() {
      if (typeof HypersheetSchema === 'undefined') return [];
      var allRows = this._dataRows || [];
      var errors = HypersheetSchema.validateGrid(allRows, this.columns);
      this.validationErrors = errors;
      return errors;
    },

    getColumnErrors(col) {
      var colDef = this.columns[col];
      if (!colDef) return [];
      return this.validationErrors.filter(function (e) { return e.field === colDef.field; });
    },

    clearValidation() {
      this.validationErrors = [];
    },

    // --- Visibility ---
    getVisibleColumns() {
      if (typeof HypersheetSchema === 'undefined') return this.columns;
      return HypersheetSchema.filterVisibleColumns(this.columns, this._userRoles);
    },

    isColumnVisible(col) {
      var colDef = this.columns[col];
      if (!colDef) return true;
      if (typeof HypersheetSchema === 'undefined') return true;
      return HypersheetSchema.isVisible(colDef, this._userRoles);
    },

    columnCount() {
      return this.getVisibleColumns().length;
    },

    // --- Layout ---
    getColumnWidth(col) {
      var colDef = this.columns[col];
      if (!colDef) return null;
      if (typeof HypersheetSchema !== 'undefined') {
        var layout = HypersheetSchema.getLayout(colDef);
        return layout.width;
      }
      return colDef.width || null;
    },

    getColumnAlign(col) {
      var colDef = this.columns[col];
      if (!colDef) return 'left';
      if (typeof HypersheetSchema !== 'undefined') {
        var layout = HypersheetSchema.getLayout(colDef);
        return layout.align;
      }
      return colDef.align || 'left';
    },

    isColumnFrozen(col) {
      var colDef = this.columns[col];
      if (!colDef) return false;
      if (typeof HypersheetSchema !== 'undefined') {
        var layout = HypersheetSchema.getLayout(colDef);
        return layout.frozen;
      }
      return colDef.frozen || false;
    },

    // --- Default Values ---
    getDefaultValue(col) {
      var colDef = this.columns[col];
      if (!colDef) return '';
      if (typeof HypersheetSchema !== 'undefined') {
        return HypersheetSchema.resolveDefault(colDef.default, colDef,
          (typeof HypersheetProviders !== 'undefined') ? HypersheetProviders.registry : null);
      }
      return colDef.default || '';
    },

    applyDefaults(row) {
      this.columns.forEach(function (col, c) {
        if (row[col.field] === undefined || row[col.field] === null || row[col.field] === '') {
          row[col.field] = this.getDefaultValue(c);
        }
      }.bind(this));
      return row;
    },

    // --- Reactive cell focus check (for Alpine templates) ---
    // Use: :class="focusedKey === rIdx + ':0' ? 'hg-focused' : ''"
    // Instead of: :class="isFocused(rIdx, 0) ? 'hg-focused' : ''" (NOT reactive!)

    // --- Cell Focus ---
    focusCell(r, c, locked = false) {
      if (locked) return;
      this.activeRow = r;
      this.activeCol = c;
      this.focusedKey = r + ':' + c;
      this.editMode = false;
    },

    _updateFocusedKey() {
      this.focusedKey = this.activeRow + ':' + this.activeCol;
    },

    isFocused(r, c) {
      return this.activeRow === r && this.activeCol === c;
    },

    // --- Edit Mode ---
    enterEdit() {
      if (this.editMode) {
        // Already editing — save and exit
        this.exitEdit();
        return;
      }
      this.editMode = true;
      this.$nextTick(() => {
        const input = this.$el.querySelector(
          `[data-row="${this.activeRow}"][data-col="${this.activeCol}"] input, ` +
          `[data-row="${this.activeRow}"][data-col="${this.activeCol}"] .hg-cell-input`
        );
        if (input) {
          input.focus();
          // Place cursor at end of text
          if (input.type === 'text' || input.type === 'email') {
            const len = input.value.length;
            input.setSelectionRange(len, len);
          }
        }
      });
    },

    exitEdit() {
      this.editMode = false;
      this.$el.querySelector('.hg-cell-input:focus')?.blur();
    },

    // --- Cell Value Access ---
    getCellValue(row, col) {
      const input = this.$el.querySelector(
        `[data-row="${row}"][data-col="${col}"] .hg-cell-input`
      );
      return input ? input.value : '';
    },

    setCellValue(row, col, value) {
      const input = this.$el.querySelector(
        `[data-row="${row}"][data-col="${col}"] .hg-cell-input`
      );
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Run validation
      this.validateCell(row, col);
      // Emit cell changed hook
      this._emit('cellChanged', { row: row, col: col, value: value, field: this.columns[col] ? this.columns[col].field : null });
    },

    // --- Cell Formatting ---
    _cellKey(row, col) {
      return `${row}:${col}`;
    },

    getCellFormat(row, col) {
      return this.cellFormats[this._cellKey(row, col)] || {};
    },

    setCellFormat(row, col, format) {
      const key = this._cellKey(row, col);
      this.cellFormats[key] = { ...this.cellFormats[key], ...format };
      // Apply to DOM
      const cell = this.$el.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (cell) {
        if (format.bold) cell.style.fontWeight = 'bold';
        else if (format.bold === false) cell.style.fontWeight = '';
        if (format.underline) cell.style.textDecoration = 'underline';
        else if (format.underline === false) cell.style.textDecoration = '';
        if (format.highlight) cell.style.backgroundColor = format.highlight;
        else if (format.highlight === null) cell.style.backgroundColor = '';
      }
      this._emit('grid-cell-format', { row, col, formats: this.cellFormats[key] });
    },

    resetCellFormat(row, col) {
      const key = this._cellKey(row, col);
      delete this.cellFormats[key];
      const cell = this.$el.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (cell) {
        cell.style.fontWeight = '';
        cell.style.textDecoration = '';
        cell.style.backgroundColor = '';
      }
      this._emit('grid-cell-format', { row, col, formats: {} });
    },

    // --- Clear Operations ---
    clearCell(row, col) {
      if (this.promptOnClear && !confirm('Clear this cell?')) return;
      var data = { row: row, col: col, field: this.columns[col] ? this.columns[col].field : null };
      this._emit('beforeDelete', data);
      if (data._cancelled) return;
      this.setCellValue(row, col, '');
      this._emit('grid-clear-cell', { row, col });
      this._emit('afterDelete', data);
    },

    clearRow(row) {
      if (this.promptOnClearRow && !confirm('Clear entire row?')) return;
      var data = { row: row };
      this._emit('beforeDelete', data);
      if (data._cancelled) return;
      for (let c = 0; c < this.maxCols; c++) {
        this.setCellValue(row, c, '');
      }
      this._emit('grid-clear-row', { row });
      this._emit('afterDelete', data);
    },

    // --- Insert Row ---
    insertRow(afterRow) {
      var data = { afterRow: afterRow };
      this._emit('beforeInsert', data);
      if (data._cancelled) return;
      this._emit('grid-insert-row', { afterRow });
      this._emit('afterInsert', data);
    },

    // --- Save / Sync ---
    forceSave() {
      var data = {
        row: this.activeRow,
        col: this.activeCol,
        value: this.getCellValue(this.activeRow, this.activeCol)
      };
      this._emit('beforeSave', data);
      if (data._cancelled) return;
      this._emit('grid-save', data);
      this._emit('afterSave', data);
    },

    // --- Highlight Color Cycle ---
    _highlightColors: ['#fff3cd', '#f8d7da', '#d1e7dd', '#cfe2ff', '#e2d5f8', '#fce4ec'],
    _highlightIndex: {},

    _nextHighlight(row, col) {
      const key = this._cellKey(row, col);
      const current = this._highlightIndex[key];
      if (current === undefined) {
        this._highlightIndex[key] = 0;
        return this._highlightColors[0];
      }
      const next = (current + 1) % this._highlightColors.length;
      this._highlightIndex[key] = next;
      return this._highlightColors[next];
    },

    // --- Keyboard Handler ---
    handleKey(e) {
      const tag = document.activeElement?.tagName || '';
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      const shift = e.shiftKey;

      // --- Modifier+Special combos (check BEFORE navigation) ---

      // Ctrl + Alt + Backspace = Reset all formatting
      if (ctrl && alt && e.key === 'Backspace') {
        e.preventDefault();
        this.resetCellFormat(this.activeRow, this.activeCol);
        return;
      }

      // Ctrl + B = Toggle bold
      if (ctrl && !alt && !shift && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const fmt = this.getCellFormat(this.activeRow, this.activeCol);
        this.setCellFormat(this.activeRow, this.activeCol, { bold: !fmt.bold });
        return;
      }

      // Ctrl + U = Toggle underline
      if (ctrl && !alt && !shift && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        const fmt = this.getCellFormat(this.activeRow, this.activeCol);
        this.setCellFormat(this.activeRow, this.activeCol, { underline: !fmt.underline });
        return;
      }

      // Ctrl + Backspace = Clear row
      if (ctrl && !alt && !shift && e.key === 'Backspace') {
        e.preventDefault();
        this.clearRow(this.activeRow);
        return;
      }

      // Ctrl + Enter = Force save / sync
      if (ctrl && !alt && !shift && e.key === 'Enter') {
        e.preventDefault();
        this.forceSave();
        return;
      }

      // Alt + Enter = Highlight cell
      if (alt && !ctrl && !shift && e.key === 'Enter') {
        e.preventDefault();
        const color = this._nextHighlight(this.activeRow, this.activeCol);
        this.setCellFormat(this.activeRow, this.activeCol, { highlight: color });
        return;
      }

      // Alt + Backspace = Reset cell color
      if (alt && !ctrl && !shift && e.key === 'Backspace') {
        e.preventDefault();
        const key = this._cellKey(this.activeRow, this.activeCol);
        this._highlightIndex[key] = undefined;
        const fmt = this.getCellFormat(this.activeRow, this.activeCol);
        this.setCellFormat(this.activeRow, this.activeCol, { highlight: null });
        return;
      }

      // Shift + Enter = Insert row below
      if (shift && !ctrl && !alt && e.key === 'Enter') {
        e.preventDefault();
        this.insertRow(this.activeRow);
        return;
      }

      // Backspace (no modifier) = Clear cell
      if (!ctrl && !alt && !shift && e.key === 'Backspace') {
        e.preventDefault();
        this.clearCell(this.activeRow, this.activeCol);
        return;
      }

      // --- Don't intercept typing in inputs for navigation keys ---
      if (isInput && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      // --- Navigation & Control ---
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (this.activeRow > 0) this.activeRow--;
          this._updateFocusedKey();
          this.editMode = false;
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (this.activeRow < this.maxRows - 1) this.activeRow++;
          this._updateFocusedKey();
          this.editMode = false;
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (this.activeCol > 0) this.activeCol--;
          this._updateFocusedKey();
          this.editMode = false;
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (this.activeCol < this.maxCols - 1) this.activeCol++;
          this._updateFocusedKey();
          this.editMode = false;
          break;

        case 'Enter':
          // Plain Enter (no modifiers) — handled above for mod-shifted variants
          if (!ctrl && !alt && !shift) {
            e.preventDefault();
            if (isInput) {
              // If in an input, exit edit mode and move down
              this.exitEdit();
              if (this.activeRow < this.maxRows - 1) this.activeRow++;
              this._updateFocusedKey();
            } else {
              this.enterEdit();
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          if (this.editMode) {
            this.exitEdit();
          }
          break;

        case 'Tab':
          if (!isInput) {
            e.preventDefault();
            if (shift) {
              if (this.activeCol > 0) { this.activeCol--; }
              else if (this.activeRow > 0) { this.activeRow--; this.activeCol = this.maxCols - 1; }
            } else {
              if (this.activeCol < this.maxCols - 1) { this.activeCol++; }
              else if (this.activeRow < this.maxRows - 1) { this.activeRow++; this.activeCol = 0; }
            }
            this._updateFocusedKey();
            this.editMode = false;
            this.enterEdit();
          }
          break;

        case 'Home':
          if (!isInput) {
            e.preventDefault();
            this.activeCol = 0;
            this._updateFocusedKey();
            this.editMode = false;
          }
          break;

        case 'End':
          if (!isInput) {
            e.preventDefault();
            this.activeCol = this.maxCols - 1;
            this._updateFocusedKey();
            this.editMode = false;
          }
          break;

        case ' ':
          // Space to toggle checkboxes in checklist cells
          if (!isInput) {
            e.preventDefault();
            const checkbox = this.$el.querySelector(
              `[data-row="${this.activeRow}"][data-col="${this.activeCol}"] input[type="checkbox"]`
            );
            if (checkbox) { checkbox.click(); }
          }
          break;

        case 'Delete':
          // Delete key also clears cell (same as Backspace)
          if (!ctrl && !alt && !shift) {
            e.preventDefault();
            this.clearCell(this.activeRow, this.activeCol);
          }
          break;
      }
    },

    // --- Sorting ---
    toggleSort(colIndex) {
      if (this.sortCol === colIndex) {
        this.sortAsc = !this.sortAsc;
      } else {
        this.sortCol = colIndex;
        this.sortAsc = true;
      }
      this._emit('grid-sort', { col: colIndex, asc: this.sortAsc });
    },

    getSortIcon(colIndex) {
      if (this.sortCol !== colIndex) return '↕';
      return this.sortAsc ? '↑' : '↓';
    },

    isSortedAsc(colIndex) {
      return this.sortCol === colIndex && this.sortAsc;
    },

    isSortedDesc(colIndex) {
      return this.sortCol === colIndex && !this.sortAsc;
    },

    // --- Internal ---
    _emit(event, detail) {
      // Call schema hooks first (can cancel by setting _cancelled)
      if (typeof HypersheetSchema !== 'undefined' && this._schema) {
        HypersheetSchema.emit(event, detail);
        HypersheetSchema.emitAsync(event, detail);
      }
      this.$el.dispatchEvent(new CustomEvent(event, {
        detail: detail,
        bubbles: true,
        cancelable: true,
      }));
    },
  }));
});
