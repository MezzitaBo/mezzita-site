/* Mezzita · demo vivo · tours.js
   The recorridos of docs/demo-vivo.md §4 (Guía) and the WhatsApp addendum (owner decision D2), the runner that walks
   them and advances on demo-pulse, the active-time clock, the timeline that plays the 12 scripted WhatsApp
   conversations beat by beat, and the ambient timeline. No DOM here: shell.js draws everything. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.MezzitaDemo = root.MezzitaDemo || {}).tours = mod;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Predicates over two snapshots (pulse state + WhatsApp progress): "now" against the one taken when the step began.
  function rose(k) { return function (now, base) { return (now[k] || 0) > (base[k] || 0); }; }
  function fell(k) { return function (now, base) { return (now[k] || 0) < (base[k] || 0); }; }
  function reach(k, v) { return function (now) { return (now[k] || 0) >= v; }; }
  function any() {
    var fs = [].slice.call(arguments);
    return function (now, base) { return fs.some(function (f) { return f(now, base); }); };
  }

  /** The app's WhatsApp board columns in order (wa_conversations.stage); closed ones rank last. */
  var STAGE_RANK = { nuevo: 1, conversando: 2, pedido: 3, listo: 4, en_camino: 5, entregado: 6, cerrado: 7, no_relevante: 7 };
  function rank(stage) { return STAGE_RANK[stage] || 0; }

  var LINES = {
    owner: 'Todo: ventas en vivo, informes, inventario, clientes, empleados y configuración.',
    admin: 'Lo mismo que el dueño para el día a día.',
    cashier: 'Cobra, abre y cierra caja, confirma pedidos y pagos. No cambia precios ni configuración.',
    waiter: 'Sus mesas, sus pedidos y sus ventas del turno, desde su celular.',
    kitchen: 'Solo los pedidos que le toca preparar.',
    bar: 'Solo los pedidos que le toca preparar.',
    door: 'Vende y valida entradas y manillas. No ve la caja.',
  };
  var ROLE_LABEL = { owner: 'Dueño', admin: 'Administrador', cashier: 'Cajero', waiter: 'Mesero', kitchen: 'Cocina', bar: 'Barra', door: 'Puerta' };

  /**
   * The recorridos this sandbox can show. `on(key)` says whether a menu item or module is usable; `venues` is the
   * number of venues; `guest` the name of the WhatsApp guest the order recorrido follows. A step: {text, guest?,
   * team?, at?, go?, play?, until?, follow?}; `at: 'guest'` marks steps whose action is on the guest's side (the phone
   * layout shows that pane); `follow` asks the shell to pick the order conversation to follow.
   */
  function toursFor(ctx) {
    var on = ctx.on, list = [];
    var guest = ctx.guest || 'Tu cliente';
    var bar = on('bar');
    if (on('whatsapp')) {
      list.push({
        key: 'wa-solo', title: 'Mira tu WhatsApp trabajar solo', line: 'Doce clientes escriben y el asistente atiende cada chat.',
        steps: [
          { guest: 'whatsapp', team: 'owner', go: '/whatsapp', text: 'Este es el tablero de WhatsApp de tu negocio. En unos segundos empiezan a escribir clientes y el asistente les responde solo.', until: rose('chats') },
          { guest: 'whatsapp', team: 'owner', go: '/whatsapp', text: 'Cada tarjeta avanza sola por las columnas: «Nuevo lead», «En conversación», «Pedido en curso», «Pedido listo» y «Entregado».', until: reach('max_rank', 3) },
          { at: 'guest', guest: 'whatsapp', team: 'owner', text: 'En el celular ves lo que ve tu cliente. Arriba eliges de quién es el chat.' },
          { guest: 'whatsapp', team: 'owner', go: '/whatsapp', text: 'Si un cliente pide hablar con una persona, su chat queda en «Sin respuesta» hasta que tú le contestes.' },
          { guest: 'whatsapp', team: 'cashier', go: '/pos', text: 'Los pedidos llegan a la caja y a la cocina sin que nadie los escriba. Sigue explorando: los chats siguen solos unos minutos.' },
        ],
      });
      list.push({
        key: 'whatsapp', title: 'Un pedido por WhatsApp', line: 'Un cliente pide, la caja acepta, la cocina prepara y el aviso le llega solo.', follow: true,
        steps: [
          { at: 'guest', guest: 'whatsapp', team: 'owner', text: guest + ' escribe por WhatsApp. Mira el celular: el asistente le responde solo.', until: reach('f_rank', 1) },
          { guest: 'whatsapp', team: 'owner', go: '/whatsapp', text: 'En el tablero de WhatsApp aparece su tarjeta en «Nuevo lead» y pasa a «En conversación» cuando vuelve a escribir.', until: reach('f_rank', 2) },
          { guest: 'whatsapp', team: 'owner', go: '/whatsapp', text: 'El asistente arma el pedido: la tarjeta dice «Armando pedido» y después muestra el número de pedido.', until: reach('f_rank', 3) },
          { guest: 'whatsapp', team: 'cashier', go: '/pos', text: 'Ahora eres el cajero: el pedido está en «Pedidos por confirmar». Acéptalo, o espera: en la demo se acepta solo.', until: any(reach('f_appr', 1), fell('pending'), reach('f_rank', 4)) },
          { guest: 'whatsapp', team: 'kitchen', text: 'En la cocina aparece el pedido. Márcalo como listo, o espera: en la demo la cocina avanza sola.', until: reach('f_rank', 4) },
          { at: 'guest', guest: 'whatsapp', team: 'owner', go: '/whatsapp', text: guest + ' recibe «Tu pedido está listo» por WhatsApp. En el tablero, la tarjeta pasa a «Pedido listo» y después a «Entregado».', until: reach('f_rank', 6) },
          { guest: 'whatsapp', team: 'owner', go: '/dashboard', text: 'Y en «En vivo» ya está la venta, junto con todo lo demás del día.' },
        ],
      });
    }
    if (on('table')) {
      list.push({
        key: 'mesa', title: 'Un pedido desde la mesa', line: 'Escanea el QR, pide y paga desde el celular. La caja lo confirma.',
        steps: [
          { at: 'guest', guest: 'table', team: 'cashier', text: 'Eres el cliente: escaneaste el QR de la mesa y la carta se abrió en tu celular. Elige algo y pídelo.' },
          { at: 'guest', guest: 'table', team: 'cashier', text: 'Paga con QR desde el mismo celular. El pago queda para que la caja lo verifique.', until: rose('to_verify') },
          { guest: 'table', team: 'cashier', go: '/pos', text: 'En la caja aparece el pago por verificar. Confírmalo cuando lo veas en tu cuenta.', until: any(fell('to_verify'), rose('paid_today_cents')) },
          { guest: 'table', team: bar ? ['kitchen', 'bar'] : 'kitchen', text: bar ? 'Cocina y barra reciben, cada una, solo lo que le toca preparar.' : 'La cocina recibe el pedido con su mesa, sin papelitos.' },
          { guest: 'table', team: 'waiter', text: 'El mesero ve la mesa en su mapa, con lo que pidió y lo que falta cobrar.' },
        ],
      });
    }
    var roles = ['owner', 'admin', 'cashier', 'waiter', 'kitchen', 'bar', 'door'].filter(on);
    list.push({
      key: 'roles', title: 'Quién ve qué', line: 'Cada persona de tu equipo ve solo lo suyo.',
      steps: roles.map(function (r) { return { team: r, text: '<b>' + ROLE_LABEL[r] + '.</b> ' + LINES[r] }; }),
    });
    if (on('customers')) {
      list.push({
        key: 'clientes', title: 'Tus clientes vuelven', line: 'Cumpleaños, clientes que dejaron de venir y promociones por WhatsApp.',
        steps: [
          { team: 'owner', go: '/customers', text: 'En «Clientes» está cada persona con sus visitas, lo que gasta y su cumpleaños.' },
          { team: 'owner', go: '/customers', text: 'Quien cumple años esta semana recibe su regalo. Lo configuras una vez y sale solo.' },
          { team: 'owner', go: '/customers', text: 'Los que dejaron de venir aparecen solos, para invitarlos a volver.' },
          { team: 'owner', go: '/whatsapp', text: 'Mándales una promoción por WhatsApp: cada mensaje cuesta Bs 1,50 y ves cómo baja tu saldo.' },
        ],
      });
    }
    if (on('inventory')) {
      list.push({
        key: 'inventario', title: 'Inventario por receta', line: 'Cada venta descuenta sus insumos: onzas, porciones o unidades.',
        steps: [
          { team: 'cashier', go: '/pos', text: 'Vende algo como cajero. Cada venta descuenta los insumos de su receta.', until: rose('paid_today_cents') },
          { team: 'owner', go: '/inventory', text: 'En «Inventario», cada insumo bajó justo lo que lleva la receta: onzas, porciones o unidades.' },
          { team: 'owner', go: '/inventory', text: 'Arriba ves lo que está por acabarse, antes de que falte.' },
          { team: 'owner', go: '/inventory', text: 'Registra una compra y el stock sube con su costo.' },
          { team: 'owner', go: '/inventory', text: 'Haz un conteo: la diferencia con el sistema queda anotada.' },
        ],
      });
    }
    if (on('tickets')) {
      var door = on('door');
      var steps = [{ at: 'guest', guest: 'tickets', team: door ? 'door' : 'owner', text: 'Compra una entrada como lo haría tu cliente, desde su celular.' }];
      if (door) steps.push({ guest: 'entry', team: 'door', play: { script: 'door_checkin' }, text: 'En la puerta se valida la entrada con el celular. Acaba de entrar alguien.' });
      if (on('wristbands')) {
        steps.push({ guest: 'entry', team: door ? 'door' : 'owner', play: { script: 'wristband', step: 0 }, text: 'Se carga saldo a la manilla al entrar.' });
        if (bar) steps.push({ guest: 'entry', team: 'bar', play: { script: 'wristband', step: 1 }, text: 'En la barra se cobra con la manilla, sin efectivo.' });
      }
      steps.push({ team: 'owner', go: '/dashboard', text: 'Y tú ves la «Noche en curso»: entradas vendidas, puerta, barra y caja.' });
      list.push({ key: 'noche', title: 'Una noche con entradas', line: 'Entradas, puerta, manillas y barra en una sola noche.', steps: steps });
    }
    if ((ctx.venues || 1) >= 2) {
      list.push({
        key: 'sucursales', title: 'Tus sucursales', line: 'Todos tus locales en un solo lugar.',
        steps: [
          { team: 'owner', go: '/dashboard', text: 'Arriba cambias de local: cada uno con sus ventas, su caja y su stock.' },
          { team: 'owner', go: '/reports', text: 'En «Informes» comparas las ventas de tus locales.' },
          { team: 'owner', go: '/catalog', text: 'Una sola carta para todos tus locales: la cambias una vez.' },
        ],
      });
    }
    return list.filter(function (t) { return t.steps.length; });
  }

  /**
   * The order conversation the recorrido «Un pedido por WhatsApp» follows: conversation 1 unless it is already past
   * its first steps, then the next order conversation that has not reached «En conversación» (addendum §7, L6).
   */
  function pickFollow(timeline, stages) {
    // order_qr is approved by its payment, never by the cashier: step 4 («acéptalo») would not fit it
    var orders = (timeline || []).filter(function (c) { return /^order_/.test(c.kind) && c.kind !== 'order_qr'; });
    for (var i = 0; i < orders.length; i++) if (rank(stages[orders[i].conv]) < 2) return orders[i].conv;
    return orders.length ? orders[0].conv : 1;
  }

  /**
   * Walks one recorrido. hooks.show(step, index, total) draws it; hooks.end(completed) closes it. observe(snapshot)
   * is fed every pulse: when the step's `until` holds against the snapshot taken when the step began, it advances.
   */
  function TourRunner(tour, hooks) {
    this.tour = tour;
    this.hooks = hooks || {};
    this.i = -1;
    this.base = null;
    this.last = null;
    this.active = false;
  }
  TourRunner.prototype.start = function (snapshot) {
    if (snapshot) this.last = snapshot;
    this.active = true;
    this.go(0);
  };
  TourRunner.prototype.go = function (i) {
    if (!this.active) return;
    var n = this.tour.steps.length;
    this.i = Math.max(0, Math.min(n - 1, i));
    this.base = this.last ? Object.assign({}, this.last) : null;
    if (this.hooks.show) this.hooks.show(this.tour.steps[this.i], this.i, n);
  };
  TourRunner.prototype.next = function () {
    if (!this.active) return;
    if (this.i >= this.tour.steps.length - 1) this.finish(true);
    else this.go(this.i + 1);
  };
  TourRunner.prototype.back = function () { if (this.active && this.i > 0) this.go(this.i - 1); };
  TourRunner.prototype.exit = function () { if (this.active) this.finish(false); };
  TourRunner.prototype.finish = function (completed) {
    this.active = false;
    if (this.hooks.end) this.hooks.end(completed);
  };
  TourRunner.prototype.step = function () { return this.active ? this.tour.steps[this.i] : null; };
  TourRunner.prototype.kicker = function () {
    return 'Recorrido · paso ' + (this.i + 1) + ' de ' + this.tour.steps.length;
  };
  /** Returns true when the snapshot moved the tour forward. */
  TourRunner.prototype.observe = function (snapshot) {
    if (!snapshot) return false;
    this.last = Object.assign({}, snapshot);
    if (!this.active) return false;
    if (!this.base) { this.base = Object.assign({}, snapshot); return false; }
    var s = this.tour.steps[this.i];
    if (s && typeof s.until === 'function' && s.until(snapshot, this.base)) {
      this.next();
      return true;
    }
    return false;
  };

  /**
   * Seconds the demo has been on screen: it stops while the tab is hidden and goes on from a stored value after a
   * reload (addendum §5). `speed` > 1 only for tests on the mock.
   */
  function ActiveClock(opts) {
    opts = opts || {};
    this.perf = opts.perf || function () { return Date.now(); };
    this.speed = opts.speed || 1;
    this.ms = opts.from || 0;
    this.since = null;
  }
  ActiveClock.prototype.start = function () { if (this.since === null) this.since = this.perf(); };
  ActiveClock.prototype.pause = function () {
    if (this.since !== null) { this.ms += (this.perf() - this.since) * this.speed; this.since = null; }
  };
  ActiveClock.prototype.now = function () {
    return this.ms + (this.since === null ? 0 : (this.perf() - this.since) * this.speed);
  };

  /**
   * Plays the 12 scripted conversations (demo-start's wa_timeline: [{conv, kind, guest_name, start_s, beats:
   * [{after_s, hold_s?, type}]}]). Beat 0 is due at start_s; beat n at (when n−1 finished) + after_s + hold_s, on the
   * active clock. One request in flight per conversation. A stopped conversation is never played again; module_off
   * pauses everything and retries; an expired sandbox ends it. opts: {now() → active ms, play(conv, beat) → Promise,
   * onResult(conv, r), onError(conv, err), retryMs, offMs}.
   */
  function WaTimeline(timeline, opts) {
    opts = opts || {};
    this.opts = opts;
    this.now = opts.now;
    this.list = (timeline || []).map(function (c) {
      return { c: c, next: 0, at: 0, busy: false, stopped: false, finished: !(c.beats && c.beats.length), retryAt: 0 };
    });
    this.pausedUntil = 0;
    this.ended = false;
  }
  WaTimeline.prototype.get = function (conv) {
    for (var i = 0; i < this.list.length; i++) if (this.list[i].c.conv === conv) return this.list[i];
    return null;
  };
  /** The active ms at which the conversation's next beat is due (Infinity when there is none). */
  WaTimeline.prototype.due = function (st) {
    var b = st.c.beats[st.next];
    if (!b || st.stopped || st.finished) return Infinity;
    var gap = ((b.after_s || 0) + (b.hold_s || 0)) * 1000;
    var t = st.next === 0 ? (st.c.start_s || 0) * 1000 + gap : st.at + gap;
    return Math.max(t, st.retryAt);
  };
  /**
   * Adopts the server's progress (demo-pulse wa.done / wa.stopped): never moves a conversation back. A conversation
   * moved forward counts its last beat as done now, so the next one keeps its own spacing.
   */
  WaTimeline.prototype.sync = function (done, stopped) {
    var t = this.now();
    var self = this;
    this.list.forEach(function (st) {
      var d = done && done[st.c.conv];
      if (d != null && d + 1 > st.next && !st.busy) {
        st.next = d + 1;
        st.at = t;
        if (st.next >= st.c.beats.length) st.finished = true;
      }
      if (stopped && stopped.indexOf(st.c.conv) >= 0) st.stopped = true;
    });
    return self;
  };
  /** Fires every beat that is due; returns the conversations fired. */
  WaTimeline.prototype.tick = function () {
    if (this.ended) return [];
    var t = this.now();
    if (t < this.pausedUntil) return [];
    var fired = [];
    var self = this;
    this.list.forEach(function (st) {
      if (st.busy || st.stopped || st.finished) return;
      if (t >= self.due(st)) { self.fire(st); fired.push(st.c.conv); }
    });
    return fired;
  };
  WaTimeline.prototype.fire = function (st) {
    var self = this, n = st.next, o = this.opts;
    st.busy = true;
    return Promise.resolve().then(function () { return o.play(st.c.conv, n); }).then(function (r) {
      st.busy = false;
      if (self.ended) return;
      st.retryAt = 0;
      st.next = n + 1;
      st.at = self.now();
      if (r && r.stopped) st.stopped = true;
      if ((r && (r.done || r.next === null)) || st.next >= st.c.beats.length) st.finished = true;
      if (o.onResult) o.onResult(st.c, r || {});
    }, function (err) {
      st.busy = false;
      var code = err && err.code;
      var t = self.now();
      if (code === 'conversation_stopped' || code === 'beat_failed') st.stopped = true;
      else if (code === 'module_off') self.pausedUntil = t + (o.offMs || 20000);
      else if (err && err.expired) self.ended = true;
      else if (code === 'beat_out_of_order') st.retryAt = t + 1000; // the next pulse's sync moves it on
      else st.retryAt = t + (code === 'beat_running' ? 1500 : o.retryMs || 5000);
      if (o.onError) o.onError(st.c, err);
    });
  };
  WaTimeline.prototype.stop = function () { this.ended = true; };
  /** Every conversation has finished or stopped. */
  WaTimeline.prototype.over = function () {
    return this.list.every(function (st) { return st.finished || st.stopped; });
  };

  /**
   * The ambient timeline (web-menu orders, reservations, waiter calls; at most 6): the first event 20 s after the demo
   * opens, then one every 45 to 90 s, each at most once. Pauses while the tab is hidden (hold()/release()). Timers and
   * randomness are injectable for tests.
   */
  function Ambient(events, play, opts) {
    opts = opts || {};
    this.events = (events || []).slice(0, opts.cap || 6);
    this.play = play;
    this.next = opts.from || 0;
    this.first = opts.first == null ? 20000 : opts.first;
    this.min = opts.min == null ? 45000 : opts.min;
    this.max = opts.max == null ? 90000 : opts.max;
    this.random = opts.random || Math.random;
    this.setTimeout = opts.setTimeout || function (f, ms) { return setTimeout(f, ms); };
    this.clearTimeout = opts.clearTimeout || function (t) { clearTimeout(t); };
    this.timer = null;
    this.held = false;
    this.due = false;
    this.stopped = false;
  }
  Ambient.prototype.gap = function () { return this.min + Math.round(this.random() * (this.max - this.min)); };
  Ambient.prototype.start = function () {
    this.stopped = false;
    this.arm(this.next === 0 ? this.first : this.gap());
  };
  Ambient.prototype.arm = function (ms) {
    var self = this;
    if (this.timer) this.clearTimeout(this.timer);
    this.timer = null;
    if (this.stopped || this.next >= this.events.length) return;
    this.timer = this.setTimeout(function () { self.timer = null; self.fire(); }, ms);
  };
  Ambient.prototype.fire = function () {
    if (this.stopped) return;
    if (this.held) { this.due = true; return; }
    var i = this.next++;
    try { this.play(i, this.events[i]); } catch (e) { /* the shell logs its own errors */ }
    this.arm(this.gap());
  };
  Ambient.prototype.hold = function () { this.held = true; };
  Ambient.prototype.release = function () {
    this.held = false;
    if (this.due) { this.due = false; this.fire(); }
  };
  Ambient.prototype.stop = function () {
    this.stopped = true;
    if (this.timer) this.clearTimeout(this.timer);
    this.timer = null;
  };

  return {
    toursFor: toursFor, pickFollow: pickFollow, TourRunner: TourRunner, ActiveClock: ActiveClock, WaTimeline: WaTimeline,
    Ambient: Ambient, rose: rose, fell: fell, reach: reach, any: any, rank: rank, STAGE_RANK: STAGE_RANK,
    LINES: LINES, ROLE_LABEL: ROLE_LABEL,
  };
});
