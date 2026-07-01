(function (root, factory) {
  if (typeof define === 'function' && define.amd) define(factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HypersheetSchema = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // -----------------------------------------------------------------------
  //  Dynamic Default Resolvers
  // -----------------------------------------------------------------------
  var BUILTIN_DEFAULTS = {
    'system.now': function () { return new Date().toISOString(); },
    'system.today': function () { return new Date().toISOString().slice(0, 10); },
    'system.uuid': function () { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); },
    'system.timestamp': function () { return Date.now(); },
    'system.user': function () { return (typeof document !== 'undefined' && document.body?.dataset?.user) || 'anonymous'; },
    'provider.currentUser': function () { return (typeof document !== 'undefined' && document.body?.dataset?.user) || 'anonymous'; },
  };

  function resolveDefault(value, colDef, registry) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string' && value.indexOf('system.') === 0) {
      var fn = BUILTIN_DEFAULTS[value];
      return fn ? fn() : value;
    }
    if (typeof value === 'string' && value.indexOf('provider.') === 0) {
      var providerName = value.split('.')[1];
      if (registry && providerName) {
        var provider = registry.resolveGlobal(providerName);
        if (provider) {
          var result = provider.fetch();
          if (result && typeof result.then === 'function') return result.then(function (r) { return r.items?.[0]?.value || ''; });
          return result.items?.[0]?.value || '';
        }
      }
      return '';
    }
    if (typeof value === 'function') return value(colDef);
    return value;
  }

  function registerDefault(name, fn) {
    BUILTIN_DEFAULTS[name] = fn;
  }

  // -----------------------------------------------------------------------
  //  Validation Engine
  // -----------------------------------------------------------------------
  var VALIDATORS = {
    required: function (val, rule, colDef) {
      if (!rule) return null;
      var v = String(val || '').trim();
      return v.length > 0 ? null : { field: colDef.field, rule: 'required', message: rule.message || colDef.title + ' is required' };
    },
    maxLength: function (val, rule, colDef) {
      if (!rule || !val) return null;
      var len = String(val).length;
      return len <= rule ? null : { field: colDef.field, rule: 'maxLength', message: colDef.title + ' exceeds ' + rule + ' characters', max: rule };
    },
    minLength: function (val, rule, colDef) {
      if (!rule || !val) return null;
      var len = String(val).length;
      return len >= rule ? null : { field: colDef.field, rule: 'minLength', message: colDef.title + ' must be at least ' + rule + ' characters', min: rule };
    },
    regex: function (val, rule, colDef) {
      if (!rule || !val) return null;
      var re = typeof rule === 'string' ? new RegExp(rule) : rule;
      return re.test(String(val)) ? null : { field: colDef.field, rule: 'regex', message: colDef.title + ' format is invalid', pattern: rule };
    },
    min: function (val, rule, colDef) {
      if (rule === undefined || rule === null || val === undefined || val === null || val === '') return null;
      var n = Number(val);
      return isNaN(n) || n >= rule ? null : { field: colDef.field, rule: 'min', message: colDef.title + ' must be at least ' + rule, min: rule };
    },
    max: function (val, rule, colDef) {
      if (rule === undefined || rule === null || val === undefined || val === null || val === '') return null;
      var n = Number(val);
      return isNaN(n) || n <= rule ? null : { field: colDef.field, rule: 'max', message: colDef.title + ' must be at most ' + rule, max: rule };
    },
    unique: function (val, rule, colDef, allRows) {
      if (!rule || !val || !allRows) return null;
      var match = allRows.filter(function (r) { return String(r[colDef.field]) === String(val); });
      return match.length <= 1 ? null : { field: colDef.field, rule: 'unique', message: colDef.title + ' must be unique' };
    },
    email: function (val, rule, colDef) {
      if (!rule || !val) return null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val)) ? null : { field: colDef.field, rule: 'email', message: colDef.title + ' must be a valid email' };
    },
    date: function (val, rule, colDef) {
      if (!rule || !val) return null;
      var d = new Date(val);
      return isNaN(d.getTime()) ? { field: colDef.field, rule: 'date', message: colDef.title + ' must be a valid date' } : null;
    },
    minDate: function (val, rule, colDef) {
      if (!rule || !val) return null;
      var d = new Date(val);
      var min = new Date(rule);
      if (isNaN(d.getTime()) || isNaN(min.getTime())) return null;
      return d >= min ? null : { field: colDef.field, rule: 'minDate', message: colDef.title + ' must be on or after ' + rule, minDate: rule };
    },
    maxDate: function (val, rule, colDef) {
      if (!rule || !val) return null;
      var d = new Date(val);
      var max = new Date(rule);
      if (isNaN(d.getTime()) || isNaN(max.getTime())) return null;
      return d <= max ? null : { field: colDef.field, rule: 'maxDate', message: colDef.title + ' must be on or before ' + rule, maxDate: rule };
    },
  };

  function validateCell(val, colDef, allRows) {
    if (!colDef) return [];
    var errors = [];
    Object.keys(VALIDATORS).forEach(function (ruleName) {
      var ruleValue = colDef[ruleName];
      if (ruleValue === undefined || ruleValue === null) return;
      var error = VALIDATORS[ruleName](val, ruleValue, colDef, allRows);
      if (error) errors.push(error);
    });
    return errors;
  }

  function validateRow(row, columns, allRows) {
    var errors = [];
    columns.forEach(function (col) {
      var val = row[col.field];
      var errs = validateCell(val, col, allRows);
      errs.forEach(function (e) { errors.push(e); });
    });
    return errors;
  }

  function validateGrid(rows, columns) {
    var errors = [];
    rows.forEach(function (row, i) {
      var errs = validateRow(row, columns, rows);
      errs.forEach(function (e) { e.row = i; errors.push(e); });
    });
    return errors;
  }

  function registerValidator(name, fn) {
    VALIDATORS[name] = fn;
  }

  // -----------------------------------------------------------------------
  //  Visibility Engine
  // -----------------------------------------------------------------------
  function isVisible(colDef, userRoles) {
    if (!colDef.visible) return true;
    var rules = colDef.visible;
    if (rules.roles && Array.isArray(rules.roles)) {
      if (!userRoles || userRoles.length === 0) return false;
      return rules.roles.some(function (role) { return userRoles.indexOf(role) !== -1; });
    }
    if (rules.if) {
      return !!rules.if;
    }
    if (typeof rules === 'function') return rules();
    return true;
  }

  function filterVisibleColumns(columns, userRoles) {
    return columns.filter(function (col) { return isVisible(col, userRoles); });
  }

  // -----------------------------------------------------------------------
  //  Layout Engine
  // -----------------------------------------------------------------------
  function getLayout(colDef) {
    return Object.assign({
      width: null,
      minWidth: null,
      maxWidth: null,
      align: 'left',
      frozen: false,
      resizable: false,
      hidden: false,
    }, colDef.layout || {});
  }

  // -----------------------------------------------------------------------
  //  Config Loader
  // -----------------------------------------------------------------------
  function deepMerge(target, source) {
    var result = Object.assign({}, target);
    Object.keys(source || {}).forEach(function (key) {
      var tv = target[key];
      var sv = source[key];
      if (Array.isArray(tv) && Array.isArray(sv)) {
        result[key] = sv.slice();
      } else if (tv && typeof tv === 'object' && sv && typeof sv === 'object') {
        result[key] = deepMerge(tv, sv);
      } else {
        result[key] = sv;
      }
    });
    return result;
  }

  var configLayers = [];

  function addConfigLayer(layer) {
    configLayers.push(layer);
  }

  function loadConfig(layers) {
    var merged = {};
    (layers || configLayers).forEach(function (layer) {
      if (typeof layer === 'string') {
        // Lazy: URL string — skip, caller should fetch
        return;
      }
      merged = deepMerge(merged, layer);
    });
    return merged;
  }

  function resolveConfig(field, layers) {
    var cfg = loadConfig(layers || configLayers);
    return cfg.columns ? cfg.columns[field] : null;
  }

  // -----------------------------------------------------------------------
  //  Event Hooks
  // -----------------------------------------------------------------------
  var HOOKS = {};

  function on(event, fn) {
    if (!HOOKS[event]) HOOKS[event] = [];
    HOOKS[event].push(fn);
    return function () {
      HOOKS[event] = (HOOKS[event] || []).filter(function (h) { return h !== fn; });
    };
  }

  function emit(event, data) {
    var handlers = HOOKS[event] || [];
    var results = [];
    handlers.forEach(function (fn) {
      try { results.push(fn(data)); }
      catch (e) { console.warn('[Schema] Hook error:', event, e); }
    });
    return results;
  }

  async function emitAsync(event, data) {
    var handlers = HOOKS[event] || [];
    var results = [];
    for (var i = 0; i < handlers.length; i++) {
      try { results.push(await handlers[i](data)); }
      catch (e) { console.warn('[Schema] Async hook error:', event, e); }
    }
    return results;
  }

  // -----------------------------------------------------------------------
  //  Schema Engine — Full Column Resolver
  // -----------------------------------------------------------------------
  function resolveSchema(schemaConfig, registry, userRoles) {
    var columns = (schemaConfig.columns || []).map(function (col) {
      // Apply defaults from schema-level defaults
      var defaults = schemaConfig.defaults || {};
      var def = defaults[col.field];
      var resolved = {
        field: col.field,
        title: col.title || col.field,
        type: col.type || 'text',
        editable: col.editable !== undefined ? col.editable : true,
        required: col.required || false,
        default: def !== undefined ? def : col.default,
        provider: col.provider || null,
        visible: col.visible || null,
        layout: col.layout || null,
        maxLength: col.maxLength || null,
        minLength: col.minLength || null,
        regex: col.regex || null,
        min: col.min !== undefined ? col.min : null,
        max: col.max !== undefined ? col.max : null,
        unique: col.unique || false,
        email: col.email || false,
        options: col.options || [],
        width: col.width || null,
        align: col.align || 'left',
        frozen: col.frozen || false,
      };
      return resolved;
    });

    return {
      columns: columns,
      visibleColumns: userRoles ? filterVisibleColumns(columns, userRoles) : columns,
      providers: schemaConfig.providers || {},
      hooks: schemaConfig.hooks || {},
      defaults: schemaConfig.defaults || {},
    };
  }

  // -----------------------------------------------------------------------
  //  Public API
  // -----------------------------------------------------------------------
  return {
    // Schema
    resolveSchema: resolveSchema,
    resolveDefault: resolveDefault,
    registerDefault: registerDefault,

    // Validation
    validateCell: validateCell,
    validateRow: validateRow,
    validateGrid: validateGrid,
    registerValidator: registerValidator,

    // Visibility
    isVisible: isVisible,
    filterVisibleColumns: filterVisibleColumns,

    // Layout
    getLayout: getLayout,

    // Config
    deepMerge: deepMerge,
    addConfigLayer: addConfigLayer,
    loadConfig: loadConfig,
    resolveConfig: resolveConfig,

    // Events
    on: on,
    emit: emit,
    emitAsync: emitAsync,
    HOOKS: HOOKS,

    // Built-in defaults
    BUILTIN_DEFAULTS: BUILTIN_DEFAULTS,
  };
});