(function (root, factory) {
  if (typeof define === 'function' && define.amd) define(factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HypersheetProviders = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // -----------------------------------------------------------------------
  //  BaseProvider
  // -----------------------------------------------------------------------
  class BaseProvider {
    constructor(config = {}) {
      this.id = config.id || config.field || 'anonymous';
      this.type = config.type || 'static';
      this.cacheTTL = config.cacheTTL || 0;
      this._cache = null;
      this._cacheTime = 0;
      this._watchers = [];
    }

    async fetch(params) {
      throw new Error(`Provider "${this.id}" must implement fetch()`);
    }

    async get(value, params) {
      const result = await this.fetch(params);
      if (!result.success) return null;
      return result.items.find(function (i) { return String(i.value) === String(value); }) || null;
    }

    async labels(values, params) {
      const result = await this.fetch(params);
      if (!result.success) return [];
      var map = {};
      result.items.forEach(function (i) { map[String(i.value)] = i.label; });
      return values.map(function (v) { return map[String(v)] || v; });
    }

    async validate(value, params) {
      var item = await this.get(value, params);
      return item !== null;
    }

    watch(fn) {
      this._watchers.push(fn);
      return function () {
        this._watchers = this._watchers.filter(function (w) { return w !== fn; });
      }.bind(this);
    }

    _notify(event, data) {
      this._watchers.forEach(function (fn) { fn(event, data); });
    }

    _checkCache() {
      if (this.cacheTTL > 0 && this._cache && Date.now() - this._cacheTime < this.cacheTTL) {
        return this._cache;
      }
      return null;
    }

    _setCache(data) {
      this._cache = data;
      this._cacheTime = Date.now();
    }

    destroy() {
      this._watchers = [];
      this._cache = null;
    }
  }

  // -----------------------------------------------------------------------
  //  InlineProvider  — inline data (aliased as StaticProvider for compat)
  // -----------------------------------------------------------------------
  class InlineProvider extends BaseProvider {
    constructor(config) {
      super(config);
      this.items = config.items || [];
    }

    async fetch() { return { success: true, items: this.items }; }
  }

  var StaticProvider = InlineProvider;

  // -----------------------------------------------------------------------
  //  MemoryProvider  — mutable runtime data
  // -----------------------------------------------------------------------
  class MemoryProvider extends BaseProvider {
    constructor(config) {
      super(config);
      this.items = (config.items || []).slice();
    }

    async fetch() { return { success: true, items: this.items }; }

    setItems(items) {
      this.items = items.slice();
      this._notify('change', this.items);
    }

    addItem(item) { this.items.push(item); this._notify('change', this.items); }
    removeItem(value) { this.items = this.items.filter(function (i) { return String(i.value) !== String(value); }); this._notify('change', this.items); }
  }

  // -----------------------------------------------------------------------
  //  ConfigProvider  — JSON config file via HTTP
  // -----------------------------------------------------------------------
  class ConfigProvider extends BaseProvider {
    constructor(config) {
      super(config);
      this.source = config.source;
      this._pollInterval = config.pollInterval || 0;
      this._pollTimer = null;
      if (this._pollInterval > 0) this._startPoll();
    }

    async fetch() {
      var cached = this._checkCache();
      if (cached) return cached;
      try {
        var resp = await fetch(this.source);
        var data = await resp.json();
        var result = { success: true, items: data.items || data };
        this._setCache(result);
        return result;
      } catch (e) {
        return { success: false, items: [], error: e.message };
      }
    }

    _startPoll() {
      this._pollTimer = setInterval(function () {
        this._cache = null;
        this.fetch().then(function (result) {
          if (result.success) this._notify('change', result.items);
        }.bind(this));
      }.bind(this), this._pollInterval);
    }

    destroy() {
      if (this._pollTimer) clearInterval(this._pollTimer);
      super.destroy();
    }
  }

  // -----------------------------------------------------------------------
  //  JsonProvider  — static JSON data (same as Config but for embedded data)
  // -----------------------------------------------------------------------
  class JsonProvider extends ConfigProvider {
    constructor(config) {
      super(config);
      this._inlineData = config.data || null;
    }

    async fetch() {
      if (this._inlineData) return { success: true, items: this._inlineData };
      return super.fetch();
    }
  }

  // -----------------------------------------------------------------------
  //  ApiProvider  — generic REST/GraphQL endpoint
  // -----------------------------------------------------------------------
  class ApiProvider extends BaseProvider {
    constructor(config) {
      super(config);
      this.url = config.url;
      this.method = (config.method || 'GET').toUpperCase();
      this.headers = config.headers || {};
      this.body = config.body || null;
      this.responsePath = config.responsePath || 'items';
      this.auth = config.auth || null;
    }

    async fetch(params) {
      var cached = this._checkCache();
      if (cached) return cached;
      try {
        var url = typeof params === 'object' && params ? this._interpolate(this.url, params) : this.url;
        var opts = { method: this.method, headers: Object.assign({ 'Accept': 'application/json' }, this.headers) };
        if (this.auth && this.auth.token) opts.headers['Authorization'] = 'Bearer ' + this.auth.token;
        if (this.body) opts.body = typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
        var resp = await fetch(url, opts);
        var data = await resp.json();
        var items = this._resolvePath(data, this.responsePath);
        var result = { success: true, items: Array.isArray(items) ? items : [] };
        this._setCache(result);
        return result;
      } catch (e) {
        return { success: false, items: [], error: e.message };
      }
    }

    _interpolate(str, params) {
      return str.replace(/\{(\w+)\}/g, function (_, k) { return params[k] !== undefined ? params[k] : _; });
    }

    _resolvePath(obj, path) {
      if (!path || path === 'items') return obj.items || obj;
      return path.split('.').reduce(function (o, p) { return o ? o[p] : undefined; }, obj);
    }
  }

  // -----------------------------------------------------------------------
  //  DatabaseProvider  — backend database via HTTP proxy
  // -----------------------------------------------------------------------
  class DatabaseProvider extends BaseProvider {
    constructor(config) {
      super(config);
      this.endpoint = config.endpoint || '/api/providers/database';
      this.table = config.table;
      this.label = config.label || 'label';
      this.value = config.value || 'value';
      this.where = config.where || null;
    }

    async fetch(params) {
      var cached = this._checkCache();
      if (cached) return cached;
      try {
        var body = JSON.stringify({ table: this.table, label: this.label, value: this.value, where: this.where, params: params || {} });
        var resp = await fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body });
        var data = await resp.json();
        var result = { success: true, items: data.items || data };
        this._setCache(result);
        return result;
      } catch (e) {
        return { success: false, items: [], error: e.message };
      }
    }
  }

  // -----------------------------------------------------------------------
  //  SqlProvider  — SQL database via WebSQL / better-sqlite3 (Electron/Tauri)
  // -----------------------------------------------------------------------
  class SqlProvider extends BaseProvider {
    constructor(config) {
      super(config);
      this.table = config.table;
      this.columns = config.columns || ['id', 'label'];
      this.value = config.value || this.columns[0] || 'id';
      this.label = config.label || this.columns[1] || 'label';
      this.where = config.where || null;
      this.orderBy = config.orderBy || null;
      this.driver = config.driver || 'auto';
      this._db = null;
      this._driverInstance = null;
    }

    async fetch(params) {
      var cached = this._checkCache();
      if (cached) return cached;
      try {
        var items = await this._query(params);
        var result = { success: true, items: items };
        this._setCache(result);
        return result;
      } catch (e) {
        return { success: false, items: [], error: e.message };
      }
    }

    async _query(params) {
      var sql = 'SELECT ' + this.value + ', ' + this.label + ' FROM ' + this._escapeId(this.table);
      var conditions = [];
      var bindings = [];

      if (this.where) {
        Object.keys(this.where).forEach(function (k) {
          conditions.push(this._escapeId(k) + ' = ?');
          bindings.push(this.where[k]);
        }.bind(this));
      }
      if (params) {
        Object.keys(params).forEach(function (k) {
          conditions.push(this._escapeId(k) + ' = ?');
          bindings.push(params[k]);
        }.bind(this));
      }
      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      if (this.orderBy) sql += ' ORDER BY ' + this.orderBy;

      return this._runSql(sql, bindings);
    }

    _runSql(sql, bindings) {
      // Auto-detect environment
      if (this.driver === 'websql' || (this.driver === 'auto' && typeof openDatabase !== 'undefined')) {
        return this._runWebSql(sql, bindings);
      }
      if (this.driver === 'better-sqlite3' || (this.driver === 'auto' && typeof require !== 'undefined')) {
        try {
          var Database = require('better-sqlite3');
          if (!this._db) this._db = new Database(this.table + '.db');
          var stmt = this._db.prepare(sql);
          return bindings.length > 0 ? stmt.all.apply(stmt, bindings) : stmt.all();
        } catch (e) {
          // Fall through to WebSQL if better-sqlite3 fails
        }
      }
      // Fallback — return empty
      return [];
    }

    _runWebSql(sql, bindings) {
      return new Promise(function (resolve, reject) {
        if (!this._db) {
          this._db = openDatabase(this.table + '.db', '1.0', this.table, 2 * 1024 * 1024);
        }
        this._db.transaction(function (tx) {
          tx.executeSql(sql, bindings, function (tx, results) {
            var items = [];
            for (var i = 0; i < results.rows.length; i++) {
              var row = results.rows.item(i);
              items.push({ value: row[this.value], label: row[this.label] });
            }
            resolve(items);
          }.bind(this), function (tx, error) { reject(error); });
        }.bind(this));
      }.bind(this));
    }

    _escapeId(id) { return '"' + String(id).replace(/"/g, '""') + '"'; }

    destroy() {
      if (this._db && typeof this._db.close === 'function') this._db.close();
      super.destroy();
    }
  }

  // -----------------------------------------------------------------------
  //  CsvProvider  — CSV files (HTTP or local in Electron/Tauri)
  // -----------------------------------------------------------------------
  class CsvProvider extends BaseProvider {
    constructor(config) {
      super(config);
      this.source = config.source;
      this.delimiter = config.delimiter || ',';
      this.hasHeader = config.hasHeader !== false;
      this.value = config.value || 'value';
      this.label = config.label || 'label';
      this.valueCol = config.valueCol !== undefined ? config.valueCol : 0;
      this.labelCol = config.labelCol !== undefined ? config.labelCol : 1;
    }

    async fetch(params) {
      var cached = this._checkCache();
      if (cached) return cached;
      try {
        var csvText = await this._loadCsv();
        var items = this._parseCsv(csvText);
        var result = { success: true, items: items };
        this._setCache(result);
        return result;
      } catch (e) {
        return { success: false, items: [], error: e.message };
      }
    }

    async _loadCsv() {
      // HTTP fetch
      if (this.source.indexOf('http://') === 0 || this.source.indexOf('https://') === 0 || this.source.indexOf('/') === 0) {
        var resp = await fetch(this.source);
        return await resp.text();
      }
      // Local file in Electron/Tauri via fs
      try {
        var fs = require('fs');
        return fs.readFileSync(this.source, 'utf-8');
      } catch (e) {
        throw new Error('CsvProvider: cannot read "' + this.source + '" — ' + e.message);
      }
    }

    _parseCsv(text) {
      var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
      var startIdx = this.hasHeader ? 1 : 0;
      var headers = this.hasHeader ? this._splitLine(lines[0]) : null;

      var items = [];
      for (var i = startIdx; i < lines.length; i++) {
        var cols = this._splitLine(lines[i]);
        if (headers) {
          items.push({ value: cols[this.valueCol] || cols[0], label: cols[this.labelCol] || cols[1] || cols[0] });
        } else {
          items.push({ value: cols[0], label: cols[1] || cols[0] });
        }
      }
      return items;
    }

    _splitLine(line) {
      var result = [];
      var current = '';
      var inQuotes = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === this.delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      result.push(current.trim());
      return result;
    }
  }

  // -----------------------------------------------------------------------
  //  ProviderRegistry
  // -----------------------------------------------------------------------
  class ProviderRegistry {
    constructor() {
      this._providers = {};
      this._factories = {};
      this._configLayers = [];
      this._globalProviders = {};

      // Register built-in provider types
      this.register('inline', function (c) { return new InlineProvider(c); });
      this.register('static', function (c) { return new InlineProvider(c); });
      this.register('memory', function (c) { return new MemoryProvider(c); });
      this.register('config', function (c) { return new ConfigProvider(c); });
      this.register('json', function (c) { return new JsonProvider(c); });
      this.register('api', function (c) { return new ApiProvider(c); });
      this.register('database', function (c) { return new DatabaseProvider(c); });
      this.register('sql', function (c) { return new SqlProvider(c); });
      this.register('csv', function (c) { return new CsvProvider(c); });
    }

    register(type, factory) {
      this._factories[type] = factory;
      return this;
    }

    create(config) {
      var type = config.type || 'static';
      if (!this._factories[type]) {
        console.warn('[Providers] Unknown type "' + type + '", falling back to inline');
        return new InlineProvider(config);
      }
      return this._factories[type](config);
    }

    resolve(columnConfig) {
      if (!columnConfig.provider) {
        return new InlineProvider({ id: columnConfig.field, items: columnConfig.options || [] });
      }
      var providerConfig = typeof columnConfig.provider === 'string'
        ? this._globalProviders[columnConfig.provider]
        : columnConfig.provider;
      if (!providerConfig) {
        console.warn('[Providers] No provider config for "' + columnConfig.field + '", using inline');
        return new InlineProvider({ id: columnConfig.field, items: columnConfig.options || [] });
      }
      var provider = this.create(Object.assign({ id: columnConfig.field, field: columnConfig.field }, providerConfig));
      return provider;
    }

    // -- Global named providers -------------------------------------------
    define(name, config) {
      this._globalProviders[name] = config;
      return this;
    }

    getGlobal(name) {
      return this._globalProviders[name] || null;
    }

    resolveGlobal(name) {
      var cfg = this._globalProviders[name];
      if (!cfg) return null;
      return this.create(cfg);
    }

    // -- Layered configuration --------------------------------------------
    addLayer(layer) {
      this._configLayers.push(layer);
      return this;
    }

    resolveConfig(field) {
      for (var i = this._configLayers.length - 1; i >= 0; i--) {
        var layer = this._configLayers[i];
        if (layer.columns && layer.columns[field]) return layer.columns[field];
        if (layer[field]) return layer[field];
      }
      return null;
    }

    // -- Global convenience -----------------------------------------------
    defineGlobal(name, typeOrConfig, options) {
      var config = typeof typeOrConfig === 'string' ? Object.assign({ type: typeOrConfig }, options || {}) : typeOrConfig;
      return this.define(name, config);
    }

    resolveGlobalProvider(name) {
      return this.resolveGlobal(name);
    }
  }

  // Singleton
  var registry = new ProviderRegistry();

  return {
    BaseProvider: BaseProvider,
    InlineProvider: InlineProvider,
    StaticProvider: InlineProvider,
    MemoryProvider: MemoryProvider,
    ConfigProvider: ConfigProvider,
    JsonProvider: JsonProvider,
    ApiProvider: ApiProvider,
    DatabaseProvider: DatabaseProvider,
    SqlProvider: SqlProvider,
    CsvProvider: CsvProvider,
    ProviderRegistry: ProviderRegistry,
    registry: registry
  };
});