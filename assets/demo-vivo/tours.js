/* Mezzita · demo vivo · tours.js
   The recorridos of docs/demo-vivo.md §4 (Guía), the runner that walks them and advances on demo-pulse, and the
   ambient timeline (the demo comes alive on its own). No DOM here: shell.js draws the rail. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.MezzitaDemo = root.MezzitaDemo || {}).tours = mod;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Predicates over two snapshots (pulse state + phone counters): "now" against the one taken when the step began.
  function rose(k) { return function (now, base) { return (now[k] || 0) > (base[k] || 0); }; }
  function fell(k) { return function (now, base) { return (now[k] || 0) < (base[k] || 0); }; }
  function any() {
    var fs = [].slice.call(arguments);
    return function (now, base) { return fs.some(function (f) { return f(now, base); }); };
  }

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
   * The recorridos this sandbox can show. `on(key)` says whether a menu item is usable (shell.js passes its menu);
   * `venues` is the number of venues. A step: {text, guest?, team?, at?, go?, play?, until?};
   * `at: 'guest'` marks steps whose action is on the guest's side (the phone layout shows that pane).
   */
  function toursFor(ctx) {
    var on = ctx.on, venue = ctx.venue || 'el local', list = [];
    var bar = on('bar');
    if (on('whatsapp')) {
      list.push({
        key: 'whatsapp', title: 'Un pedido por WhatsApp', line: 'Tu cliente escribe, el asistente toma el pedido y llega a tu caja.',
        steps: [
          { at: 'guest', guest: 'whatsapp', team: 'cashier', text: 'Tú eres el cliente. Toca el primer mensaje de abajo para escribirle a ' + venue + ' por WhatsApp.', until: rose('phone_out') },
          { at: 'guest', guest: 'whatsapp', team: 'cashier', text: 'El asistente responde con la carta de hoy y arma el pedido. Sigue tocando los mensajes hasta «Sí, confirmo».', until: rose('pending') },
          { guest: 'whatsapp', team: 'cashier', go: '/pos', text: 'Ahora eres el cajero: el pedido está en «Pedidos por confirmar». Acéptalo.', until: any(fell('pending'), rose('in_kitchen')) },
          { guest: 'whatsapp', team: 'kitchen', text: 'En la cocina aparece el pedido. Márcalo como listo.', until: rose('ready') },
          { at: 'guest', guest: 'whatsapp', team: 'kitchen', text: 'Tu cliente recibe por WhatsApp el aviso de que su pedido está listo, sin que nadie lo escriba.', until: rose('phone_in') },
          { guest: 'whatsapp', team: 'owner', go: '/dashboard', text: 'Y tú, el dueño, ves la venta en «En vivo», junto con todo lo demás del día.' },
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
      if (door) steps.push({ guest: 'entry', team: 'door', play: { script: 'door_checkin', step: 0 }, text: 'En la puerta se valida la entrada con el celular. Acaba de entrar alguien.' });
      if (on('entry') && bar) steps.push({ guest: 'entry', team: 'bar', play: { script: 'wristband', step: 0 }, text: 'Con la manilla se recarga saldo y se cobra en la barra, sin efectivo.' });
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
   * The ambient timeline: the first event 20 s after the demo opens, then one every 45 to 90 s, each at most once,
   * capped at 12. Pauses while the tab is hidden (hold()/release()). Timers and randomness are injectable for tests.
   */
  function Ambient(events, play, opts) {
    opts = opts || {};
    this.events = (events || []).slice(0, opts.cap || 12);
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

  return { toursFor: toursFor, TourRunner: TourRunner, Ambient: Ambient, rose: rose, fell: fell, any: any, LINES: LINES, ROLE_LABEL: ROLE_LABEL };
});
