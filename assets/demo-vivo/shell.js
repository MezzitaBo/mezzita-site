/* Mezzita · demo vivo · shell.js
   The demo shell of docs/demo-vivo.md §4: top bar, hovering left menu built from the backend's module list, the
   two-pane stage (guest | team) and the phone layout, a pool of named frames (one signed-in seat per role), the
   guide and its recorridos, the ambient timeline, expiry and «Reiniciar».
   Entry point for the wizard (L5): window.MezzitaDemo.open({template, plan, venues, name}). Contract with the
   other lanes: side-session note demo-shell-api.md. */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else {
    var ns = (root.MezzitaDemo = root.MezzitaDemo || {});
    ns.shell = mod;
    ['open', 'resume', 'saved', 'close', 'restart'].forEach(function (k) { ns[k] = mod[k]; });
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  function dep(name, file) {
    if (root.MezzitaDemo && root.MezzitaDemo[name]) return root.MezzitaDemo[name];
    return typeof require === 'function' ? require(file) : null;
  }
  var api = dep('api', './api.js');
  var tours = dep('tours', './tours.js');
  var phoneMod = dep('phone', './phone.js');

  var WA_NUMBER = '59162506518';
  var WIDE = 1100; // two panes at and above this width
  var DUO = 1400; // two team seats side by side
  var STORE = 'mezzita.demo';
  var POOL_TEAM = 3;
  var POOL_GUEST = 2;
  var PLAN_KEYS = ['arranca', 'crece', 'escala', 'nightlife'];
  var LABELS = {
    cafe: 'Restaurante pequeño o café', restaurante: 'Restaurante con salón', pizzeria: 'Pizzería', foodtruck: 'Food truck',
    heladeria: 'Heladería', bar: 'Bar o pub', discoteca: 'Discoteca o boliche', eventos: 'Eventos y productoras',
  };
  var BUILDING = 'Armando tu demo: carta, mesas, ventas del mes, inventario y clientes de ejemplo…';

  var I = {
    whatsapp: '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M8.8 9.2c.3 2.9 3 5.7 6 6l1.2-1.5-1.8-1-1 .9a4 4 0 0 1-2.6-2.6l.9-1-1-1.8z"/>',
    site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
    menu: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
    table: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14h1"/>',
    reserve: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3"/>',
    tickets: '<path d="M3 7h18v3.5a1.5 1.5 0 0 0 0 3V17H3v-3.5a1.5 1.5 0 0 0 0-3z"/><path d="M15 7v2M15 11.5v1M15 15v2"/>',
    entry: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M9 12h6"/><circle cx="7" cy="12" r=".8"/>',
    owner: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
    admin: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18"/>',
    cashier: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3M15 15h2"/>',
    waiter: '<path d="M4 17h16"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M12 10V8M10.5 8h3"/><path d="M6 20h12"/>',
    kitchen: '<path d="M7 14.5a4 4 0 1 1 1.6-7.7 4 4 0 0 1 6.8 0A4 4 0 1 1 17 14.5V20H7z"/><path d="M7 17h10"/>',
    bar: '<path d="M8 3h8l-1 7a3 3 0 0 1-6 0z"/><path d="M12 13v7M8 21h8M8.3 6h7.4"/>',
    door: '<path d="M4 21h16"/><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><circle cx="14.5" cy="12" r="1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  function icon(k) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[k] || '') + '</svg>';
  }

  var GROUPS = [
    { key: 'see', title: 'Lo que ve tu cliente' },
    { key: 'do', title: 'Lo que tu cliente puede hacer' },
    { key: 'team', title: 'Tu equipo y tu sistema' },
  ];
  // guest items: module(s) that gate them and the links they open (docs/demo-vivo.md §4, left menu)
  var GUEST_ITEMS = [
    { key: 'whatsapp', group: 'see', label: 'WhatsApp', module: ['whatsapp'] },
    { key: 'site', group: 'see', label: 'Página web' },
    { key: 'menu', group: 'see', label: 'Menú web', module: ['menu'], link: ['menu'] },
    { key: 'table', group: 'do', label: 'Pedir desde la mesa', module: ['tables'], link: ['table'] },
    { key: 'reserve', group: 'do', label: 'Reservar', module: ['reservations'], link: ['reserve'] },
    { key: 'tickets', group: 'do', label: 'Comprar entradas', module: ['events'], link: ['event'] },
    { key: 'entry', group: 'do', label: 'Mi entrada y mi manilla', module: ['door', 'wristbands'], link: ['entry', 'wristband'] },
  ];
  var TEAM_ITEMS = [
    { key: 'owner', label: 'Dueño' },
    { key: 'admin', label: 'Administrador' },
    { key: 'cashier', label: 'Cajero' },
    { key: 'waiter', label: 'Mesero' },
    { key: 'kitchen', label: 'Cocina' },
    { key: 'bar', label: 'Barra', needsBar: true },
    { key: 'door', label: 'Puerta', module: 'door' },
  ];
  var SUB_LABEL = { entry: 'Mi entrada', wristband: 'Mi manilla' };

  // ------------------------------------------------------------------------------------------- pure helpers --

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function thousands(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function bs(cents) { return cents == null ? '' : 'Bs ' + thousands(cents / 100); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  function planOf(sb, key) {
    var p = (sb.plans || []).filter(function (x) { return x.key === key; })[0];
    return p || { key: key, name: cap(key), price_cents: null };
  }
  /** «Plan Crece · Bs 600 al mes» */
  function planLabel(p) {
    return 'Plan ' + p.name + (p.price_cents != null ? ' · ' + bs(p.price_cents) + ' al mes' : '');
  }
  /** The same, with the separator spaced for the eye (the narrow font closes it up). */
  function planHtml(p) {
    return esc(planLabel(p)).replace(' · ', ' <span class="mzd-sep" aria-hidden="true">·</span> ');
  }

  /**
   * The left menu from demo-start: modules {key: {on, plan}} decide each item. Absent = the template does not use
   * it (hidden); on = usable; off = dimmed with the cheapest plan that has it. Returns [{key, title, items}].
   */
  function buildMenu(sb) {
    var mods = sb.modules || {}, links = sb.links || {}, plans = sb.plans || [];
    var seats = (sb.seats || []).map(function (s) { return s.role; });
    function rank(k) { for (var i = 0; i < plans.length; i++) if (plans[i].key === k) return i; return 99; }
    function stateOf(keys) {
      var present = keys.filter(function (k) { return mods[k]; });
      if (!present.length) return null;
      if (present.some(function (k) { return mods[k].on; })) return { state: 'on' };
      var best = present.map(function (k) { return mods[k].plan; }).filter(Boolean)
        .sort(function (a, b) { return rank(a) - rank(b); })[0];
      return { state: 'locked', plan: best ? planOf(sb, best) : null };
    }
    var items = [];
    GUEST_ITEMS.forEach(function (d) {
      var st = d.module ? stateOf(d.module) : { state: 'on' };
      if (!st) return;
      var subs = [];
      if (d.link) {
        d.link.forEach(function (l, i) {
          if (links[l] && (!d.module[i] || !mods[d.module[i]] || mods[d.module[i]].on)) subs.push(l);
        });
        if (st.state === 'on' && !subs.length) return; // nothing was built to open
      }
      items.push({ key: d.key, group: d.group, kind: 'guest', label: d.label, icon: d.key, state: st.state, plan: st.plan || null, subs: subs });
    });
    TEAM_ITEMS.forEach(function (d) {
      if (d.needsBar && !(sb.has_bar || seats.indexOf('bar') >= 0)) return;
      var st = d.module ? stateOf([d.module]) : { state: 'on' };
      if (!st) return;
      if (st.state === 'on' && seats.length && seats.indexOf(d.key) < 0) return; // no member for that role
      items.push({ key: d.key, group: 'team', kind: 'team', label: d.label, icon: d.key, state: st.state, plan: st.plan || null, line: tours.LINES[d.key] });
    });
    return GROUPS.map(function (g) {
      return { key: g.key, title: g.title, items: items.filter(function (i) { return i.group === g.key; }) };
    }).filter(function (g) { return g.items.length; });
  }

  function findItem(menu, key) {
    for (var g = 0; g < menu.length; g++) for (var i = 0; i < menu[g].items.length; i++) if (menu[g].items[i].key === key) return menu[g].items[i];
    return null;
  }

  /** Frame names: a seat is `mz-demo:<role>` (lib/demo.ts namespaces its storage by it); guest pages are not seats. */
  function frameName(kind, key) { return (kind === 'team' ? 'mz-demo:' : 'mz-guest:') + key; }

  /**
   * Keeps at most `max` frames mounted, least recently shown dropped first. make(key) builds the element (its
   * frame name is stable per key, so a dropped seat comes back to the same storage); drop(el, key) unmounts it.
   */
  function FramePool(opts) {
    this.max = opts.max || 3;
    this.make = opts.make;
    this.drop = opts.drop || function () {};
    this.list = [];
  }
  FramePool.prototype.get = function (key) {
    for (var i = 0; i < this.list.length; i++) if (this.list[i].key === key) return this.list[i].el;
    return null;
  };
  FramePool.prototype.has = function (key) { return this.get(key) !== null; };
  FramePool.prototype.keys = function () { return this.list.map(function (x) { return x.key; }); };
  /** Shows `key` (most recent), building it if needed. Returns {el, created}. */
  FramePool.prototype.show = function (key) {
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].key === key) {
        var hit = this.list.splice(i, 1)[0];
        this.list.push(hit);
        return { el: hit.el, created: false };
      }
    }
    var entry = { key: key, el: this.make(key) };
    this.list.push(entry);
    while (this.list.length > this.max) {
      var old = this.list.shift();
      this.drop(old.el, old.key);
    }
    return { el: entry.el, created: true };
  };
  FramePool.prototype.clear = function () {
    var self = this;
    this.list.splice(0).forEach(function (x) { self.drop(x.el, x.key); });
  };

  /** Venues when the visitor switches plan (§2 mapping: Escala shows 3; Nightlife keeps 2 when it had several). */
  function venuesFor(plan, current) {
    if (plan === 'escala') return 3;
    if (plan === 'nightlife') return (current || 1) > 1 ? 2 : 1;
    return 1;
  }

  function waLink(label, planName) {
    var t = 'Hola, vi el demo de ' + String(label || 'un negocio').toLowerCase() + ' con el plan ' + planName +
      ' y quiero hablar con alguien del equipo.';
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(t);
  }

  function normalize(p) {
    p = p || {};
    var template = /^[a-z][a-z0-9_]{0,39}$/.test(p.template || '') ? p.template : 'restaurante';
    var plan = PLAN_KEYS.indexOf(p.plan) >= 0 ? p.plan : 'crece';
    var venues = Math.max(1, Math.min(3, parseInt(p.venues, 10) || 1));
    var name = String(p.name || '').replace(/[^\p{L}\p{N} .'&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    var out = { template: template, plan: plan, venues: venues, name: name };
    if (p.prices && typeof p.prices === 'object') out.prices = p.prices;
    return out;
  }

  // ------------------------------------------------------------------------------------------------ storage --

  function store(v) {
    try {
      if (v) root.sessionStorage.setItem(STORE, JSON.stringify(v));
      else root.sessionStorage.removeItem(STORE);
    } catch (e) { /* private mode: the demo still works, it just does not survive a reload */ }
  }
  function load() {
    try {
      var v = JSON.parse(root.sessionStorage.getItem(STORE) || 'null');
      var live = v && v.sb && v.params && Date.parse(v.sb.expires_at) > Date.now();
      return live && v.backend === api.pickBackend(root.location.search) ? v : null;
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------------------------------------- the shell --

  var D = root.document;
  var S = null; // the open demo
  function noop() {}

  function $(sel, ctx) { return (ctx || S.root).querySelector(sel); }
  function $$(sel, ctx) { return [].slice.call((ctx || S.root).querySelectorAll(sel)); }
  function emit(name, detail) {
    try { D.dispatchEvent(new CustomEvent('mezzita-demo:' + name, { detail: detail || {} })); } catch (e) { /* old browsers */ }
  }
  function host() {
    var h = D.getElementById('demo-vivo');
    if (!h) {
      h = D.createElement('div');
      h.id = 'demo-vivo';
      (D.getElementById('main') || D.body).appendChild(h);
    }
    return h;
  }
  function isWide() { return root.innerWidth >= WIDE; }
  function vivo() { return /[?&]vivo=1\b/.test(root.location.search); }

  function saved() {
    var v = load();
    return v ? Object.assign({}, v.params) : null;
  }

  function open(params, opts) {
    opts = opts || {};
    params = normalize(params);
    teardown();
    var backend = api.pickBackend(root.location.search);
    S = {
      params: params, backend: backend, client: api.client(backend), sb: null, menu: [], cursor: null, state: null,
      guest: null, guestSub: null, team: ['owner'], mside: 'guest', full: '', tour: null, toastT: null, pt: null,
      pulsing: false, expired: false, played: {}, welcomeSeen: false, ambientNext: 0, timers: [],
    };
    var s = S;
    var h = host();
    h.hidden = false;
    D.documentElement.classList.add('mz-demo-open');
    D.documentElement.classList.toggle('mz-demo-phone', !isWide());
    if (vivo()) D.documentElement.classList.add('mz-vivo');
    h.innerHTML = '<div class="mzd" data-state="building" data-layout="' + (isWide() ? 'wide' : 'phone') + '">' +
      '<div class="mzd-building" role="status"><span class="mzd-spin" aria-hidden="true"></span><p>' + BUILDING + '</p>' +
      '<small>Datos de ejemplo. Nada de lo que hagas aquí llega a un negocio real ni envía mensajes.</small></div></div>';
    S.root = h.firstChild;
    try { root.scrollTo(0, 0); } catch (e) { /* jsdom */ }
    emit('open', { params: params });
    var start = opts.sb ? Promise.resolve(opts.sb) : s.client.start(params);
    return start.then(function (sb) {
      if (s !== S) return null;
      s.sb = sb;
      if (opts.saved) {
        // the cursor stays null: the first pulse brings the whole conversation back into the new phone
        s.welcomeSeen = Boolean(opts.saved.welcomeSeen);
        s.ambientNext = opts.saved.ambientNext || 0;
        if (opts.saved.guest) s.guest = opts.saved.guest;
        if (opts.saved.team) s.team = opts.saved.team;
        s.flows = opts.saved.flows || null;
      }
      checkPrice(sb, params);
      mount();
      emit('ready', { sandbox: sb.sandbox, plan: sb.plan, template: sb.template });
      return { sandbox: sb.sandbox, plan: sb.plan, template: sb.template };
    }, function (err) {
      if (s !== S) return null;
      failed(err);
      emit('error', { message: err.message, code: err.code });
      throw err;
    });
  }

  function resume() {
    var v = load();
    if (!v) return Promise.resolve(null);
    return open(v.params, { sb: v.sb, saved: v });
  }

  function restart() { return S ? open(S.params) : Promise.resolve(null); }

  function close() {
    teardown();
    store(null);
    var h = D.getElementById('demo-vivo');
    if (h) { h.innerHTML = ''; h.hidden = true; }
    D.documentElement.classList.remove('mz-demo-open', 'mz-vivo', 'mz-demo-phone');
    emit('close');
  }

  function teardown() {
    if (!S) return;
    var s = S;
    S = null;
    clearTimeout(s.pt);
    clearTimeout(s.toastT);
    s.timers.forEach(clearTimeout);
    if (s.ambient) s.ambient.stop();
    if (s.tour) s.tour.active = false;
    if (s.ro) s.ro.disconnect();
    if (s.off) s.off.forEach(function (f) { f(); });
    if (s.tpool) s.tpool.clear();
    if (s.gpool) s.gpool.clear();
  }

  function save() {
    if (!S || !S.sb) return;
    store({
      backend: S.backend, params: S.params, sb: S.sb, welcomeSeen: S.welcomeSeen,
      ambientNext: S.ambient ? S.ambient.next : S.ambientNext, guest: S.guest, team: S.team,
      flows: S.phone ? S.phone.flows : null,
    });
  }

  function checkPrice(sb, params) {
    var p = planOf(sb, sb.plan);
    var want = params.prices && params.prices[sb.plan];
    if (want != null && p.price_cents != null && Number(want) * 100 !== p.price_cents && root.console) {
      root.console.warn('[demo] plan price differs: site Bs ' + want + ', backend ' + bs(p.price_cents));
    }
  }

  // ------------------------------------------------------------------------------------------------- markup --

  function menuHtml(menu, sheet) {
    return menu.map(function (g) {
      return '<div class="mzd-group" role="group" aria-label="' + esc(g.title) + '"><p class="mzd-gt" aria-hidden="true"><span>' + esc(g.title) + '</span></p>' +
        g.items.map(function (it) {
          var locked = it.state === 'locked';
          var chip = locked && it.plan ? '<span class="mzd-chip">' + icon('lock') + 'Plan ' + esc(it.plan.name) + '</span>' : '';
          var aria = it.label + (locked && it.plan ? ', viene en el plan ' + it.plan.name : '');
          return '<button type="button" class="mzd-item' + (locked ? ' is-locked' : '') + '" data-item="' + it.key + '" data-kind="' + it.kind +
            '" aria-label="' + esc(aria) + '"' + (sheet ? '' : ' title="' + esc(it.label) + '"') + '>' +
            '<span class="mzd-ic">' + icon(it.icon) + '</span><span class="mzd-tx"><b>' + esc(it.label) + '</b>' +
            (it.line ? '<small>' + esc(it.line) + '</small>' : '') + chip + '</span></button>';
        }).join('') + '</div>';
    }).join('');
  }

  function shellHtml(sb) {
    var p = planOf(sb, sb.plan);
    var label = sb.label || LABELS[sb.template] || '';
    var want = waLink(label, p.name);
    var venue = (sb.org && sb.org.name) || '';
    return '' +
      '<header class="mzd-top">' +
        '<div class="mzd-id"><span class="mzd-dot" aria-hidden="true"></span><span class="mzd-note">Demo · datos de ejemplo</span>' +
          '<b class="mzd-venue" title="' + esc(venue) + '">' + esc(venue) + '</b></div>' +
        '<div class="mzd-plan"><span class="mzd-planchip">' + planHtml(p) + '</span>' +
          '<button type="button" class="mzd-link" data-act="plans">Cambiar</button></div>' +
        '<button type="button" class="mzd-planbtn" data-act="plans" aria-label="' + esc(planLabel(p)) + '. Cambiar de plan">Plan ' + esc(p.name) +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg></button>' +
        '<div class="mzd-acts"><button type="button" class="mzd-ghost" data-act="guide">Guía</button>' +
          '<button type="button" class="mzd-ghost" data-act="restart">Reiniciar</button>' +
          '<a class="btn btn-primary mzd-want" href="' + esc(want) + '" target="_blank" rel="noopener">Quiero esto en mi negocio</a></div>' +
      '</header>' +
      '<div class="mzd-seg" role="group" aria-label="Qué lado ver"><button type="button" data-side="guest"><b>Cliente</b><small data-cur="guest"></small></button>' +
        '<button type="button" data-side="team"><b>Equipo</b><small data-cur="team"></small></button></div>' +
      '<div class="mzd-body">' +
        '<nav class="mzd-menu" aria-label="Qué ver en la demo">' + menuHtml(S.menu, false) + '</nav>' +
        '<div class="mzd-stage">' +
          '<section class="mzd-pane mzd-guest" aria-label="Lo que ve tu cliente">' +
            '<div class="mzd-pane-hd"><span class="mzd-pane-t" data-t="guest"></span><span class="mzd-subs" role="group" aria-label="Qué ver"></span>' +
              '<button type="button" class="mzd-link mzd-full" data-act="full" data-pane="guest">Pantalla completa</button></div>' +
            '<div class="mzd-pane-bd"><div class="mzd-device"><div class="mzd-screen"><div class="mzd-wa" hidden></div><div class="mzd-gframes"></div></div></div></div>' +
          '</section>' +
          '<section class="mzd-pane mzd-team" aria-label="Tu equipo y tu sistema">' +
            '<div class="mzd-pane-hd"><span class="mzd-pane-t" data-t="team"></span><small class="mzd-pane-l"></small>' +
              '<button type="button" class="mzd-link mzd-full" data-act="full" data-pane="team">Pantalla completa</button></div>' +
            '<div class="mzd-pane-bd mzd-seats"></div>' +
          '</section>' +
        '</div>' +
        '<div class="mzd-rail" hidden role="region" aria-label="Recorrido"><div class="mzd-rail-bar" aria-hidden="true"><i></i></div><div class="mzd-rail-in">' +
          '<div class="mzd-rail-tx"><p class="mzd-rail-k"></p><p class="mzd-rail-b" aria-live="polite"></p></div>' +
          '<div class="mzd-rail-acts"><button type="button" class="mzd-ghost" data-act="tour-exit">Explorar por mi cuenta</button>' +
          '<button type="button" class="btn btn-primary" data-act="tour-next">Siguiente</button></div></div></div>' +
        '<div class="mzd-toast" role="status" aria-live="polite" hidden></div>' +
      '</div>' +
      '<div class="mzd-mbar"><button type="button" class="mzd-mbtn" data-act="sheet" aria-haspopup="dialog">' + icon('grid') + '<span>Demo</span></button>' +
        '<a class="btn btn-primary mzd-mwant" href="' + esc(want) + '" target="_blank" rel="noopener">Quiero esto en mi negocio</a></div>' +
      '<div class="mzd-sheet" hidden role="dialog" aria-modal="true" aria-label="Demo">' +
        '<div class="mzd-sheet-card">' +
          '<div class="mzd-sheet-hd"><div><b>' + esc(venue) + '</b><small>' + planHtml(p) + ' <button type="button" class="mzd-link" data-act="plans">Cambiar</button></small></div>' +
            '<button type="button" class="mzd-x" data-act="sheet-close" aria-label="Cerrar">' + icon('close') + '</button></div>' +
          '<div class="mzd-sheet-acts"><button type="button" class="mzd-ghost" data-act="guide">Guía</button><button type="button" class="mzd-ghost" data-act="restart">Reiniciar</button>' +
            '<a class="btn btn-primary" href="' + esc(want) + '" target="_blank" rel="noopener">Quiero esto en mi negocio</a></div>' +
          '<nav class="mzd-sheet-menu" aria-label="Qué ver en la demo">' + menuHtml(S.menu, true) + '</nav>' +
          '<p class="mzd-sheet-ft"><button type="button" class="mzd-link" data-act="exit">Salir de la demo</button></p>' +
        '</div></div>' +
      '<div class="mzd-modal" hidden><div class="mzd-modal-card" role="dialog" aria-modal="true" tabindex="-1"></div></div>';
  }

  // ------------------------------------------------------------------------------------------------- mount --

  function mount() {
    var sb = S.sb;
    if (S.client.mock) {
      root.MezzitaDemo.__mock = S.client;
      root.MezzitaDemo.__sandbox = sb;
    }
    S.menu = buildMenu(sb);
    S.root.innerHTML = shellHtml(sb);
    S.root.setAttribute('data-state', 'ready');
    S.root.setAttribute('data-full', '');
    layout();

    // A reservation script makes no sense on a plan without reservations: its chip is left out.
    var scripts = Object.assign({}, (sb.wa && sb.wa.scripts) || {});
    if (!(sb.modules && sb.modules.reservations && sb.modules.reservations.on)) delete scripts.wa_reservation;
    S.phone = new phoneMod.Phone($('.mzd-wa'), {
      venue: sb.org && sb.org.name,
      scripts: scripts,
      freeText: Boolean(sb.wa && sb.wa.free_text),
      flows: S.flows,
      send: function (script, step) { return S.client.play(S.sb, script, step); },
      text: function (t) { return S.client.play(S.sb, 'free', { text: t }); },
      onChange: function () { observe(null); },
      onExpired: expired,
    });

    S.tpool = new FramePool({ max: POOL_TEAM, make: makeSeat, drop: dropEl });
    S.gpool = new FramePool({ max: POOL_GUEST, make: makeGuest, drop: dropEl });

    var first = findItem(S.menu, S.guest);
    if (!first || first.state !== 'on' || first.kind !== 'guest') {
      var wa = findItem(S.menu, 'whatsapp');
      S.guest = wa && wa.state === 'on' ? 'whatsapp' : 'site';
    }
    var team = (S.team || []).filter(function (r) { var it = findItem(S.menu, r); return it && it.state === 'on'; });
    showGuest(S.guest, null, true);
    showTeam(team.length ? team : ['owner'], true);
    side(S.mside);

    bind();
    S.ambient = new tours.Ambient((sb.wa && sb.wa.ambient) || [], function (i) {
      var s = S;
      s.client.play(s.sb, 'ambient', i).then(function () { if (s === S) { save(); schedulePulse(600); } }, function (err) {
        if (s === S && err && err.expired) expired();
      });
    }, { from: S.ambientNext });
    S.ambient.start();
    if (D.hidden) S.ambient.hold();

    save();
    pulse();
    if (!S.welcomeSeen) welcome();
  }

  function bind() {
    var s = S;
    s.off = [];
    function on(t, ev, f, o) { t.addEventListener(ev, f, o); s.off.push(function () { t.removeEventListener(ev, f, o); }); }
    on(s.root, 'click', onClick);
    on(D, 'keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('.mzd-modal').hidden && $('.mzd-modal').getAttribute('data-sticky') !== '1') modal(null);
      else if (!$('.mzd-sheet').hidden) sheet(false);
    });
    on(D, 'visibilitychange', function () {
      if (D.hidden) { clearTimeout(s.pt); s.ambient && s.ambient.hold(); }
      else { s.ambient && s.ambient.release(); pulse(); }
    });
    on(root, 'resize', layout);
    // The menu opens on hover and on keyboard focus, and folds as soon as an item is chosen (it covers the guest's
    // phone while open). A plain :focus-within would keep it open after every click.
    var menu = $('.mzd-menu');
    var kb = false;
    on(D, 'keydown', function (e) { if (e.key === 'Tab') kb = true; }, true);
    on(D, 'pointerdown', function () { kb = false; }, true);
    on(menu, 'mouseenter', function () { if (!menu.hasAttribute('data-folded')) menu.classList.add('is-open'); });
    on(menu, 'mouseleave', function () {
      menu.removeAttribute('data-folded');
      if (!(kb && menu.contains(D.activeElement))) menu.classList.remove('is-open');
    });
    on(menu, 'focusin', function () { if (kb) menu.classList.add('is-open'); });
    on(menu, 'focusout', function (e) { if (!menu.contains(e.relatedTarget)) menu.classList.remove('is-open'); });
    if (typeof ResizeObserver === 'function') {
      s.ro = new ResizeObserver(function () { scale(); });
      s.ro.observe($('.mzd-stage'));
    }
  }

  function onClick(e) {
    var t = e.target.closest('[data-item],[data-act],[data-side],[data-sub],[data-tour],[data-plan]');
    if (!t || !S.root.contains(t)) return;
    if (t.hasAttribute('data-item')) {
      var m = t.closest('.mzd-menu');
      if (m) { m.classList.remove('is-open'); m.setAttribute('data-folded', ''); }
      choose(t.getAttribute('data-item'));
      if (t.closest('.mzd-sheet')) sheet(false);
      return;
    }
    if (t.hasAttribute('data-side')) return side(t.getAttribute('data-side'));
    if (t.hasAttribute('data-sub')) return showGuest('entry', t.getAttribute('data-sub'));
    if (t.hasAttribute('data-tour')) { modal(null); return startTour(t.getAttribute('data-tour')); }
    if (t.hasAttribute('data-plan')) { modal(null); return switchPlan(t.getAttribute('data-plan')); }
    var act = t.getAttribute('data-act');
    if (act === 'plans') { sheet(false); plansModal(); }
    else if (act === 'guide') { sheet(false); welcome(); }
    else if (act === 'restart') { sheet(false); confirmRestart(); }
    else if (act === 'do-restart') { modal(null); open(S.params).catch(noop); }
    else if (act === 'reopen') { open(S.params).catch(noop); }
    else if (act === 'exit') close();
    else if (act === 'explore') { modal(null); S.welcomeSeen = true; save(); }
    else if (act === 'modal-close') modal(null);
    else if (act === 'sheet') sheet(true);
    else if (act === 'sheet-close') sheet(false);
    else if (act === 'full') full(t.getAttribute('data-pane'));
    else if (act === 'tour-next' && S.tour) S.tour.next();
    else if (act === 'tour-exit' && S.tour) S.tour.exit();
  }

  function choose(key) {
    var it = findItem(S.menu, key);
    if (!it) return;
    if (it.state === 'locked') return lockedModal(it);
    if (it.kind === 'guest') { showGuest(key); side('guest'); }
    else { showTeam([key]); side('team'); }
    save();
  }

  // ---------------------------------------------------------------------------------------------- frames --

  function iframe(name, title) {
    var f = D.createElement('iframe');
    f.name = name;
    f.title = title;
    f.setAttribute('allow', 'camera; clipboard-write');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    return f;
  }

  function makeSeat(role) {
    var it = findItem(S.menu, role) || { label: role };
    var wrap = D.createElement('div');
    wrap.className = 'mzd-seat';
    wrap.setAttribute('data-role', role);
    var f = iframe(frameName('team', role), it.label + ' · demo');
    if (S.client.mock) f.srcdoc = S.client.page(role, S.sb);
    else f.src = S.client.seatUrl(S.sb, role);
    var tag = '<span class="mzd-seat-t">' + esc(it.label) + '</span>';
    if (role === 'waiter') {
      wrap.setAttribute('data-device', 'phone');
      wrap.innerHTML = tag + '<div class="mzd-device"><div class="mzd-screen"></div></div>';
      wrap.querySelector('.mzd-screen').appendChild(f);
    } else {
      wrap.innerHTML = tag;
      wrap.appendChild(f);
    }
    $('.mzd-seats').appendChild(wrap);
    return wrap;
  }

  function guestPath(key) {
    var sb = S.sb, links = sb.links || {};
    if (key === 'site') {
      var v = (sb.venues && sb.venues[0]) || {};
      return '/demo/sitio/?org=' + encodeURIComponent((sb.org && sb.org.slug) || '') + '&venue=' + encodeURIComponent(v.slug || '') +
        '&backend=' + S.backend;
    }
    var map = { menu: 'menu', table: 'table', reserve: 'reserve', tickets: 'event', entry: 'entry', wristband: 'wristband' };
    return links[map[key]] ? S.client.guestUrl(sb, links[map[key]]) : '';
  }

  function makeGuest(key) {
    var it = findItem(S.menu, key === 'wristband' ? 'entry' : key) || { label: key };
    var f = iframe(frameName('guest', key), (SUB_LABEL[key] || it.label) + ' · demo');
    if (S.client.mock) f.srcdoc = S.client.page(key, S.sb);
    else f.src = guestPath(key);
    f.className = 'mzd-gframe';
    f.setAttribute('data-key', key);
    $('.mzd-gframes').appendChild(f);
    return f;
  }

  function dropEl(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  function showGuest(key, sub, quiet) {
    var it = findItem(S.menu, key);
    if (!it || it.state !== 'on') return;
    S.guest = key;
    var wa = key === 'whatsapp';
    $('.mzd-wa').hidden = !wa;
    var fk = null;
    if (key === 'entry') {
      S.guestSub = sub && it.subs.indexOf(sub) >= 0 ? sub : S.guestSub && it.subs.indexOf(S.guestSub) >= 0 ? S.guestSub : it.subs[0];
      fk = S.guestSub;
    } else if (!wa) fk = key;
    if (fk) S.gpool.show(fk);
    $$('.mzd-gframe').forEach(function (f) { f.hidden = f.getAttribute('data-key') !== fk; });
    $('.mzd-guest').setAttribute('data-kind', wa ? 'wa' : 'frame');
    $('[data-t="guest"]').textContent = it.label;
    $('.mzd-subs').innerHTML = key === 'entry' && it.subs.length > 1 ? it.subs.map(function (k) {
      return '<button type="button" data-sub="' + k + '" aria-pressed="' + (k === fk) + '">' + SUB_LABEL[k] + '</button>';
    }).join('') : '';
    current();
    if (!quiet) schedulePulse(400);
  }

  function showTeam(roles, quiet) {
    roles = [].concat(roles).filter(function (r) { var it = findItem(S.menu, r); return it && it.state === 'on'; });
    if (!roles.length) return;
    var duo = roles.length > 1 && S.root.getAttribute('data-layout') === 'wide' && root.innerWidth >= DUO && S.full !== 'guest';
    var shown = duo ? roles.slice(0, 2) : roles.slice(0, 1);
    S.team = roles;
    S.shown = shown;
    var created = {};
    shown.forEach(function (r) { created[r] = S.tpool.show(r).created; });
    $$('.mzd-seat').forEach(function (w) { w.hidden = shown.indexOf(w.getAttribute('data-role')) < 0; });
    var seats = $('.mzd-seats');
    seats.toggleAttribute('data-duo', duo);
    if (duo) shown.forEach(function (r, i) { var w = S.tpool.get(r); if (w) w.style.order = i; });
    var a = findItem(S.menu, shown[0]);
    $('[data-t="team"]').textContent = shown.map(function (r) { return findItem(S.menu, r).label; }).join(' y ');
    $('.mzd-pane-l').textContent = duo ? '' : (a.line || '');
    S.created = created;
    current();
    if (!quiet) schedulePulse(400);
    scale();
  }

  /** Guide shortcut into a seat (lib/demo.ts accepts it from the allowed parent origins only). */
  function goTo(role, path) {
    if (S.client.mock || !path) return;
    var w = S.tpool.get(role);
    var f = w && w.querySelector('iframe');
    var origin = S.client.appOrigin(S.sb);
    if (!f || !origin) return;
    function post() { try { f.contentWindow.postMessage({ type: 'mz-demo:go', to: path }, origin); } catch (e) { /* frame gone */ } }
    if (S.created && S.created[role]) {
      // A new seat signs in first (/demo/entrar), so repeat the shortcut until it has landed on its home.
      f.addEventListener('load', post, { once: true });
      [1500, 4000].forEach(function (ms) { S.timers.push(setTimeout(post, ms)); });
    } else post();
  }

  function current() {
    var shown = S.shown || [];
    $$('[data-item]').forEach(function (b) {
      var k = b.getAttribute('data-item');
      var on = b.getAttribute('data-kind') === 'guest' ? k === S.guest : shown.indexOf(k) >= 0;
      b.setAttribute('aria-current', on ? 'true' : 'false');
    });
    // the phone's «Cliente | Equipo» switch says what each side is showing
    var g = findItem(S.menu, S.guest);
    var cg = $('[data-cur="guest"]');
    var ct = $('[data-cur="team"]');
    if (cg) cg.textContent = g ? g.label : '';
    if (ct) ct.textContent = shown.map(function (r) { var it = findItem(S.menu, r); return it ? it.label : r; }).join(' y ');
  }

  // ---------------------------------------------------------------------------------------------- layout --

  function layout() {
    if (!S || !S.root) return;
    var wide = isWide();
    var was = S.root.getAttribute('data-layout');
    S.root.setAttribute('data-layout', wide ? 'wide' : 'phone');
    D.documentElement.classList.toggle('mz-demo-phone', !wide);
    if (S.sb && was !== S.root.getAttribute('data-layout') && S.team) showTeam(S.team, true);
    scale();
  }

  /** Phones are 390 × 800 of content in a 10 px bezel (410 × 820), scaled to the stage's free height. */
  function scale() {
    if (!S || !S.root || !S.sb) return;
    var st = $('.mzd-stage');
    if (!st) return;
    var cs = root.getComputedStyle(st);
    var h = st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 40; // 40: the pane header
    var k = Math.max(0.45, Math.min(1, h / 820));
    S.root.style.setProperty('--k', k.toFixed(3));
  }

  function side(which) {
    S.mside = which === 'team' ? 'team' : 'guest';
    S.root.setAttribute('data-mside', S.mside);
    $$('.mzd-seg [data-side]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-side') === S.mside)); });
    current();
  }

  function full(pane) {
    S.full = S.full === pane ? '' : pane;
    S.root.setAttribute('data-full', S.full);
    $$('[data-act="full"]').forEach(function (b) { b.textContent = S.full ? 'Ver los dos' : 'Pantalla completa'; });
    showTeam(S.team, true);
  }

  function sheet(show) {
    var sh = $('.mzd-sheet');
    if (!sh) return;
    sh.hidden = !show;
    if (show) { var b = sh.querySelector('[aria-current="true"]') || sh.querySelector('button'); if (b) b.focus(); }
    else { var m = $('.mzd-mbtn'); if (m && S.root.getAttribute('data-layout') === 'phone') m.focus(); }
  }

  // ---------------------------------------------------------------------------------------------- modals --

  function modal(html, opts) {
    opts = opts || {};
    var m = $('.mzd-modal');
    if (!m) return;
    if (html == null) {
      m.hidden = true;
      m.removeAttribute('data-sticky');
      if (S.lastFocus && S.lastFocus.focus) S.lastFocus.focus();
      return;
    }
    S.lastFocus = D.activeElement;
    var card = m.firstChild;
    card.innerHTML = html;
    card.setAttribute('aria-label', opts.label || '');
    m.toggleAttribute('data-sticky', Boolean(opts.sticky));
    if (opts.sticky) m.setAttribute('data-sticky', '1');
    m.hidden = false;
    card.focus(); // the dialog itself: announced, and no focus ring on a button the visitor did not pick
  }

  function welcome() {
    var list = availableTours();
    modal('<div class="mzd-mh"><div><b>¿Cómo quieres verlo?</b><span>Elige un recorrido guiado o explora por tu cuenta.</span></div>' +
      '<button type="button" class="mzd-x" data-act="explore" aria-label="Cerrar y explorar por mi cuenta">' + icon('close') + '</button></div>' +
      '<div class="mzd-tours">' + list.map(function (t) {
        return '<button type="button" class="mzd-tour" data-tour="' + t.key + '"><b>' + esc(t.title) + '</b><small>' + esc(t.line) +
          '</small><span class="mzd-tour-n">' + t.steps.length + ' pasos</span></button>';
      }).join('') + '</div>' +
      '<div class="mzd-mf"><button type="button" class="mzd-ghost" data-act="explore">Explorar por mi cuenta</button></div>', { label: '¿Cómo quieres verlo?' });
  }

  function lockedModal(it) {
    var p = it.plan || { name: '', price_cents: null, key: '' };
    modal('<div class="mzd-mh"><div><b>' + esc(it.label) + '</b><span>Esto viene en el plan ' + esc(p.name) +
      (p.price_cents != null ? ' (' + bs(p.price_cents) + ' al mes)' : '') + '.</span></div>' +
      '<button type="button" class="mzd-x" data-act="modal-close" aria-label="Cerrar">' + icon('close') + '</button></div>' +
      '<div class="mzd-mf"><button type="button" class="mzd-ghost" data-act="modal-close">Ahora no</button>' +
      (p.key ? '<button type="button" class="btn btn-primary" data-plan="' + esc(p.key) + '">Ver el demo con ' + esc(p.name) + '</button>' : '') + '</div>',
    { label: it.label });
  }

  function plansModal() {
    var cur = S.sb.plan;
    modal('<div class="mzd-mh"><div><b>Cambiar de plan</b><span>Vas a ver solo lo que incluye ese plan.</span></div>' +
      '<button type="button" class="mzd-x" data-act="modal-close" aria-label="Cerrar">' + icon('close') + '</button></div>' +
      '<div class="mzd-plans">' + (S.sb.plans || []).map(function (p) {
        var me = p.key === cur;
        return '<button type="button" class="mzd-plancard"' + (me ? ' aria-current="true" disabled' : ' data-plan="' + esc(p.key) + '"') + '><b>' + esc(p.name) +
          '</b><span>' + (p.price_cents != null ? bs(p.price_cents) + ' al mes' : '') + '</span><small>' + (me ? 'El que estás viendo' : 'Abrir con este plan') + '</small></button>';
      }).join('') + '</div>' +
      '<p class="mzd-mnote">0 % de comisión en todos los planes.</p>' +
      '<div class="mzd-mf"><button type="button" class="mzd-link" data-act="exit">Ver otro tipo de negocio</button></div>', { label: 'Cambiar de plan' });
  }

  function confirmRestart() {
    modal('<div class="mzd-mh"><div><b>¿Reiniciar la demo?</b><span>Armamos una copia nueva con los datos de ejemplo. Lo que cambiaste aquí se borra.</span></div></div>' +
      '<div class="mzd-mf"><button type="button" class="mzd-ghost" data-act="modal-close">Cancelar</button>' +
      '<button type="button" class="btn btn-primary" data-act="do-restart">Reiniciar</button></div>', { label: '¿Reiniciar la demo?' });
  }

  function switchPlan(plan) {
    var p = Object.assign({}, S.params, { plan: plan, venues: venuesFor(plan, S.params.venues) });
    return open(p).catch(noop); // the shell shows the error
  }

  function failed(err) {
    var r = S.root;
    r.setAttribute('data-state', 'error');
    r.innerHTML = '<div class="mzd-building" role="alert"><p>' + esc(err.message) + '</p><div class="mzd-mf">' +
      '<button type="button" class="mzd-ghost" data-act="exit">Volver</button>' +
      '<button type="button" class="btn btn-primary" data-act="reopen">Probar de nuevo</button></div></div>';
    if (!S.off) {
      var s = S;
      var f = function (e) {
        var t = e.target.closest('[data-act]');
        if (!t) return;
        if (t.getAttribute('data-act') === 'exit') close();
        if (t.getAttribute('data-act') === 'reopen') open(s.params).catch(noop);
      };
      r.addEventListener('click', f);
    }
  }

  function expired() {
    if (!S || S.expired) return;
    S.expired = true;
    clearTimeout(S.pt);
    if (S.ambient) S.ambient.stop();
    if (S.tour) { S.tour.active = false; rail(false); }
    store(null);
    modal('<div class="mzd-mh"><div><b>Tu demo se cerró por inactividad.</b><span>Abrimos otra igual, con los datos de ejemplo de nuevo.</span></div></div>' +
      '<div class="mzd-mf"><button type="button" class="btn btn-primary" data-act="reopen">Abrir de nuevo</button></div>', { sticky: true, label: 'Tu demo se cerró' });
  }

  // ------------------------------------------------------------------------------------------ pulse, toasts --

  function interval() {
    return S.guest === 'whatsapp' || (S.tour && S.tour.active) ? 2000 : 10000;
  }
  function schedulePulse(ms) {
    if (!S || !S.sb || S.expired) return;
    clearTimeout(S.pt);
    if (D.hidden) return;
    S.pt = setTimeout(pulse, ms == null ? interval() : ms);
  }
  function pulse() {
    var s = S;
    if (!s || !s.sb || s.expired || D.hidden) return;
    if (s.pulsing) return schedulePulse();
    s.pulsing = true;
    clearTimeout(s.pt);
    s.client.pulse(s.sb, s.cursor).then(function (r) {
      if (s !== S) return;
      s.pulsing = false;
      var first = s.cursor == null; // a resumed demo gets its whole conversation back: shown at once
      if (r.cursor != null) s.cursor = r.cursor;
      if (r.expires_at) s.sb.expires_at = r.expires_at;
      if (r.messages && r.messages.length) s.phone.add(r.messages, { instant: first });
      observe(r.state || null);
      save();
      schedulePulse();
    }, function (err) {
      if (s !== S) return;
      s.pulsing = false;
      if (err && err.expired) expired();
      else schedulePulse(15000);
    });
  }

  function snapshot() {
    if (!S.state) return null;
    return Object.assign({}, S.state, S.phone ? S.phone.counts() : {});
  }

  function observe(state) {
    if (!S) return;
    if (state) {
      var prev = S.state;
      S.state = state;
      if (prev) {
        if ((state.pending || 0) > (prev.pending || 0)) toast('Llegó un pedido nuevo a «Pedidos por confirmar».');
        else if ((state.to_verify || 0) > (prev.to_verify || 0)) toast('Hay un pago por verificar en la caja.');
        else if ((state.ready || 0) > (prev.ready || 0)) toast('Un pedido está listo para entregar.');
      }
    }
    var snap = snapshot();
    if (S.tour && snap && S.tour.observe(snap)) schedulePulse(300);
  }

  function toast(text) {
    var t = $('.mzd-toast');
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(S.toastT);
    S.toastT = setTimeout(function () { if (S) t.hidden = true; }, 4500);
  }

  // ---------------------------------------------------------------------------------------------- guide --

  function availableTours() {
    var venue = esc((S.sb.org && S.sb.org.name) || '');
    var mods = S.sb.modules || {};
    return tours.toursFor({
      // a menu item (whatsapp, table, cashier…) or a module without an item of its own (customers, inventory)
      on: function (k) {
        var it = findItem(S.menu, k);
        return it ? it.state === 'on' : Boolean(mods[k] && mods[k].on);
      },
      venue: venue,
      venues: (S.sb.venues || []).length,
    });
  }

  function startTour(key) {
    var t = availableTours().filter(function (x) { return x.key === key; })[0];
    if (!t) return;
    S.welcomeSeen = true;
    save();
    if (S.tour) S.tour.active = false;
    S.played = {};
    S.tour = new tours.TourRunner(t, { show: showStep, end: endTour });
    S.tour.start(snapshot());
    schedulePulse(300);
  }

  function showStep(step, i, n) {
    rail(true);
    $('.mzd-rail-k').textContent = S.tour.kicker();
    $('.mzd-rail-b').innerHTML = step.text; // our own strings; the venue name inside is escaped (availableTours)
    $('.mzd-rail-bar i').style.transform = 'scaleX(' + ((i + 1) / n) + ')';
    $('[data-act="tour-next"]').textContent = i === n - 1 ? 'Terminar' : 'Siguiente';
    if (step.guest) showGuest(step.guest === 'entry' ? 'entry' : step.guest, null, true);
    if (step.team) {
      showTeam(step.team, true);
      if (step.go) goTo([].concat(step.team)[0], step.go);
    }
    side(step.at === 'guest' || !step.team ? 'guest' : 'team');
    var k = S.tour.tour.key + ':' + i;
    if (step.play && !S.played[k]) {
      S.played[k] = true;
      var s = S;
      s.client.play(s.sb, step.play.script, step.play.step || 0).then(function (r) {
        if (s === S && r && r.messages) s.phone.add(r.messages);
        schedulePulse(300);
      }, function (err) { if (s === S && err && err.expired) expired(); });
    }
  }

  function endTour(completed) {
    rail(false);
    S.tour = null;
    if (completed) toast('Listo. Sigue explorando o elige otro recorrido en «Guía».');
    schedulePulse();
  }

  function rail(show) {
    var r = $('.mzd-rail');
    if (!r) return;
    r.hidden = !show;
    S.root.setAttribute('data-tour', show ? 'on' : 'off');
  }

  return {
    open: open,
    resume: resume,
    saved: saved,
    close: close,
    restart: restart,
    // pure parts, for tests
    buildMenu: buildMenu,
    findItem: findItem,
    FramePool: FramePool,
    frameName: frameName,
    venuesFor: venuesFor,
    waLink: waLink,
    planLabel: planLabel,
    normalize: normalize,
    bs: bs,
    WIDE: WIDE,
    DUO: DUO,
  };
});
