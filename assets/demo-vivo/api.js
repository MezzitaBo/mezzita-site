/* Mezzita · demo vivo · api.js
   The four calls of docs/demo-vivo.md §3 as built by L2 (demo-start, demo-pulse, demo-session) and L3 (demo-play),
   after owner decision D2 (no AI: 12 scripted WhatsApp conversations the shell plays beat by beat), and a mock that
   answers with the same shapes. The backend comes from ?backend=mock|staging|demo (allow-list), else DEFAULT_BACKEND.
   Shapes: side-session notes demo-l2.md, demo-l3.md and demo-whatsapp-addendum.md. Internal text in English; what a
   visitor reads, Spanish. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.MezzitaDemo = root.MezzitaDemo || {}).api = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  // Build constant. Switch to 'demo' once the mezzita-demo project exists (owner decision 1), or to 'staging' for
  // the interim launch, when demo-start/pulse/play are deployed there.
  var DEFAULT_BACKEND = 'mock';
  // site: the demo venue websites (demo-sites-design.md §6, sitios.mezzita.com); '' = not deployed for that backend
  // yet, and the guest layers fall back to the app's own guest pages (/m/, /mesa/, /e/). demo-start's links.site wins.
  var BACKENDS = {
    mock: { functions: '', app: '', site: '' },
    staging: {
      functions: 'https://pnkfxemhzswcbfygvfzf.supabase.co/functions/v1',
      app: 'https://mezzita-app-staging.rbrunocardona.workers.dev',
      site: '',
    },
    // Functions URL is set when the owner creates the mezzita-demo project; until then ?backend=demo is refused.
    demo: { functions: '', app: 'https://demo.mezzita.com', site: 'https://sitios.mezzita.com' },
  };

  // What the visitor reads for each error code of L2 and L3 (demo-l2.md, demo-l3.md).
  var CLOSED = 'Tu demo se cerró por inactividad.';
  var OFF = 'La demo no está disponible en este momento.';
  var MESSAGES = {
    demo_key: CLOSED, bad_key: CLOSED, demo_expired: CLOSED, sandbox_expired: CLOSED, sandbox_not_found: CLOSED,
    demo_disabled: OFF, template_not_found: OFF, demo_off: OFF,
    rate_limited: 'Abriste muchas demos seguidas. Prueba en unos minutos.',
    demo_full: 'Hay muchas demos abiertas. Prueba en un minuto.',
    network: 'No pudimos conectar con la demo. Revisa tu conexión y prueba de nuevo.',
    unknown: 'Algo falló al abrir la demo. Prueba de nuevo.',
  };
  // demo-play's own refusals: the timeline handles them, the visitor never reads them.
  var PLAY_CODES = ['beat_out_of_order', 'conversation_stopped', 'beat_running', 'beat_failed', 'module_off', 'beat_unknown',
    'no_entry', 'no_wristband', 'step_error', 'invalid_fields'];
  var EXPIRED = ['demo_key', 'bad_key', 'demo_expired', 'sandbox_expired', 'sandbox_not_found'];
  var BY_STATUS = { 403: 'demo_key', 404: 'demo_disabled', 410: 'demo_expired', 429: 'rate_limited', 503: 'demo_full' };

  function DemoError(code, status) {
    var known = Boolean(MESSAGES[code]) || PLAY_CODES.indexOf(code) >= 0;
    var e = new Error(MESSAGES[code] || MESSAGES.unknown);
    e.name = 'DemoError';
    e.code = known ? code : 'unknown';
    e.status = status || 0;
    e.expired = EXPIRED.indexOf(e.code) >= 0;
    return e;
  }

  function codeFor(status, body) {
    var c = body && typeof body.error === 'string' ? body.error : '';
    if (MESSAGES[c] || PLAY_CODES.indexOf(c) >= 0) return c;
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

  /** demo-start's plan may come as a key or as {key, name, price_cents}; the shell works with the key. */
  function planKey(sb) { return sb && sb.plan && typeof sb.plan === 'object' ? sb.plan.key : sb && sb.plan; }

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
    // links.app comes from a secret on the backend and may be null: fall back to this backend's app.
    function app(sb) { return (sb && sb.links && sb.links.app) || cfg.app; }
    return {
      name: name,
      mock: false,
      start: function (p) {
        return call('start', { template: p.template, plan: p.plan, venues: p.venues, name: p.name || null }, 20000);
      },
      /** o: {conv, cursor}: the state counters, the 12 conversations' progress and conversation `conv`'s messages. */
      pulse: function (sb, o) {
        o = o || {};
        return call('pulse', { sandbox: sb.sandbox, key: sb.key, conv: o.conv || 1, cursor: o.cursor || null });
      },
      /** body: {conv, beat} | {script: 'ambient', event} | {script: 'door_checkin'} | {script: 'wristband', step}. */
      play: function (sb, body) {
        return call('play', Object.assign({ sandbox: sb.sandbox, key: sb.key }, body), 20000);
      },
      session: function (sb, role) { return call('session', { sandbox: sb.sandbox, key: sb.key, role: role }); },
      appOrigin: function (sb) {
        try { return new URL(app(sb)).origin; } catch (e) { return ''; }
      },
      seatUrl: function (sb, role) { return app(sb) + '/demo/entrar' + seatHash(sb, role); },
      guestUrl: function (sb, path) { return /^https?:/.test(path) ? path : app(sb) + path; },
      siteOrigin: function (sb) { return (sb && sb.links && sb.links.site) || cfg.site || ''; },
    };
  }

  // ------------------------------------------------------------------------------------------------------ mock --
  // Same shapes as the real functions, in memory. Module entitlement copies the plan_features seed of
  // 20261112002300_venue_settings.sql so locked items and their cheapest plan behave as on staging; plan names and
  // prices follow the owner's decisions (Noche: Bs 1.500).

  var PLANS = [
    { key: 'arranca', name: 'Arranca', price_cents: 40000 },
    { key: 'crece', name: 'Crece', price_cents: 60000 },
    { key: 'escala', name: 'Escala', price_cents: 90000 },
    { key: 'nightlife', name: 'Noche', price_cents: 150000 },
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
  // product: what the guests of the 12 conversations order; delivery: the template has delivery zones; night:
  // orders are to have in the venue and questions are about tonight.
  var TEMPLATES = {
    cafe: { label: 'Restaurante pequeño o café', venue: 'La Mesa Chica', bar: false, extra: ['tables', 'inventory'], product: '2 cafés con leche y 2 sándwiches de jamón', total: 78 },
    restaurante: { label: 'Restaurante con salón', venue: 'Casa Brasa', bar: true, extra: ['tables', 'reservations', 'inventory'], product: '2 almuerzos del día', total: 96, delivery: true },
    pizzeria: { label: 'Pizzería', venue: 'Pizzería La Esquina', bar: false, extra: ['tables', 'reservations', 'inventory'], product: '2 pizzas margarita familiares', total: 136, delivery: true },
    foodtruck: { label: 'Food truck', venue: 'Rueda Burger', bar: false, extra: ['inventory'], product: '2 combos clásicos', total: 84 },
    heladeria: { label: 'Heladería', venue: 'Heladería Copo', bar: false, extra: ['tables', 'inventory'], product: 'un pote de medio litro, chocolate y frutilla', total: 45 },
    bar: { label: 'Bar o pub', venue: 'Bar El Farol', bar: true, extra: ['tables', 'reservations', 'inventory', 'events', 'door'], product: 'una jarra de cerveza y una tabla para 4', total: 160, night: true },
    discoteca: { label: 'Discoteca o boliche', venue: 'Club Órbita', bar: true, extra: ['tables', 'inventory', 'events', 'door', 'wristbands'], product: 'una botella y 4 gaseosas para la mesa', total: 420, night: true },
    eventos: { label: 'Eventos y productoras', venue: 'Altura Eventos', bar: true, extra: ['inventory', 'events', 'door', 'wristbands'], product: 'un combo de 4 tragos en la barra', total: 140, night: true },
  };
  var STAFF = { owner: 'Lucía Rojas', admin: 'Marco Vargas', cashier: 'Ana Quispe', waiter: 'Diego Mamani', kitchen: 'Rosa Choque', bar: 'Javier Flores', door: 'Pablo Gutiérrez' };
  var KINDS = ['order_pickup', 'question', 'order_delivery', 'reservation', 'order_qr', 'handoff', 'order_pickup', 'not_relevant', 'order_delivery', 'question', 'reservation', 'order_here'];
  var STARTS = [8, 35, 60, 85, 110, 140, 170, 200, 230, 260, 290, 320];
  var GUESTS = ['Carla M.', 'Jorge P.', 'Lucía R.', 'Andrés V.', 'María F.', 'Pablo C.', 'Daniela S.', 'Servicios Alfa', 'Rodrigo A.', 'Sofía T.', 'Gabriel N.', 'Valeria Q.'];

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

  /** The 12 live conversations of a mock sandbox, with texts (the server's side). */
  function mockLive(t, plan) {
    var reservations = planHas(plan, 'reservations');
    return KINDS.map(function (kind, i) {
      if (kind === 'order_delivery' && !t.delivery) kind = t.night ? 'order_here' : 'order_pickup';
      if (t.night && kind === 'order_pickup') kind = 'order_here';
      var conv = i + 1, b = [];
      var g = function (after, text) { b.push({ after_s: after, type: 'guest', text: text }); };
      var a = function (after, text, did) { b.push({ after_s: after, type: 'assistant', text: text, did: did }); };
      var s = function (after, action, hold, extra) { b.push({ after_s: after, type: 'staff', action: action, hold_s: hold || 0, notice: extra }); };
      if (kind.indexOf('order_') === 0) {
        g(0, t.night ? 'Hola, ¿esta noche abren?' : 'Hola, ¿están atendiendo?');
        a(2.5, t.night ? '¡Hola! Sí, desde las 22:00. ¿Qué te preparamos?' : '¡Hola! Sí. ¿Qué te gustaría pedir?');
        g(4, 'Quiero ' + t.product);
        a(3, kind === 'order_delivery' ? 'Anotado. ¿A qué dirección te lo mandamos?' : kind === 'order_here' ? 'Anotado. ¿Para la mesa?' :
          kind === 'order_qr' ? 'Anotado. ¿Lo pagas con QR desde aquí?' : 'Anotado. ¿Pasas a recoger?');
        g(4, kind === 'order_delivery' ? 'A la calle Sucre 245, por favor' : kind === 'order_here' ? 'Sí, mesa 6' : kind === 'order_qr' ? 'Sí, con QR' : 'Paso en 20 minutos');
        a(2.5, 'Tu pedido: ' + t.product + '. Total Bs ' + t.total + '. ¿Confirmas?');
        g(4, 'Sí, confirmo');
        a(2, 'Listo, tu pedido es el #' + (120 + conv) + '. Te aviso por aquí cuando esté listo.', 'order');
        if (kind === 'order_qr') {
          a(2, 'Paga aquí con QR: https://demo.mezzita.com/pedido/' + (120 + conv) + '?t=demo');
          s(15, 'pay', 0, null);
        } else s(0, 'approve', conv === 1 ? 40 : 20, 'Tu pedido fue aceptado. Ya lo estamos preparando.');
        s(10, 'prepare');
        s(35, 'ready', 20, kind === 'order_delivery' ? null : 'Tu pedido está listo.');
        if (kind === 'order_delivery') { s(25, 'dispatch', 0, 'Tu pedido va en camino.'); s(45, 'pay'); }
        else { s(30, 'hand_over'); if (kind !== 'order_qr') s(0, 'pay'); }
      } else if (kind === 'question') {
        g(0, conv === 2 ? 'Hola, ¿hasta qué hora atienden hoy?' : 'Hola, ¿cuánto cuesta el envío a Sopocachi?');
        a(2.5, conv === 2 ? 'Hoy hasta las 23:00. Aquí está la carta: https://demo.mezzita.com/m/carta' : 'El envío a esa zona cuesta Bs 10. ¿Te ayudo con un pedido?');
        g(4, '¡Gracias!');
        a(2, '¡A ti! Te esperamos.');
        s(30, 'close_chat');
      } else if (kind === 'reservation') {
        g(0, t.night ? 'Hola, ¿tienen mesa VIP para el sábado?' : 'Hola, ¿puedo reservar para 4 mañana a las 20:00?');
        if (reservations) {
          a(2.5, '¡Claro! ¿A nombre de quién?');
          g(4, 'A nombre de ' + GUESTS[i].split(' ')[0]);
          a(2, 'Listo, reservado a nombre de ' + GUESTS[i].split(' ')[0] + '. Te esperamos.', 'reservation');
        } else {
          a(2.5, 'Por este canal no tomamos reservas, pero aquí está la carta: https://demo.mezzita.com/m/carta');
        }
        s(30, 'close_chat');
      } else if (kind === 'handoff') {
        g(0, 'Hola, quiero hacer un pedido grande para un evento de mi empresa');
        a(2.5, 'Te paso con una persona del equipo para coordinarlo.', 'handoff');
      } else {
        g(0, 'Buenas, ofrecemos servicio de publicidad para restaurantes, ¿con quién hablo?');
        a(2.5, 'Gracias por escribir. Lo pasamos al equipo.');
        s(20, 'not_relevant');
      }
      return { conv: conv, kind: kind, guest_name: GUESTS[i], start_s: STARTS[i], no_module: kind === 'reservation' && !reservations, beats: b };
    });
  }

  var ACTOR = { approve: 'cashier', dispatch: 'cashier', hand_over: 'cashier', pay: 'cashier', prepare: 'kitchen', ready: 'kitchen', close_chat: 'admin', not_relevant: 'admin' };

  function mock(opts) {
    opts = opts || {};
    var delay = opts.delay == null ? 700 : opts.delay;
    var now = opts.now || function () { return Date.now(); };
    var boxes = {};

    function later(v) {
      return new Promise(function (res, rej) {
        setTimeout(function () { v instanceof Error ? rej(v) : res(v); }, delay ? Math.min(delay, 200) : 0);
      });
    }
    function box(sb) {
      var b = sb && boxes[sb.sandbox];
      if (!b || b.key !== sb.key) return DemoError('demo_key', 403);
      if (b.expired || now() > Date.parse(b.expires_at)) return DemoError('demo_expired', 410);
      return b;
    }
    function iso(ms) { return new Date(ms).toISOString(); }
    function msg(b, conv, id, from, text) {
      var list = b.msgs[conv] || (b.msgs[conv] = []);
      if (list.some(function (m) { return m.id === id; })) return null;
      var m = { id: id, from: from, text: text, at: iso(now()) };
      list.push(m);
      var c = b.chats[conv];
      if (c) c.last_at = m.at;
      return m;
    }
    function orderOf(b, conv) { return b.orders.filter(function (o) { return o.conv === conv; })[0]; }
    function state(b) {
      var o = b.orders;
      return {
        pending: o.filter(function (x) { return !x.approved; }).length,
        to_verify: b.toVerify,
        in_kitchen: o.filter(function (x) { return x.approved && !x.ready; }).length + b.seededKitchen,
        ready: o.filter(function (x) { return x.ready && !x.out; }).length,
        paid_today_cents: b.paid,
        open_tables: b.openTables,
      };
    }
    function stage(b, conv, st) { if (b.chats[conv]) b.chats[conv].stage = st; }

    function start(p) {
      var t = TEMPLATES[p.template];
      if (!t) return later(DemoError('template_not_found', 404));
      if (!PLAN_FEATURES[p.plan]) return later(DemoError('unknown', 400));
      var venues = Math.max(1, Math.min(3, Number(p.venues) || 1));
      var name = (p.name && String(p.name).trim()) || t.venue;
      var id = 'mock-' + rid(10);
      var key = rid(43);
      var slug = slugify(name) + '-' + rid(4);
      var modules = {};
      COMMON.concat(t.extra).forEach(function (m) { modules[m] = { on: planHas(p.plan, m), plan: cheapestPlan(m) }; });
      var roles = ['owner', 'admin', 'cashier', 'waiter', 'kitchen'];
      if (t.bar) roles.push('bar');
      if (modules.door && modules.door.on) roles.push('door');
      var venueList = [];
      for (var v = 0; v < venues; v++) {
        venueList.push({ id: id + '-v' + v, slug: v ? 'local-' + (v + 1) : 'centro', name: v ? name + ' · ' + ['', 'Norte', 'Sur'][v] : name });
      }
      var links = { app: null, menu: '/m/' + slug + '/centro' };
      if (modules.reservations && modules.reservations.on) links.reserve = links.menu + '?reservar=1';
      if (modules.tables && modules.tables.on) links.table = '/mesa/' + rid(12);
      if (modules.events && modules.events.on) links.event = '/e/' + slug + '/centro/esta-noche';
      if (modules.door && modules.door.on) links.entry = '/entrada/' + rid(12);
      if (modules.wristbands && modules.wristbands.on) links.wristband = '/manilla/' + rid(12);
      var live = mockLive(t, p.plan);
      var sb = {
        sandbox: id, key: key, expires_at: iso(now() + 4 * 3600e3),
        template: p.template, label: t.label, plan: p.plan, plans: PLANS.slice(),
        org: { id: id + '-org', slug: slug, name: name },
        venues: venueList, modules: modules, has_bar: t.bar,
        seats: roles.map(function (r) { return { role: r, name: STAFF[r] }; }),
        links: links,
        wa_timeline: live.map(function (c) {
          return {
            conv: c.conv, kind: c.kind, guest_name: c.guest_name, start_s: c.start_s,
            no_module: Boolean(c.no_module),
            beats: c.beats.map(function (x) {
              var o = { after_s: x.after_s, type: x.type };
              if (x.hold_s) o.hold_s = x.hold_s;
              if (x.action) o.action = x.action;
              return o;
            }),
          };
        }),
        ambient_timeline: [{ event: 0, kind: 'order', after_s: 20 }, { event: 1, kind: 'reservation', after_s: 90 }, { event: 2, kind: 'waiter_call', after_s: 160 }],
      };
      boxes[id] = {
        key: key, sb: sb, live: live, expires_at: sb.expires_at, expired: false, msgs: {}, chats: {}, done: {}, stopped: [],
        stored: {}, orders: [], paid: 412000 + Math.floor(Math.random() * 90) * 1000, toVerify: 1,
        openTables: modules.tables && modules.tables.on ? 5 : 0, seededKitchen: 3, ambient: {},
        waOff: false,
      };
      return new Promise(function (res) { setTimeout(function () { res(JSON.parse(JSON.stringify(sb))); }, delay); });
    }

    function pulse(sb, o) {
      o = o || {};
      var b = box(sb);
      if (b instanceof Error) return later(b);
      b.expires_at = iso(Math.min(now() + 4 * 3600e3, Date.parse(b.sb.expires_at) + 20 * 3600e3));
      var conv = Number(o.conv) || 1;
      var list = b.msgs[conv] || [];
      var from = o.cursor ? Number(o.cursor) || 0 : 0;
      var chats = Object.keys(b.chats).map(function (k) { return Object.assign({}, b.chats[k]); });
      return later({
        expires_at: b.expires_at, state: state(b),
        wa: { done: Object.assign({}, b.done), stopped: b.stopped.slice(), chats: chats, conv: conv, messages: list.slice(from), cursor: String(list.length) },
      });
    }

    function beat(b, c, n) {
      var x = c.beats[n], conv = c.conv, did = [], out = [], m;
      var id = 'demo.' + b.sb.sandbox + '.' + conv + '.' + n;
      var o = orderOf(b, conv);
      if (x.type === 'guest') {
        if (!b.chats[conv]) {
          b.chats[conv] = { conv: conv, guest_name: c.guest_name, stage: 'nuevo', last_at: null };
          did.push({ actor: 'guest', action: 'new_chat' });
        } else if (b.chats[conv].stage === 'nuevo') stage(b, conv, 'conversando');
        m = msg(b, conv, id, 'guest', x.text);
      } else if (x.type === 'assistant') {
        m = msg(b, conv, id, 'assistant', x.text);
        if (x.did === 'order') {
          b.orders.push({ conv: conv, number: 120 + conv, total: (TEMPLATES[b.sb.template] || {}).total * 100 || 9600, approved: false, ready: false, out: false, paid: false });
          stage(b, conv, 'pedido');
          did.push({ actor: 'assistant', action: 'order', ticket_number: 120 + conv });
        } else if (x.did === 'reservation') did.push({ actor: 'assistant', action: 'reservation' });
        else if (x.did === 'handoff') { stage(b, conv, 'conversando'); did.push({ actor: 'assistant', action: 'handoff' }); }
      } else {
        var skipped = false;
        if (x.action === 'approve') { if (o.approved) skipped = true; else o.approved = true; }
        else if (x.action === 'prepare') { if (o.ready) skipped = true; }
        else if (x.action === 'ready') { if (o.ready) skipped = true; else { o.ready = true; stage(b, conv, 'listo'); } }
        else if (x.action === 'dispatch') { o.out = true; stage(b, conv, 'en_camino'); }
        else if (x.action === 'hand_over') { o.out = true; if (o.paid) stage(b, conv, 'entregado'); }
        else if (x.action === 'pay') {
          if (o.paid) skipped = true;
          else { o.paid = true; b.paid += o.total; if (c.kind === 'order_qr') o.approved = true; if (o.out || c.kind !== 'order_qr') stage(b, conv, o.out ? 'entregado' : b.chats[conv].stage); }
        } else if (x.action === 'close_chat') stage(b, conv, 'cerrado');
        else if (x.action === 'not_relevant') stage(b, conv, 'no_relevante');
        if (!skipped) {
          did.push({ actor: x.action === 'ready' || x.action === 'prepare' ? (b.sb.has_bar ? 'kitchen_bar' : 'kitchen') : ACTOR[x.action], action: x.action, ticket_number: o ? o.number : undefined });
          if (x.notice) m = msg(b, conv, id + '.n', 'assistant', x.notice);
        }
      }
      if (m) out.push(m);
      return { ok: true, script: 'conv', conv: conv, beat: n, next: n + 1 < c.beats.length ? n + 1 : null, done: n + 1 >= c.beats.length, stopped: false, messages: out, did: did };
    }

    function play(sb, body) {
      var b = box(sb);
      if (b instanceof Error) return later(b);
      body = body || {};
      if (body.script === 'ambient') {
        var ev = b.sb.ambient_timeline.filter(function (x) { return x.event === body.event; })[0];
        if (!ev) return later(DemoError('beat_unknown', 404));
        if (!b.ambient[body.event]) {
          b.ambient[body.event] = true;
          if (ev.kind === 'order') b.seededKitchen++;
        }
        return later({ ok: true, script: 'ambient', messages: [], did: [{ actor: 'guest', action: ev.kind === 'order' ? 'web_order' : ev.kind === 'reservation' ? 'web_reservation' : 'waiter_call' }] });
      }
      if (body.script === 'door_checkin') return later({ ok: true, script: 'door_checkin', messages: [], did: [{ actor: 'door', action: 'check_in' }] });
      if (body.script === 'wristband') {
        b.paid += body.step ? 3000 : 0;
        return later({ ok: true, script: 'wristband', messages: [], did: [body.step ? { actor: 'bar', action: 'charge' } : { actor: 'door', action: 'topup' }] });
      }
      var conv = Number(body.conv), n = Number(body.beat);
      var c = b.live[conv - 1];
      if (!c || !(n >= 0) || n >= c.beats.length) return later(DemoError('beat_unknown', 404));
      if (b.waOff) return later(DemoError('module_off', 409));
      var key = conv + ':' + n;
      if (b.stored[key]) return later(JSON.parse(JSON.stringify(b.stored[key])));
      if (b.stopped.indexOf(conv) >= 0) return later(DemoError('conversation_stopped', 409));
      var last = b.done[conv] == null ? -1 : b.done[conv];
      if (n !== last + 1) return later(DemoError('beat_out_of_order', 409));
      var r = beat(b, c, n);
      b.done[conv] = n;
      b.stored[key] = r;
      return later(JSON.parse(JSON.stringify(r)));
    }

    function session(sb, role) {
      var b = box(sb);
      if (b instanceof Error) return later(b);
      return later({ access_token: 'mock', refresh_token: 'mock', device: null, role: role });
    }

    /** What a mock page button does (the visitor acting as staff): the script's later beat then skips. */
    function act(sb, what) {
      var b = box(sb);
      if (b instanceof Error) return false;
      function first(test) {
        var l = b.orders.filter(test);
        return l.filter(function (x) { return x.conv === 1; })[0] || l[0];
      }
      var o;
      if (what === 'accept') {
        o = first(function (x) { return !x.approved; });
        if (o) {
          o.approved = true;
          msg(b, o.conv, 'staff.' + o.number + '.approve', 'assistant', 'Tu pedido fue aceptado. Ya lo estamos preparando.');
        }
      } else if (what === 'ready') {
        o = first(function (x) { return x.approved && !x.ready; });
        if (o) {
          o.ready = true;
          stage(b, o.conv, 'listo');
          msg(b, o.conv, 'staff.' + o.number + '.ready', 'assistant', 'Tu pedido está listo.');
        } else if (b.seededKitchen) b.seededKitchen--;
      } else if (what === 'verify') {
        if (b.toVerify) { b.toVerify--; b.paid += 12400; }
      } else if (what === 'sale') {
        b.paid += 4500;
      } else if (what === 'web_order') {
        b.seededKitchen++;
      } else if (what === 'table_order') {
        b.seededKitchen++;
        b.toVerify++;
      } else if (what === 'ticket') {
        b.paid += 8000;
      } else if (what === 'expire') {
        b.expired = true;
      } else if (what === 'wa_off') {
        b.waOff = true;
      } else if (what === 'wa_on') {
        b.waOff = false;
      }
      return true;
    }

    function peek(sb) {
      var b = box(sb);
      if (b instanceof Error) return null;
      return {
        state: state(b), sb: b.sb, orders: b.orders.slice(),
        chats: Object.keys(b.chats).map(function (k) { return b.chats[k]; }),
      };
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
      siteOrigin: function () { return ''; },
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
    menu: ['Menú y pedido', 'La carta del local con su carrito: pide para recoger o delivery.'],
    reserve: ['Reservar', 'Tu cliente elige día, hora y personas.'],
    table: ['Mesa 4', 'Escaneaste el QR de la mesa.'],
    tickets: ['Entradas', 'Compra tu entrada para esta noche.'],
    entry: ['Mi entrada', 'Muestra este código en la puerta.'],
    wristband: ['Mi manilla', 'Tu saldo para la barra.'],
    link: ['Enlace del chat', 'La página que abrió tu cliente desde WhatsApp.'],
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
    var COLS = [['nuevo', 'Nuevo lead'], ['conversando', 'En conversación'], ['pedido', 'Pedido en curso'], ['listo', 'Pedido listo'], ['en_camino', 'En camino'], ['entregado', 'Entregado'], ['cerrado', 'Cerrado']];
    var last = '';
    function draw() {
      var v = api && sb && api.peek(sb);
      if (!v) { m.innerHTML = '<p class="empty">Tu demo se cerró.</p>'; return; }
      var s = v.state, k = cfg.kind, h = '';
      var kpis = '<div class="kpis"><div><b>' + bs(s.paid_today_cents) + '</b><span>vendido hoy</span></div><div><b>' + s.pending +
        '</b><span>por confirmar</span></div><div><b>' + s.in_kitchen + '</b><span>en cocina</span></div><div><b>' + s.open_tables + '</b><span>mesas abiertas</span></div></div>';
      var board = '<h2>WhatsApp · tablero</h2><div class="board">' + COLS.map(function (c) {
        var cards = v.chats.filter(function (x) { return x.stage === c[0]; });
        return '<div class="col"><p>' + c[1] + ' <i>' + cards.length + '</i></p>' + cards.map(function (x) { return '<span>' + x.guest_name + '</span>'; }).join('') + '</div>';
      }).join('') + '</div>';
      var pend = v.orders.filter(function (o) { return !o.approved; });
      var kit = v.orders.filter(function (o) { return o.approved && !o.ready; });
      if (k === 'owner' || k === 'admin') {
        h = kpis + board;
      } else if (k === 'cashier') {
        h = kpis + '<h2>Pedidos por confirmar</h2><ul>' + (pend.map(function (o) { return li('Pedido #' + o.number, 'WhatsApp · ' + bs(o.total), 'accept', 'Aceptar'); }).join('') || '<li class="empty">Nada por confirmar</li>') +
          '</ul><h2>Pagos por verificar</h2><ul>' + (s.to_verify ? li('Mesa 2 · QR', 'Bs 124', 'verify', 'Confirmar pago') : '<li class="empty">Nada por verificar</li>') +
          '</ul><p><button data-act="sale">Cobrar una venta</button></p>' + board;
      } else if (k === 'kitchen' || k === 'bar') {
        h = '<h2>En preparación</h2><ul>' + kit.map(function (o) { return li('Pedido #' + o.number, 'WhatsApp', 'ready', 'Listo'); }).join('') +
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
        h = '<p class="empty">' + v.sb.org.name + '</p>';
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
    '.kpis b{display:block;font-size:18px}.kpis span{font-size:12px;color:#7A7F86}.empty{color:#7A7F86;justify-content:center}' +
    '.board{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}.col{background:#EFEDE6;border-radius:10px;padding:8px;min-height:70px;display:grid;align-content:start;gap:6px}' +
    '.col p{margin:0;font:600 11.5px system-ui;color:#4B5057}.col i{font-style:normal;color:#7A7F86}.col span{background:#fff;border-radius:8px;padding:6px 8px;font-size:12.5px;box-shadow:0 1px 1px rgba(0,0,0,.06)}';

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
    planKey: planKey,
    client: client,
    mock: mock,
  };
});
