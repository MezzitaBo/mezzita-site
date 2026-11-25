/* Mezzita · demo vivo · api.js
   The four calls of docs/demo-vivo.md §3 (demo-start, demo-pulse, demo-play, demo-session) and a mock that answers
   with the same shapes. The backend comes from ?backend=mock|staging|demo (allow-list), else DEFAULT_BACKEND.
   Shapes, field by field: side-session note demo-shell-api.md. Internal text in English; what a visitor reads, Spanish. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.MezzitaDemo = root.MezzitaDemo || {}).api = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  // Build constant. Switch to 'demo' once the mezzita-demo project exists (owner decision 1), or to 'staging' for
  // the interim launch, when demo-start/pulse/play are deployed there.
  var DEFAULT_BACKEND = 'mock';
  var BACKENDS = {
    mock: { functions: '', app: '' },
    staging: {
      functions: 'https://pnkfxemhzswcbfygvfzf.supabase.co/functions/v1',
      app: 'https://mezzita-app-staging.rbrunocardona.workers.dev',
    },
    // Functions URL is set when the owner creates the mezzita-demo project; until then ?backend=demo is refused.
    demo: { functions: '', app: 'https://demo.mezzita.com' },
  };

  var MESSAGES = {
    bad_key: 'Tu demo se cerró por inactividad.',
    expired: 'Tu demo se cerró por inactividad.',
    demo_off: 'La demo no está disponible en este momento.',
    not_found: 'La demo no está disponible en este momento.',
    rate_limited: 'Abriste muchas demos seguidas. Prueba en unos minutos.',
    full: 'Hay muchas demos abiertas. Prueba en un minuto.',
    network: 'No pudimos conectar con la demo. Revisa tu conexión y prueba de nuevo.',
    unknown: 'Algo falló al abrir la demo. Prueba de nuevo.',
  };
  var BY_STATUS = { 403: 'bad_key', 404: 'demo_off', 410: 'expired', 429: 'rate_limited', 503: 'full' };

  function DemoError(code, status) {
    var e = new Error(MESSAGES[code] || MESSAGES.unknown);
    e.name = 'DemoError';
    e.code = MESSAGES[code] ? code : 'unknown';
    e.status = status || 0;
    e.expired = e.code === 'expired' || e.code === 'bad_key';
    return e;
  }

  function codeFor(status, body) {
    var c = body && typeof body.error === 'string' ? body.error : '';
    if (MESSAGES[c]) return c;
    return BY_STATUS[status] || 'unknown';
  }

  function usable(name) {
    var b = Object.prototype.hasOwnProperty.call(BACKENDS, name) && BACKENDS[name];
    return Boolean(b && (name === 'mock' || b.functions));
  }

  /** ?backend=… from a query string, only from the allow-list, else the build default. */
  function pickBackend(search) {
    var m = /[?&]backend=([a-z]+)/.exec(search || '');
    return m && usable(m[1]) ? m[1] : DEFAULT_BACKEND;
  }

  function seatHash(sb, role) {
    return '#s=' + encodeURIComponent(sb.sandbox) + '&k=' + encodeURIComponent(sb.key) + '&rol=' + encodeURIComponent(role);
  }

  // ---------------------------------------------------------------------------------------------------- remote --

  function remote(name) {
    var cfg = BACKENDS[name];
    function call(fn, body, ms) {
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || 12000) : null;
      return fetch(cfg.functions + '/demo-' + fn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
        signal: ctl ? ctl.signal : undefined,
      }).then(function (r) {
        if (timer) clearTimeout(timer);
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw DemoError(codeFor(r.status, j), r.status);
          return j;
        });
      }, function () {
        if (timer) clearTimeout(timer);
        throw DemoError('network', 0);
      });
    }
    function app(sb) { return (sb && sb.links && sb.links.app) || cfg.app; }
    return {
      name: name,
      mock: false,
      start: function (p) {
        return call('start', { template: p.template, plan: p.plan, venues: p.venues, name: p.name || null }, 20000);
      },
      pulse: function (sb, cursor) { return call('pulse', { sandbox: sb.sandbox, key: sb.key, cursor: cursor || null }); },
      play: function (sb, script, step) {
        var body = { sandbox: sb.sandbox, key: sb.key, script: script };
        if (step && typeof step === 'object') body.text = String(step.text || '');
        else body.step = step || 0;
        return call('play', body, 20000);
      },
      session: function (sb, role) { return call('session', { sandbox: sb.sandbox, key: sb.key, role: role }); },
      appOrigin: function (sb) {
        try { return new URL(app(sb)).origin; } catch (e) { return ''; }
      },
      seatUrl: function (sb, role) { return app(sb) + '/demo/entrar' + seatHash(sb, role); },
      guestUrl: function (sb, path) { return /^https?:/.test(path) ? path : app(sb) + path; },
    };
  }

  // ------------------------------------------------------------------------------------------------------ mock --
  // Same shapes as the real functions, in memory. Module entitlement copies the plan_features seed of
  // 20261112002300_venue_settings.sql so locked items and their cheapest plan behave as on staging.

  var PLANS = [
    { key: 'arranca', name: 'Arranca', price_cents: 40000 },
    { key: 'crece', name: 'Crece', price_cents: 60000 },
    { key: 'escala', name: 'Escala', price_cents: 90000 },
    { key: 'nightlife', name: 'Nightlife', price_cents: 90000 },
  ];
  var BASE = ['menu', 'whatsapp', 'pedidosya', 'customers', 'promotions'];
  var MID = BASE.concat(['tables', 'reservations', 'inventory']);
  var PLAN_FEATURES = {
    arranca: BASE,
    crece: MID,
    escala: MID,
    nightlife: MID.concat(['events', 'door', 'wristbands']),
  };
  var COMMON = ['menu', 'whatsapp', 'customers', 'promotions', 'pedidosya'];
  var TEMPLATES = {
    cafe: { label: 'Restaurante pequeño o café', venue: 'La Mesa Chica', bar: false, extra: ['tables', 'inventory'], order: 'Quiero 2 cafés con leche y 2 sándwiches' },
    restaurante: { label: 'Restaurante con salón', venue: 'Casa Brasa', bar: true, extra: ['tables', 'reservations', 'inventory'], order: 'Quiero 2 almuerzos del día para llevar' },
    pizzeria: { label: 'Pizzería', venue: 'Pizzería La Esquina', bar: false, extra: ['tables', 'reservations', 'inventory'], order: 'Quiero 2 pizzas margarita' },
    foodtruck: { label: 'Food truck', venue: 'Rueda Burger', bar: false, extra: ['inventory'], order: 'Quiero 2 combos clásicos' },
    heladeria: { label: 'Heladería', venue: 'Heladería Copo', bar: false, extra: ['tables', 'inventory'], order: 'Quiero un pote de medio litro, chocolate y frutilla' },
    bar: { label: 'Bar o pub', venue: 'Bar El Farol', bar: true, extra: ['tables', 'reservations', 'inventory', 'events', 'door'], order: 'Quiero reservar una mesa y una jarra para 4' },
    discoteca: { label: 'Discoteca o boliche', venue: 'Club Órbita', bar: true, extra: ['tables', 'inventory', 'events', 'door', 'wristbands'], order: 'Quiero 2 entradas para hoy' },
    eventos: { label: 'Eventos y productoras', venue: 'Altura Eventos', bar: true, extra: ['inventory', 'events', 'door', 'wristbands'], order: 'Quiero 2 entradas generales para el festival' },
  };
  var STAFF = { owner: 'Lucía Rojas', admin: 'Marco Vargas', cashier: 'Ana Quispe', waiter: 'Diego Mamani', kitchen: 'Rosa Choque', bar: 'Javier Flores', door: 'Pablo Gutiérrez' };

  function planHas(plan, mod) { return (PLAN_FEATURES[plan] || []).indexOf(mod) >= 0; }
  function cheapestPlan(mod) {
    for (var i = 0; i < PLANS.length; i++) if (planHas(PLANS[i].key, mod)) return PLANS[i].key;
    return null;
  }
  function slugify(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function rid(n) {
    var a = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '';
    for (var i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  function mockScripts(t) {
    return {
      wa_order: [
        { guest: t.order },
        { assistant: 'Hola, te saluda el asistente de ' + t.venue + '. Claro que sí. ¿Lo pasas a recoger o te lo llevamos?' },
        { guest: 'Lo paso a recoger en 30 minutos' },
        { assistant: 'Perfecto. Tu pedido: ' + t.order.replace(/^Quiero /, '') + '. Total Bs 96. ¿Confirmo el pedido?' },
        { guest: 'Sí, confirmo' },
        { assistant: 'Listo, tu pedido está en camino a la cocina. Te escribo por aquí cuando esté listo.' },
      ],
      wa_reservation: [
        { guest: 'Reservar para 4 a las 20:00' },
        { assistant: 'Con gusto. ¿Para hoy? ¿A nombre de quién la anoto?' },
        { guest: 'Para hoy, a nombre de Carla' },
        { assistant: 'Anotado: 4 personas hoy a las 20:00, a nombre de Carla. El local te la confirma por aquí.' },
      ],
      wa_handoff: [
        { guest: '¿Hacen delivery?' },
        { assistant: 'Sí, dentro de la ciudad. Te paso con una persona del equipo para ver tu dirección.' },
      ],
    };
  }
  var AMBIENT = [
    { kind: 'order', after_s: 20, text: 'Carla M. pide por WhatsApp' },
    { kind: 'order', after_s: 80, text: 'Un pedido desde el menú web' },
    { kind: 'reservation', after_s: 150, text: 'Una reserva para el sábado' },
    { kind: 'message', after_s: 220, text: 'Una pregunta por WhatsApp' },
    { kind: 'order', after_s: 300, text: 'Un pedido para recoger' },
  ];

  function nextGuest(steps, from) {
    for (var i = from; i < steps.length; i++) if (steps[i] && typeof steps[i].guest === 'string') return i;
    return null;
  }

  function mock(opts) {
    opts = opts || {};
    var delay = opts.delay == null ? 700 : opts.delay;
    var now = opts.now || function () { return Date.now(); };
    var boxes = {};

    function later(v) {
      return new Promise(function (res, rej) {
        setTimeout(function () { v instanceof Error ? rej(v) : res(v); }, delay ? Math.min(delay, 250) : 0);
      });
    }
    function box(sb) {
      var b = sb && boxes[sb.sandbox];
      if (!b || b.key !== sb.key) return DemoError('bad_key', 403);
      if (b.expired || now() > Date.parse(b.expires_at)) return DemoError('expired', 410);
      return b;
    }
    function iso(ms) { return new Date(ms).toISOString(); }
    function msg(b, id, from, text) {
      if (b.messages.some(function (m) { return m.id === id; })) return null;
      var m = { id: id, from: from, text: text, at: iso(now()) };
      b.messages.push(m);
      return m;
    }
    function order(b, o) {
      o.id = 'o' + (b.orders.length + 1);
      b.orders.push(o);
      return o;
    }
    function count(b, status) { return b.orders.filter(function (o) { return o.status === status; }).length; }
    function state(b) {
      return {
        pending: count(b, 'pending'),
        to_verify: b.payments.filter(function (p) { return !p.ok; }).length,
        in_kitchen: count(b, 'kitchen') + b.seededKitchen,
        ready: count(b, 'ready'),
        paid_today_cents: b.paid,
        open_tables: b.openTables,
      };
    }

    function start(p) {
      var t = TEMPLATES[p.template];
      if (!t || !PLAN_FEATURES[p.plan]) return later(DemoError('not_found', 404));
      var venues = Math.max(1, Math.min(3, Number(p.venues) || 1));
      var name = (p.name && String(p.name).trim()) || t.venue;
      var id = 'mock-' + rid(10);
      var key = rid(43);
      var slug = slugify(name) + '-' + rid(4);
      var mods = COMMON.concat(t.extra);
      var modules = {};
      mods.forEach(function (m) { modules[m] = { on: planHas(p.plan, m), plan: cheapestPlan(m) }; });
      var roles = ['owner', 'admin', 'cashier', 'waiter', 'kitchen'];
      if (t.bar) roles.push('bar');
      if (modules.door && modules.door.on) roles.push('door');
      var venueList = [];
      for (var v = 0; v < venues; v++) {
        venueList.push({ id: id + '-v' + v, slug: v ? 'local-' + (v + 1) : 'centro', name: v ? name + ' ' + ['', 'Norte', 'Sur'][v] : name });
      }
      var links = { app: '', menu: '/m/' + slug + '/centro' };
      if (modules.reservations && modules.reservations.on) links.reserve = links.menu + '?reservar=1';
      if (modules.tables && modules.tables.on) links.table = '/mesa/' + rid(12);
      if (modules.events && modules.events.on) links.event = '/e/' + slug + '/centro/esta-noche';
      if (modules.door && modules.door.on) links.entry = '/entrada/' + rid(12);
      if (modules.wristbands && modules.wristbands.on) links.wristband = '/manilla/' + rid(12);
      var sb = {
        sandbox: id, key: key, expires_at: iso(now() + 4 * 3600e3),
        template: p.template, label: t.label, plan: p.plan, plans: PLANS.slice(),
        org: { id: id + '-org', slug: slug, name: name },
        venues: venueList, modules: modules, has_bar: t.bar,
        seats: roles.map(function (r) { return { role: r, name: STAFF[r] }; }),
        links: links,
        wa: { free_text: false, scripts: mockScripts({ venue: name, order: t.order }), ambient: AMBIENT.slice() },
      };
      boxes[id] = {
        key: key, sb: sb, expires_at: sb.expires_at, expired: false, messages: [], orders: [], payments: [],
        paid: 412000 + Math.floor(Math.random() * 90) * 1000, openTables: modules.tables && modules.tables.on ? 5 : 0,
        seededKitchen: 3, ambient: {},
      };
      order(boxes[id], { label: 'Pedido web · 2 platos', where: 'Para recoger', total: 7800, status: 'pending', src: 'web' });
      boxes[id].payments.push({ label: 'Mesa 2 · QR', total: 12400, ok: false });
      return new Promise(function (res) { setTimeout(function () { res(JSON.parse(JSON.stringify(sb))); }, delay); });
    }

    function pulse(sb, cursor) {
      var b = box(sb);
      if (b instanceof Error) return later(b);
      b.expires_at = iso(Math.min(now() + 4 * 3600e3, Date.parse(b.sb.expires_at) + 20 * 3600e3));
      var from = cursor ? Number(cursor) || 0 : 0;
      return later({ expires_at: b.expires_at, state: state(b), messages: b.messages.slice(from), cursor: String(b.messages.length) });
    }

    function play(sb, script, step) {
      var b = box(sb);
      if (b instanceof Error) return later(b);
      var out = [];
      if (script === 'ambient') {
        var ev = b.sb.wa.ambient[step];
        if (ev && !b.ambient[step]) {
          b.ambient[step] = true;
          if (ev.kind === 'order') order(b, { label: ev.text || 'Pedido por WhatsApp', where: 'WhatsApp', total: 9600, status: 'pending', src: 'whatsapp' });
        }
        return later({ ok: true, messages: [], next: null, done: true });
      }
      if (script === 'door_checkin') return later({ ok: true, messages: [], next: null, done: true });
      if (script === 'wristband') { b.paid += 3000; return later({ ok: true, messages: [], next: null, done: true }); }
      if (script === 'free') return later(DemoError('demo_off', 404));
      var steps = b.sb.wa.scripts[script];
      if (!steps || !steps[step] || typeof steps[step].guest !== 'string') return later(DemoError('not_found', 404));
      var m = msg(b, script + ':' + step, 'guest', steps[step].guest);
      if (m) out.push(m);
      var i = step + 1;
      for (; i < steps.length && typeof steps[i].guest !== 'string'; i++) {
        var a = msg(b, script + ':' + i, 'assistant', steps[i].assistant);
        if (a) out.push(a);
      }
      var next = nextGuest(steps, i);
      if (script === 'wa_order' && next === null && m) {
        order(b, { label: 'WhatsApp · ' + steps[0].guest.replace(/^Quiero /, ''), where: 'Para recoger', total: 9600, status: 'pending', src: 'whatsapp', phone: true });
      }
      return later({ ok: true, messages: out, next: next, done: next === null });
    }

    function session(sb, role) {
      var b = box(sb);
      if (b instanceof Error) return later(b);
      return later({ access_token: 'mock', refresh_token: 'mock', device: null, role: role });
    }

    /** What a mock page button does (accept an order, mark it ready, verify a payment, …). */
    function act(sb, what) {
      var b = box(sb);
      if (b instanceof Error) return false;
      var o;
      // The phone guest's own order first: it is the one the guide points at.
      function first(status) {
        var l = b.orders.filter(function (x) { return x.status === status; });
        return l.filter(function (x) { return x.phone; })[0] || l[0];
      }
      if (what === 'accept') {
        o = first('pending');
        if (o) o.status = 'kitchen';
      } else if (what === 'ready') {
        o = first('kitchen');
        if (o) {
          o.status = 'ready';
          if (o.phone) msg(b, 'notify:' + o.id, 'assistant', 'Tu pedido está listo. Ya puedes pasar a recogerlo.');
        } else if (b.seededKitchen) b.seededKitchen--;
      } else if (what === 'verify') {
        var p = b.payments.filter(function (x) { return !x.ok; })[0];
        if (p) { p.ok = true; b.paid += p.total; }
      } else if (what === 'sale') {
        b.paid += 4500;
      } else if (what === 'web_order') {
        order(b, { label: 'Menú web · 1 plato', where: 'Para recoger', total: 5200, status: 'pending', src: 'web' });
      } else if (what === 'table_order') {
        order(b, { label: 'Mesa 4 · 3 productos', where: 'Mesa 4', total: 14800, status: 'kitchen', src: 'mesa' });
        b.payments.push({ label: 'Mesa 4 · QR', total: 14800, ok: false });
      } else if (what === 'ticket') {
        b.paid += 8000;
      } else if (what === 'expire') {
        b.expired = true;
      }
      return true;
    }

    function peek(sb) {
      var b = box(sb);
      return b instanceof Error ? null : { state: state(b), orders: b.orders.slice(), payments: b.payments.slice(), sb: b.sb };
    }

    return {
      name: 'mock',
      mock: true,
      start: start,
      pulse: pulse,
      play: play,
      session: session,
      act: act,
      peek: peek,
      appOrigin: function () { return ''; },
      seatUrl: function () { return ''; },
      guestUrl: function () { return ''; },
      page: mockPage,
    };
  }

  // ---------------------------------------------------------------------------------------------- mock pages --
  // Stand-ins for the app's screens while the backend is the mock: a frame's srcdoc that reads the mock state from
  // the parent (same origin) and posts its buttons back. Never shown on the real backends.

  var PAGE_TITLE = {
    owner: ['Dueño · En vivo', 'Ventas en vivo, informes, inventario, clientes, empleados y configuración.'],
    admin: ['Administrador · En vivo', 'Lo mismo que el dueño para el día a día.'],
    cashier: ['Cajero · Pedidos', 'Cobra, abre y cierra caja, confirma pedidos y pagos.'],
    waiter: ['Mesero · Mesas', 'Sus mesas, sus pedidos y sus ventas del turno.'],
    kitchen: ['Cocina', 'Solo los pedidos que le toca preparar.'],
    bar: ['Barra', 'Solo los pedidos que le toca preparar.'],
    door: ['Puerta', 'Vende y valida entradas y manillas.'],
    site: ['Página web', 'La página de tu negocio.'],
    menu: ['Menú web', 'Tu carta en línea: pide para recoger o delivery.'],
    reserve: ['Reservar', 'Tu cliente elige día, hora y personas.'],
    table: ['Mesa 4', 'Escaneaste el QR de la mesa.'],
    tickets: ['Entradas', 'Compra tu entrada para esta noche.'],
    entry: ['Mi entrada', 'Muestra este código en la puerta.'],
    wristband: ['Mi manilla', 'Tu saldo para la barra.'],
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /* istanbul ignore next: runs inside the frame */
  function pageScript(cfg) {
    var api = parent.MezzitaDemo && parent.MezzitaDemo.__mock;
    var sb = parent.MezzitaDemo && parent.MezzitaDemo.__sandbox;
    var m = document.getElementById('m');
    function bs(c) { return 'Bs ' + Math.round(c / 100).toLocaleString('es-BO'); }
    function li(label, sub, act, btn) {
      return '<li><span><b>' + label + '</b><small>' + sub + '</small></span>' + (act ? '<button data-act="' + act + '">' + btn + '</button>' : '') + '</li>';
    }
    var last = '';
    function draw() {
      var v = api && sb && api.peek(sb);
      if (!v) { m.innerHTML = '<p class="empty">Esta demo se cerró.</p>'; return; }
      var s = v.state, k = cfg.kind, h = '';
      var kpis = '<div class="kpis"><div><b>' + bs(s.paid_today_cents) + '</b><span>vendido hoy</span></div><div><b>' + s.pending +
        '</b><span>por confirmar</span></div><div><b>' + s.in_kitchen + '</b><span>en cocina</span></div><div><b>' + s.open_tables + '</b><span>mesas abiertas</span></div></div>';
      var pend = v.orders.filter(function (o) { return o.status === 'pending'; });
      var kit = v.orders.filter(function (o) { return o.status === 'kitchen'; });
      var pays = v.payments.filter(function (p) { return !p.ok; });
      if (k === 'owner' || k === 'admin') {
        var st = { pending: 'por confirmar', kitchen: 'en cocina', ready: 'listo' };
        h = kpis + '<h2>Últimos pedidos</h2><ul>' + v.orders.slice(-5).reverse().map(function (o) { return li(o.label, o.where + ' · ' + bs(o.total) + ' · ' + (st[o.status] || o.status)); }).join('') + '</ul>';
      } else if (k === 'cashier') {
        h = kpis + '<h2>Pedidos por confirmar</h2><ul>' + (pend.map(function (o) { return li(o.label, o.where + ' · ' + bs(o.total), 'accept', 'Aceptar'); }).join('') || '<li class="empty">Nada por confirmar</li>') +
          '</ul><h2>Pagos por verificar</h2><ul>' + (pays.map(function (p) { return li(p.label, bs(p.total), 'verify', 'Confirmar pago'); }).join('') || '<li class="empty">Nada por verificar</li>') +
          '</ul><p><button data-act="sale">Cobrar una venta</button></p>';
      } else if (k === 'kitchen' || k === 'bar') {
        h = '<h2>En preparación</h2><ul>' + kit.map(function (o) { return li(o.label, o.where, 'ready', 'Listo'); }).join('') +
          (s.in_kitchen - kit.length > 0 ? li('Mesa 7 · 2 productos', 'En el salón', 'ready', 'Listo') : '') + '</ul>';
      } else if (k === 'waiter') {
        h = '<h2>Mis mesas</h2><ul>' + li('Mesa 4', s.open_tables ? 'Ocupada' : 'Libre') + li('Mesa 7', 'Pidió la cuenta') + '</ul>';
      } else if (k === 'door') {
        h = '<p><button data-act="checkin">Validar entrada</button></p>';
      } else if (k === 'menu' || k === 'reserve') {
        h = '<ul>' + li('Plato del día', 'Bs 48', 'web_order', 'Pedir') + li('Postre de la casa', 'Bs 22', 'web_order', 'Pedir') + '</ul>';
      } else if (k === 'table') {
        h = '<p><button data-act="table_order">Pedir y pagar con QR</button></p>';
      } else if (k === 'tickets') {
        h = '<p><button data-act="ticket">Comprar entrada</button></p>';
      } else {
        h = '<p class="empty">' + (v.sb.org.name) + '</p>';
      }
      if (h !== last) { m.innerHTML = h; last = h; }
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b && api) { api.act(sb, b.getAttribute('data-act')); draw(); }
    });
    draw();
    setInterval(draw, 800);
  }

  var PAGE_CSS = 'body{margin:0;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;background:#F7F7F4;color:#15171C}' +
    'header{padding:18px 18px 10px;background:#fff;border-bottom:1px solid #e3e3de}header small{color:#7A7F86;font-size:12px}' +
    'h1{margin:4px 0 2px;font-size:20px}header p{margin:0;color:#4B5057;font-size:13px}main{padding:14px 18px}' +
    'h2{font-size:14px;margin:18px 0 8px;color:#4B5057}ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}' +
    'li{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid #e3e3de;border-radius:12px;padding:10px 12px}' +
    'li span{display:grid}li small{color:#7A7F86;font-size:12px}button{font:600 14px system-ui;border:0;border-radius:10px;background:#DA291C;color:#fff;padding:10px 14px;min-height:44px;cursor:pointer}' +
    '.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}.kpis div{background:#fff;border:1px solid #e3e3de;border-radius:12px;padding:10px 12px}' +
    '.kpis b{display:block;font-size:18px}.kpis span{font-size:12px;color:#7A7F86}.empty{color:#7A7F86;justify-content:center}';

  function mockPage(kind, sb) {
    var t = PAGE_TITLE[kind] || [kind, ''];
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>' + PAGE_CSS + '</style></head><body><header><small>Vista de ejemplo sin conexión · ' + esc(sb.org.name) + '</small><h1>' +
      esc(t[0]) + '</h1><p>' + esc(t[1]) + '</p></header><main id="m"></main><script>(' + pageScript.toString() + ')(' +
      JSON.stringify({ kind: kind }) + ')<\/script></body></html>';
  }

  // ------------------------------------------------------------------------------------------------------ client --

  function client(name, opts) {
    var n = name && usable(name) ? name : DEFAULT_BACKEND;
    return n === 'mock' ? mock(opts) : remote(n);
  }

  return {
    DEFAULT_BACKEND: DEFAULT_BACKEND,
    BACKENDS: BACKENDS,
    MESSAGES: MESSAGES,
    PLANS: PLANS,
    TEMPLATES: TEMPLATES,
    DemoError: DemoError,
    codeFor: codeFor,
    usable: usable,
    pickBackend: pickBackend,
    nextGuest: nextGuest,
    client: client,
    mock: mock,
  };
});
