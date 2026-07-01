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
  //  StaticProvider  — inline data
  // -----------------------------------------------------------------------
  class StaticProvider extends BaseProvider {
    constructor(config) {
      super(config);
      this.items = config.items || [];
    }

    async fetch() { return { success: true, items: this.items }; }
  }

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
  //  ProviderRegistry
  // -----------------------------------------------------------------------
  class ProviderRegistry {
    constructor() {
      this._providers = {};
      this._factories = {};
      this._configLayers = [];
      this._globalProviders = {};

      // Register built-in provider types
      this.register('static', function (c) { return new StaticProvider(c); });
      this.register('memory', function (c) { return new MemoryProvider(c); });
      this.register('config', function (c) { return new ConfigProvider(c); });
      this.register('json', function (c) { return new JsonProvider(c); });
      this.register('api', function (c) { return new ApiProvider(c); });
      this.register('database', function (c) { return new DatabaseProvider(c); });
    }

    register(type, factory) {
      this._factories[type] = factory;
      return this;
    }

    create(config) {
      var type = config.type || 'static';
      if (!this._factories[type]) {
        console.warn('[Providers] Unknown type "' + type + '", falling back to static');
        return new StaticProvider(config);
      }
      return this._factories[type](config);
    }

    resolve(columnConfig) {
      if (!columnConfig.provider) {
        return new StaticProvider({ id: columnConfig.field, items: columnConfig.options || [] });
      }
      var providerConfig = typeof columnConfig.provider === 'string'
        ? this._globalProviders[columnConfig.provider]
        : columnConfig.provider;
      if (!providerConfig) {
        console.warn('[Providers] No provider config for "' + columnConfig.field + '", using static');
        return new StaticProvider({ id: columnConfig.field, items: columnConfig.options || [] });
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
    StaticProvider: StaticProvider,
    MemoryProvider: MemoryProvider,
    ConfigProvider: ConfigProvider,
    JsonProvider: JsonProvider,
    ApiProvider: ApiProvider,
    DatabaseProvider: DatabaseProvider,
    ProviderRegistry: ProviderRegistry,
    registry: registry
  };
});