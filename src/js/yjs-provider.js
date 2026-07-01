/**
 * HyperGrid Yjs Conflict Resolution Provider
 *
 * OPTIONAL module — only loads if Yjs is present on the page.
 * Enables real-time collaborative editing with automatic conflict resolution
 * using Yjs CRDT.
 *
 * To enable, add the `data-hypergrid-yjs` attribute to your grid container:
 *
 *   <div x-data="hypergrid(...)"
 *        data-hypergrid-yjs='{"roomName":"grid-123","providerUrl":"ws://localhost:1234"}'>
 *
 * Or import and instantiate manually:
 *
 *   import { HyperGridYjs } from './yjs-provider.js';
 *   const yjs = new HyperGridYjs(gridEl, { providerUrl: 'ws://...' });
 *   yjs.destroy(); // cleanup
 */

const DEFAULTS = {
  /** Unique room/table identifier for Yjs document sync */
  roomName: 'hypergrid',
  /** WebSocket URL for y-websocket provider. null = local-only (no sync) */
  providerUrl: null,
  /** Auto-bind Alpine.js grid data to Yjs document */
  autoBind: true,
  /** Persist cell changes to server on blur */
  saveOnChange: true,
  /** Endpoint for persisting cell changes */
  saveEndpoint: '/api/grid/cell',
  /** User identity for awareness and conflict tracing */
  authority: null,
  /** Yjs document name (defaults to roomName) */
  docName: null,
  /** Whether to log sync events to console */
  debug: false,
};

class HyperGridYjs {
  constructor(gridElement, options = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.grid = gridElement;
    this.doc = null;
    this.map = null;
    this.provider = null;
    this.awareness = null;
    this.boundHandlers = new Map();
    this.connected = false;
    this._destroyed = false;

    // Graceful degradation if Yjs is not loaded
    if (typeof Y === 'undefined') {
      if (this.opts.debug) {
        console.warn('[HyperGrid Yjs] Yjs library not loaded. Skipping CRDT setup.');
      }
      this._emit('yjs-status', { status: 'unavailable' });
      return;
    }

    this._init();
  }

  _init() {
    const docName = this.opts.docName || this.opts.roomName;
    this.doc = new Y.Doc();
    this.map = this.doc.getMap(docName);

    if (this.opts.providerUrl) {
      this._connectProvider();
    }

    // Observe remote changes
    this.map.observeDeep((events, transaction) => {
      if (this._destroyed) return;
      if (transaction.origin === 'local') return;
      this._onRemoteChanges(events);
    });

    if (this.opts.autoBind) {
      this._bindGrid();
    }

    this._emit('yjs-ready', { docName, doc: this.doc });
  }

  _connectProvider() {
    if (typeof WebsocketProvider !== 'undefined') {
      this.provider = new WebsocketProvider(
        this.opts.providerUrl,
        this.opts.roomName,
        this.doc,
        { connect: true }
      );
    } else if (typeof yWebsocketsProvider?.WebsocketProvider !== 'undefined') {
      this.provider = new yWebsocketsProvider.WebsocketProvider(
        this.opts.providerUrl,
        this.opts.roomName,
        this.doc
      );
    } else if (this.opts.debug) {
      console.warn('[HyperGrid Yjs] No provider implementation found. Install y-websocket.');
      return;
    }

    if (!this.provider) return;

    this.provider.on('status', (evt) => {
      this.connected = evt.status === 'connected';
      this._emit('yjs-status', { status: evt.status });
      if (this.opts.debug) {
        console.log(`[HyperGrid Yjs] Provider status: ${evt.status}`);
      }
    });

    this.provider.on('sync', (synced) => {
      if (synced) this._emit('yjs-synced', { synced: true });
    });

    this.awareness = this.provider.awareness;
  }

  _bindGrid() {
    const alpineData = this.grid.__x;
    if (!alpineData) {
      if (!this._destroyed) setTimeout(() => this._bindGrid(), 100);
      return;
    }

    if (this.opts.saveOnChange) {
      this.grid.addEventListener('change', (e) => {
        const input = e.target;
        if (!input.matches('.hg-cell-input')) return;
        const cell = input.closest('[data-row][data-col]');
        if (!cell) return;
        const rowId = cell.closest('tr')?.dataset?.id;
        const colName = input.getAttribute('name');
        const value = input.value;
        if (rowId && colName) {
          this.map.set(`${rowId}:${colName}`, value, 'local');
        }
      });
    }
  }

  _onRemoteChanges(events) {
    for (const event of events) {
      if (event.target !== this.map) continue;
      event.changes.keys.forEach((change, key) => {
        const [rowId, colName] = key.split(':');
        if (!rowId || !colName) return;
        const value = this.map.get(key)?.toString() ?? '';
        const input = this.grid.querySelector(
          `tr[data-id="${CSS.escape(rowId)}"] .hg-cell-input[name="${CSS.escape(colName)}"]`
        );
        if (input) {
          input.value = value;
          input.dispatchEvent(new CustomEvent('yjs-update', {
            detail: { rowId, colName, value }
          }));
        }
      });
    }
  }

  /** Get a cell value from Yjs shared doc */
  getCell(rowId, colName) {
    return this.map?.get(`${rowId}:${colName}`)?.toString() ?? null;
  }

  /** Set a cell value via Yjs (propagated to all peers) */
  setCell(rowId, colName, value) {
    this.map?.set(`${rowId}:${colName}`, value, 'local');
  }

  /** Get all grid data as { rowId: { colName: value } } */
  getSnapshot() {
    const snap = {};
    this.map?.forEach((value, key) => {
      const [rowId, colName] = key.split(':');
      if (!snap[rowId]) snap[rowId] = {};
      snap[rowId][colName] = value?.toString() ?? '';
    });
    return snap;
  }

  /** Set user awareness info (name, color, cursor position, etc.) */
  setUserInfo(info) {
    if (this.awareness) {
      this.awareness.setLocalStateField('user', info);
    }
  }

  /** Get awareness API for cursor/share presence */
  getAwareness() {
    return this.awareness;
  }

  _emit(event, detail) {
    this.grid?.dispatchEvent(new CustomEvent(event, { detail }));
  }

  /** Cleanup — call on unmount */
  destroy() {
    this._destroyed = true;
    this.provider?.disconnect();
    this.doc?.destroy();
    this.boundHandlers.clear();
    this.doc = null;
    this.map = null;
    this.provider = null;
  }
}

// Auto-init from data attribute (opt-in)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-hypergrid-yjs]').forEach((el) => {
    try {
      const opts = JSON.parse(el.dataset.hypergridYjs || '{}');
      el._hypergridYjs = new HyperGridYjs(el, opts);
    } catch (e) {
      console.error('[HyperGrid Yjs] Init error:', e);
    }
  });
});

export { HyperGridYjs };
