/* Mezzita · demo en vivo: la página web propia del negocio de ejemplo (/demo/sitio/, docs/demo-vivo.md §7 L7).
   Lee la carta en vivo con la RPC pública public_menu del backend del demo y arma el sitio del local con su nombre,
   su color y su tipografía: portada, horario, dirección, seis platos y los botones a las páginas reales del local.
   Parámetros: ?org=<slug>&venue=<slug>&tpl=<plantilla>&evento=<slug>&look=calido|nocturno|claro&backend=mock|staging|demo
   (el shell del demo los arma con lo que devuelve demo-start). Sin org/venue o con backend=mock usa datos de ejemplo. */
(function () {
  'use strict';

  // Lo público de cada backend (la clave publicable va en el JS de la app de todos modos). El de demo se completa
  // cuando exista el proyecto mezzita-demo; hasta entonces ?backend=demo cae al ejemplo.
  var DEFAULT_BACKEND = 'mock';
  var BACKENDS = {
    mock: { url: '', key: '', app: '' },
    staging: {
      url: 'https://pnkfxemhzswcbfygvfzf.supabase.co',
      key: 'sb_publishable_KsiDrms-z9ympnBh1NewtA_wpqGAFg4',
      app: 'https://mezzita-app-staging.rbrunocardona.workers.dev'
    },
    demo: { url: '', key: '', app: 'https://demo.mezzita.com' }
  };

  var TEMPLATES = ['cafe', 'restaurante', 'pizzeria', 'foodtruck', 'heladeria', 'bar', 'discoteca', 'eventos'];
  var LOOKS = ['calido', 'nocturno', 'claro'];
  var LOOK_OF = { restaurante: 'calido', pizzeria: 'calido', bar: 'nocturno', discoteca: 'nocturno', eventos: 'nocturno', cafe: 'claro', heladeria: 'claro', foodtruck: 'claro' };
  // Colores de acento del panel (apps/pos/src/lib/theme.ts): claro para fondos claros, oscuro para el nocturno.
  var SWATCHES = {
    amber: ['#f5af20', '#fdba2f'], terracotta: ['#b4472b', '#f0997e'], wine: ['#8f2346', '#ef8fae'],
    violet: ['#6b3fcf', '#b9a2ff'], blue: ['#1f5fcc', '#86b4ff'], teal: ['#0e7068', '#5fd0c4'],
    green: ['#1d7a45', '#6fd69a'], graphite: ['#383d45', '#d5d9df']
  };
  var FONTS = {
    neutral: null,
    elegant: ['Cormorant Garamond', 'Cormorant+Garamond:wght@500;600;700', 'Georgia, serif'],
    classic: ['Playfair Display', 'Playfair+Display:wght@500;700;800', 'Georgia, serif'],
    modern: ['Bricolage Grotesque', null, 'system-ui, sans-serif'],
    friendly: ['Nunito', 'Nunito:wght@600;700;800', 'ui-rounded, system-ui, sans-serif'],
    bold: ['Oswald', 'Oswald:wght@500;600;700', '"Arial Narrow", sans-serif']
  };
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var WEEK = [1, 2, 3, 4, 5, 6, 0];
  var SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

  var root = document.getElementById('mzs');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var param = function (k) { var v = (q.get(k) || '').toLowerCase(); return SLUG.test(v) ? v : ''; };

  var org = param('org'), venue = param('venue'), evento = param('evento');
  var tpl = TEMPLATES.indexOf(param('tpl')) !== -1 ? param('tpl') : '';
  var bname = param('backend');
  var usable = function (n) { var b = BACKENDS[n]; return b && (n === 'mock' || (b.url && b.key)); };
  var backendName = usable(bname) ? bname : DEFAULT_BACKEND;
  if (!org || !venue) backendName = 'mock';
  var B = BACKENDS[backendName];
  var mock = backendName === 'mock';

  /* ---------------------------------------------------------- utilidades */
  function money(cents) {
    var n = Math.round(cents) / 100, whole = Math.floor(n), dec = Math.round((n - whole) * 100);
    var s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'Bs ' + s + (dec ? ',' + String(dec).padStart(2, '0') : '');
  }
  /** Rutas de la app (/demo/…) van con el origen de la app; URLs completas, tal cual; nada más. */
  function abs(u) {
    if (typeof u !== 'string' || !u) return '';
    if (/^https:\/\//.test(u)) return u;
    if (u.charAt(0) === '/' && u.charAt(1) !== '/') return B.app + u;
    return '';
  }
  function hexOk(h) { return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h); }
  function lum(hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  /** Texto blanco o casi negro sobre el acento, el que contraste más. */
  function onAccent(hex) {
    var L = lum(hex);
    return (1.05 / (L + 0.05)) >= ((L + 0.05) / (lum('#16130f') + 0.05)) ? '#ffffff' : '#16130f';
  }
  function hhmm(s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function fmtRanges(r) {
    return r.map(function (x) { return x[0] + '–' + x[1]; }).join(' y ');
  }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /** Día (0 = domingo) y minuto del día en la zona del local. */
  function nowIn(tz) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/La_Paz', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      var get = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
      return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), min: (+get('hour') % 24) * 60 + +get('minute') };
    } catch (e) {
      var d = new Date(); return { day: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }

  /** La hora de cierre del turno en curso, o null si ahora está cerrado. */
  function openUntil(hours, tz) {
    var n = nowIn(tz), day = function (d) { return hours[String((d + 7) % 7)] || []; }, until = null;
    day(n.day).forEach(function (r) {
      var a = hhmm(r[0]), b = hhmm(r[1]);
      if (b > a ? n.min >= a && n.min < b : n.min >= a) until = r[1];
    });
    day(n.day - 1).forEach(function (r) {
      var a = hhmm(r[0]), b = hhmm(r[1]);
      if (b <= a && n.min < b) until = r[1];
    });
    return until;
  }

  /** «Abierto ahora · hasta las 23:30» o «Cerrado ahora · abre mañana a las 12:00». */
  function openLine(hours, openNow, tz) {
    if (!hours) return openNow === false ? 'Cerrado ahora' : 'Abierto todos los días';
    var n = nowIn(tz), day = function (d) { return hours[String((d + 7) % 7)] || []; };
    if (openNow) {
      var until = openUntil(hours, tz);
      return until ? 'Abierto ahora · hasta las ' + until : 'Abierto ahora';
    }
    for (var d = 0; d < 8; d++) {
      var starts = day(n.day + d).map(function (r) { return r[0]; }).filter(function (s) { return d > 0 || hhmm(s) > n.min; }).sort();
      if (starts.length) {
        var when = d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'el ' + DAYS[(n.day + d) % 7];
        return 'Cerrado ahora · abre ' + when + ' a las ' + starts[0];
      }
    }
    return 'Cerrado ahora';
  }

  /** Lunes primero, días seguidos con el mismo horario juntos: «Martes a jueves», «Viernes y sábado». */
  function hourRows(hours) {
    var rows = [];
    WEEK.forEach(function (d) {
      var r = (hours && hours[String(d)]) || [];
      var text = r.length ? fmtRanges(r) : 'Cerrado';
      var last = rows[rows.length - 1];
      if (last && last.text === text) last.days.push(d); else rows.push({ days: [d], text: text });
    });
    return rows.map(function (row) {
      var a = DAYS[row.days[0]], b = DAYS[row.days[row.days.length - 1]];
      var label = row.days.length === 1 ? a : row.days.length === 2 ? a + ' y ' + b : a + ' a ' + b;
      return { label: capital(label), text: row.text, ranges: row.text === 'Cerrado' ? ['Cerrado'] : row.text.split(' y '), days: row.days };
    });
  }

  /** Seis platos: uno por categoría por vuelta, con foto primero, sin agotados. */
  function featured(menu, n) {
    var cats = (menu.categories || []).map(function (c) { return c.id; });
    var by = {};
    (menu.items || []).forEach(function (it) {
      var v = (it.variants || []).filter(function (x) { return x && !x.sold_out; });
      if (!v.length) return;
      (by[it.category_id] = by[it.category_id] || []).push(it);
    });
    Object.keys(by).forEach(function (k) {
      if (cats.indexOf(k) === -1) cats.push(k);
      by[k].sort(function (a, b) { return (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0); });
    });
    // Una vuelta por categoría; primero los que tienen foto, después el resto.
    var out = [];
    [true, false].forEach(function (photo) {
      var round = 0, added = true;
      while (out.length < n && added) {
        added = false;
        for (var i = 0; i < cats.length && out.length < n; i++) {
          var list = (by[cats[i]] || []).filter(function (it) { return !!it.image_url === photo; });
          if (list[round]) { out.push(list[round]); added = true; }
        }
        round++;
      }
    });
    return out;
  }
  function priceOf(it) {
    var v = (it.variants || []).filter(function (x) { return x && !x.sold_out; });
    var best = v.reduce(function (m, x) { return !m || x.price_cents < m.price_cents ? x : m; }, null);
    var distinct = v.some(function (x) { return x.price_cents !== best.price_cents; });
    return { now: best.price_cents, was: best.list_price_cents > best.price_cents ? best.list_price_cents : null, from: distinct };
  }

  /* ---------------------------------------------------------- datos */
  function rpc(fn, args) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl && setTimeout(function () { ctl.abort(); }, 10000);
    return fetch(B.url + '/rest/v1/rpc/' + fn, {
      method: 'POST', cache: 'no-store', credentials: 'omit',
      headers: { apikey: B.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (body) {
        if (timer) clearTimeout(timer);
        if (!r.ok) { var e = new Error((body && body.message) || 'http_' + r.status); e.code = body && body.message; throw e; }
        return body;
      });
    }, function (e) { if (timer) clearTimeout(timer); e.code = 'network'; throw e; });
  }

  function load() {
    if (mock) {
      var m = mockVenue(tpl);
      m.menu.open_now = !!openUntil(m.menu.opening_hours, 'America/La_Paz');
      return Promise.resolve({ menu: m.menu, event: m.event, hero: m.hero, tpl: m.tpl });
    }
    var menu = rpc('public_menu', { p_org_slug: org, p_venue_slug: venue });
    var ev = evento ? rpc('public_event', { p_org_slug: org, p_venue_slug: venue, p_event_slug: evento }).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([menu, ev]).then(function (r) { return { menu: r[0], event: r[1], hero: tpl ? '/demo/' + tpl + '/hero.webp' : '', tpl: tpl }; });
  }

  /* ---------------------------------------------------------- pintar */
  function setLook(look, accentKey, fontKey) {
    root.setAttribute('data-look', look);
    document.documentElement.setAttribute('data-mzs-look', look);
    var dark = look === 'nocturno';
    var sw = SWATCHES[accentKey];
    var acc = sw ? sw[dark ? 1 : 0] : hexOk(accentKey) ? accentKey.toLowerCase() : SWATCHES.amber[dark ? 1 : 0];
    root.style.setProperty('--mzs-accent', acc);
    root.style.setProperty('--mzs-on-accent', onAccent(acc));
    var f = FONTS[fontKey];
    if (f) {
      if (f[1]) {
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=' + f[1] + '&display=swap';
        document.head.appendChild(l);
      }
      root.style.setProperty('--mzs-display', '"' + f[0] + '", ' + f[2]);
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0f0d12' : look === 'claro' ? '#ffffff' : '#f6efe6');
  }

  function links(menu, data) {
    var base = '/m/' + org + '/' + venue;
    var map = {
      menu: base,
      reserve: menu.venue && menu.venue.reservations_enabled ? base + '?reservar=1' : '',
      event: data.event && evento ? '/e/' + org + '/' + venue + '/' + evento : ''
    };
    if (mock) {
      map = { menu: '#carta', reserve: menu.venue.reservations_enabled ? '#ubicacion' : '', event: data.event ? '#inicio' : '' };
    }
    Array.prototype.forEach.call(root.querySelectorAll('[data-link]'), function (a) {
      var k = a.getAttribute('data-link'), href = map[k];
      if (!href) { a.hidden = true; return; }
      a.hidden = false;
      a.href = mock ? href : B.app + href;
      if (mock) a.setAttribute('data-mock', k);
    });
  }

  function toast(text) {
    var t = $('mzs-toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function render(data) {
    var menu = data.menu || {}, v = menu.venue || {};
    var name = v.name || v.org_name || 'Nuestro local';
    var look = LOOKS.indexOf(param('look')) !== -1 ? param('look') : LOOK_OF[data.tpl] || 'calido';
    setLook(look, menu.accent, menu.font);
    document.title = name;

    $('mzs-name').textContent = name;
    $('mzs-title').textContent = name;
    $('mzs-mono').textContent = name.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
    var logo = abs(menu.logo_url) || (data.tpl && !mock ? abs('/demo/' + data.tpl + '/logo.webp') : '');
    if (logo) {
      var li = $('mzs-logo');
      li.onload = function () { li.hidden = false; $('mzs-mono').hidden = true; };
      li.onerror = function () { li.hidden = true; };
      li.src = logo;
    }

    var cats = (menu.categories || []).map(function (c) { return c.name; }).filter(Boolean);
    $('mzs-tag').textContent = cats.slice(0, 4).join(' · ');
    $('mzs-open').textContent = openLine(menu.opening_hours, menu.open_now, v.timezone);
    $('mzs-open').classList.toggle('is-closed', menu.open_now === false);

    var dishes = featured(menu, 6);
    var hero = $('mzs-hero');
    var fallback = (dishes.find(function (d) { return abs(d.image_url); }) || {}).image_url;
    hero.onload = function () { hero.hidden = false; root.classList.add('has-hero'); };
    hero.onerror = function () {
      if (fallback && hero.getAttribute('data-src') !== abs(fallback)) { hero.setAttribute('data-src', abs(fallback)); hero.src = abs(fallback); }
      else hero.hidden = true;
    };
    var heroSrc = mock ? data.hero : abs(data.hero) || abs(fallback);
    if (heroSrc) { hero.setAttribute('data-src', heroSrc); hero.src = heroSrc; }

    var ul = $('mzs-dishes');
    ul.textContent = '';
    dishes.forEach(function (it, i) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'mzs-dish';
      a.setAttribute('data-link', 'menu');
      var ph = document.createElement('span');
      ph.className = 'mzs-ph';
      var src = abs(it.image_url) || (mock && it.image_url) || '';
      if (src) {
        var img = document.createElement('img');
        img.alt = ''; img.loading = i < 3 ? 'eager' : 'lazy'; img.decoding = 'async'; img.width = 400; img.height = 300;
        img.onerror = function () { img.remove(); ph.classList.add('is-empty'); };
        img.src = src;
        ph.appendChild(img);
      } else ph.classList.add('is-empty');
      ph.setAttribute('data-initial', (it.name || '?').charAt(0).toUpperCase());
      var body = document.createElement('span');
      body.className = 'mzs-dish-b';
      var h = document.createElement('b'); h.textContent = it.name;
      body.appendChild(h);
      if (it.description) { var d = document.createElement('span'); d.className = 'mzs-desc'; d.textContent = it.description; body.appendChild(d); }
      var p = priceOf(it), pr = document.createElement('span');
      pr.className = 'mzs-price';
      pr.textContent = (p.from ? 'desde ' : '') + money(p.now);
      if (p.was) { var s = document.createElement('s'); s.textContent = money(p.was); pr.appendChild(document.createTextNode(' ')); pr.appendChild(s); }
      body.appendChild(pr);
      a.appendChild(ph); a.appendChild(body); li.appendChild(a); ul.appendChild(li);
    });
    $('carta').hidden = !dishes.length;

    var hl = $('mzs-hours');
    hl.textContent = '';
    if (!menu.opening_hours) {
      var li0 = document.createElement('li'); li0.innerHTML = '<span>Todos los días</span><span>Abierto</span>'; hl.appendChild(li0);
    } else {
      var today = nowIn(v.timezone).day;
      hourRows(menu.opening_hours).forEach(function (r) {
        var li = document.createElement('li');
        if (r.days.indexOf(today) !== -1) { li.className = 'is-today'; li.setAttribute('aria-current', 'date'); }
        var a = document.createElement('span'); a.textContent = r.label;
        var b = document.createElement('span');
        r.ranges.forEach(function (t) { var x = document.createElement('span'); x.textContent = t; b.appendChild(x); });
        b.setAttribute('aria-label', r.text);
        li.appendChild(a); li.appendChild(b); hl.appendChild(li);
      });
    }
    $('mzs-address').textContent = v.address || '';
    $('ubicacion').hidden = !v.address;

    var ev = data.event;
    $('mzs-event').hidden = !ev;
    if (ev) {
      $('mzs-event-name').textContent = ev.name;
      var when = '';
      try {
        when = new Intl.DateTimeFormat('es-BO', { timeZone: ev.timezone || v.timezone || 'America/La_Paz', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ev.starts_at));
      } catch (e) {}
      $('mzs-event-when').textContent = when ? capital(when) : 'Próximo evento';
      var tt = (ev.ticket_types || []).filter(function (t) { return !t.sold_out && t.price_cents > 0; });
      var min = tt.reduce(function (m, t) { return m == null || t.price_cents < m ? t.price_cents : m; }, null);
      $('mzs-event-price').textContent = min != null ? 'Entradas desde ' + money(min) : '';
    }

    $('mzs-copy').textContent = '© ' + new Date().getFullYear() + ' ' + name;
    links(menu, data);
    $('mzs-state').hidden = true;
    $('mzs-page').hidden = false;
    root.setAttribute('aria-busy', 'false');
  }

  function fail(err) {
    var gone = err && err.code === 'menu_not_found';
    $('mzs-state-msg').textContent = gone ? 'Esta página de ejemplo ya no está disponible. El demo se cerró o el local apagó su carta web.'
      : 'No pudimos cargar esta página. Revisa tu conexión y prueba de nuevo.';
    $('mzs-retry').hidden = gone;
    $('mzs-state-actions').hidden = false;
    root.classList.add('is-error');
    root.setAttribute('aria-busy', 'false');
  }

  function start() {
    root.classList.remove('is-error');
    $('mzs-state-actions').hidden = true;
    $('mzs-state-msg').textContent = 'Cargando…';
    load().then(render, fail);
  }

  root.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-mock]');
    if (a) {
      e.preventDefault();
      toast('Página de ejemplo: en el demo este botón abre ' + ({ menu: 'la carta del local', reserve: 'las reservas', event: 'la venta de entradas' })[a.getAttribute('data-mock')] + '.');
    }
  });
  $('mzs-retry').addEventListener('click', start);

  /* ---------------------------------------------------------- ejemplo sin backend */
  function mockVenue(key) {
    var look = LOOKS.indexOf(param('look')) !== -1 ? param('look') : LOOK_OF[key] || 'calido';
    var P = '/assets/demo/';
    var it = function (id, cat, name, desc, cents, img, extra) {
      var o = { id: id, category_id: cat, name: name, description: desc, image_url: img ? P + img : null, sold_by: 'each',
        variants: [{ id: id + 'v', name: '', price_cents: cents, list_price_cents: cents, sold_out: false, promotion_id: null }], modifiers: [] };
      if (extra) extra(o);
      return o;
    };
    var promo = function (was) { return function (o) { o.variants[0].list_price_cents = was; }; };
    var sizes = function (b) { return function (o) { o.variants.push({ id: o.id + 'b', name: 'Grande', price_cents: b, list_price_cents: b, sold_out: false, promotion_id: null }); }; };
    var out = function (o) { o.variants[0].sold_out = true; };
    var h = function (a, b) { return [[a, b]]; };
    if (look === 'nocturno') return {
      tpl: 'bar', hero: P + 'bar-hero.webp',
      event: { name: 'Noche de cumbia en vivo', starts_at: tonight(22), timezone: 'America/La_Paz', ticket_types: [{ name: 'General', price_cents: 5000, sold_out: false }, { name: 'VIP', price_cents: 12000, sold_out: false }] },
      menu: { accent: 'violet', font: 'bold', logo_url: null, open_now: true,
        opening_hours: { '3': h('18:00', '01:00'), '4': h('18:00', '02:00'), '5': h('18:00', '03:00'), '6': h('18:00', '03:00') },
        venue: { name: 'Bar El Farol', address: 'Calle Los Faroles 215, Sopocachi, La Paz', timezone: 'America/La_Paz', reservations_enabled: true },
        categories: [{ id: 'c1', name: 'Cócteles' }, { id: 'c2', name: 'Tragos por onza' }, { id: 'c3', name: 'Para picar' }, { id: 'c4', name: 'Cervezas' }],
        items: [
          it('b1', 'c1', 'Trío de la casa', 'Tres cócteles de fruta de temporada para compartir.', 7500, 'bar-2.webp'),
          it('b2', 'c2', 'Singani con naranja', 'Dos onzas, hielo grande y cáscara de naranja.', 3200, 'bar-1.webp', sizes(5600)),
          it('b3', 'c3', 'Tabla de picadas', 'Quesos, embutidos, aceitunas y pan de la casa.', 8900, null),
          it('b4', 'c4', 'Cerveza artesanal rubia', 'De barril, 500 ml.', 2800, null, promo(3500)),
          it('b5', 'c1', 'Cóctel de moras', 'Moras, limón, hierbabuena y soda.', 4200, 'bar-3.webp'),
          it('b6', 'c3', 'Salchipapas de la barra', 'Papas rústicas, salchicha y tres salsas.', 3800, null),
          it('b7', 'c1', 'Mojito clásico', 'Hierbabuena, limón y soda.', 3900, null, out)
        ] }
    };
    if (look === 'claro') return {
      tpl: 'heladeria', hero: P + 'helado-hero.webp', event: null,
      menu: { accent: 'blue', font: 'friendly', logo_url: null, open_now: false,
        opening_hours: { '0': h('14:00', '21:00'), '2': h('15:00', '21:00'), '3': h('15:00', '21:00'), '4': h('15:00', '21:00'), '5': h('15:00', '22:00'), '6': h('14:00', '22:00') },
        venue: { name: 'Heladería Copo', address: 'Calle Las Moras 77, Tarija', timezone: 'America/La_Paz', reservations_enabled: false },
        categories: [{ id: 'c1', name: 'Helados' }, { id: 'c2', name: 'Copas' }, { id: 'c3', name: 'Paletas' }, { id: 'c4', name: 'Tortas por encargo' }],
        items: [
          it('h1', 'c1', 'Cono doble con toppings', 'Dos sabores del día y tres toppings a elección.', 1800, 'helado-1.webp', sizes(2600)),
          it('h2', 'c2', 'Copa brownie', 'Helado de chocolate, brownie tibio y crema.', 3200, 'helado-3.webp'),
          it('h3', 'c3', 'Paleta de frutos rojos', 'De fruta natural, sin colorantes.', 1200, 'helado-2.webp'),
          it('h4', 'c4', 'Torta helada de vainilla', 'Para 10 personas. Pídela con dos días de anticipación.', 18000, null),
          it('h5', 'c1', 'Tres bolas de dulce de leche', 'El sabor de la casa.', 2200, 'helado-4.webp', promo(2600)),
          it('h6', 'c2', 'Malteada de vainilla', '400 ml, con crema y galleta.', 2000, null)
        ] }
    };
    return {
      tpl: 'restaurante', hero: P + 'rest2-hero.webp', event: null,
      menu: { accent: 'wine', font: 'classic', logo_url: null, open_now: true,
        opening_hours: { '0': h('11:30', '16:30'), '1': h('12:00', '15:30'), '2': [['12:00', '15:30'], ['19:00', '23:30']], '3': [['12:00', '15:30'], ['19:00', '23:30']], '4': [['12:00', '15:30'], ['19:00', '23:30']], '5': [['12:00', '16:00'], ['19:00', '00:30']], '6': [['12:00', '16:00'], ['19:00', '00:30']] },
        venue: { name: 'Casa Brasa', address: 'Av. Las Palmeras 1840, Equipetrol Norte, Santa Cruz de la Sierra', timezone: 'America/La_Paz', reservations_enabled: true },
        categories: [{ id: 'c1', name: 'Parrilla' }, { id: 'c2', name: 'Platos de la casa' }, { id: 'c3', name: 'Pizzas al horno' }, { id: 'c4', name: 'Postres' }],
        items: [
          it('r1', 'c1', 'Bife de chorizo', '350 g a la parrilla, con ensalada de la huerta.', 9800, 'rest-6.webp'),
          it('r2', 'c2', 'Lomo al vino', 'Medallones en reducción de vino tinto, puré rústico.', 8600, 'rest-5.webp'),
          it('r3', 'c3', 'Pizza margarita', 'Tomate, mozzarella y albahaca fresca.', 6200, 'rest-hero.webp', sizes(8400)),
          it('r4', 'c4', 'Panqueque flambeado', 'Con dulce de leche y helado de vainilla.', 3400, null),
          it('r5', 'c3', 'Pizza de la casa', 'Jamón, champiñones, morrón y aceitunas.', 7400, 'rest-2.webp', promo(8200)),
          it('r6', 'c1', 'Parrillada para dos', 'Bife, chorizo, pollo y costilla, con yuca frita.', 16500, null)
        ] }
    };
  }
  function tonight(hour) {
    var d = new Date(); d.setHours(hour, 0, 0, 0); return d.toISOString();
  }

  start();
})();
