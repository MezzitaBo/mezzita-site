/* Mezzita · el menú web dentro del teléfono.
   Una pantalla de pedidos en el navegador (menú, carrito, pago, confirmación). En el inicio se reproduce
   sola en bucle. En la demo la manejas tú. WhatsApp aparece solo como aviso de seguimiento opcional. */
(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var fmt = function(n){ return Math.round(n).toLocaleString('es-BO') + ' Bs'; };
  var TINTS = ['#C9B38A','#9DB0A8','#8EA3B5','#C4A7A0','#A9B48C','#B6A3C4'];
  function qrHTML(seed){
    var cells = '', s = (seed || 7) * 9301 + 49297;
    for(var i = 0; i < 81; i++){
      var r = Math.floor(i / 9), c = i % 9, on;
      var inEye = function(r0, c0){ return r >= r0 && r < r0 + 3 && c >= c0 && c < c0 + 3; };
      if(inEye(0,0) || inEye(0,6) || inEye(6,0)){ var rr = r % 3, cc = c % 3; on = !(rr === 1 || cc === 1) || (rr === 1 && cc === 1); }
      else { s = (s * 1103515245 + 12345) & 0x7fffffff; on = (s >> 16) % 5 < 2; }
      cells += '<i class="' + (on ? '' : 'o') + '"></i>';
    }
    return '<div class="qr" aria-hidden="true">' + cells + '</div>';
  }
  var ROOT = (function(){ var l = document.querySelector('link[href$="site.css"]'); return l ? l.getAttribute('href').replace(/assets\/site\.css$/, '') : '/'; })();
  function asset(u){ return u ? ROOT + String(u).replace(/^\//, '') : ''; }
  function now(){ var d = new Date(); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }

  /* Order(el, opts): el = .phone .screen; opts = {R, mode:'live'|'auto', onChange(state), onPaid(order)} */
  function Order(screen, opts){
    this.el = screen; this.o = opts || {}; this.R = this.o.R; this.mode = this.o.mode || 'live';
    this.cart = {}; this.view = (this.R.web && this.R.web.ph) ? 'land' : 'menu'; this.cat = null; this.canal = 0; this.id = String(Date.now()).slice(-6); this.wa = false; this.timers = [];
    var self = this;
    screen.addEventListener('click', function(e){ if(self.mode !== 'live') return; var t = e.target.closest('[data-a]'); if(!t) return; self.action(t.getAttribute('data-a'), t); });
    screen.addEventListener('change', function(e){ if(e.target.matches('[data-canal]')){ self.canal = +e.target.value; self.render(); if(self.o.onChange) self.o.onChange(self.state()); } if(e.target.matches('[data-wa-opt]')){ self.wa = e.target.checked; } });
    this.render();
  }
  Order.prototype.cats = function(){ var s = []; this.R.CAT.forEach(function(i){ if(s.indexOf(i.c) < 0) s.push(i.c); }); return s; };
  Order.prototype.lines = function(){ var c = this.cart; return Object.keys(c).map(function(k){ var l = c[k]; return {q: l.q, n: l.i.n + (l.v ? ' (' + l.v + ')' : ''), t: (l.i.po || l.i.p) * l.q}; }); };
  Order.prototype.deliv = function(){ return this.R.delivery[this.canal] || this.R.delivery[0]; };
  Order.prototype.total = function(){ var t = 0; this.lines().forEach(function(l){ t += l.t; }); return t; };  // el envío lo cobra el repartidor del local, no entra al QR
  Order.prototype.count = function(){ var n = 0; this.lines().forEach(function(l){ n += l.q; }); return n; };
  Order.prototype.state = function(){ return {lines: this.lines(), total: this.total(), deliv: this.deliv(), id: this.id, view: this.view, wa: this.wa}; };
  Order.prototype.add = function(sku, v){
    var i = this.R.CAT.filter(function(x){ return x.sku === sku; })[0]; if(!i || i.s === 0) return;
    var k = sku + (v ? ' · ' + v : ''); this.cart[k] = this.cart[k] || {i: i, v: v, q: 0}; this.cart[k].q++;
    this.render(); if(this.o.onChange) this.o.onChange(this.state());
  };
  Order.prototype.remove = function(k){ if(this.cart[k]){ this.cart[k].q--; if(this.cart[k].q <= 0) delete this.cart[k]; } this.render(); if(this.o.onChange) this.o.onChange(this.state()); };
  Order.prototype.reset = function(R){ if(R) this.R = R; this.cart = {}; this.view = (this.R.web && this.R.web.ph) ? 'land' : 'menu'; this.cat = null; this.canal = 0; this.id = String(Date.now()).slice(-6); this.wa = false; this.timers.forEach(clearTimeout); this.timers = []; this.render(); };
  Order.prototype.action = function(a, t){
    var self = this;
    if(a === 'cat'){ this.cat = t.getAttribute('data-cat'); this.render(); }
    else if(a === 'add'){ var card = t.closest('.ws-item'), sel = card && card.querySelector('select'); this.add(t.getAttribute('data-sku'), sel ? sel.value : ''); }
    else if(a === 'cart'){ this.view = 'cart'; this.render(); }
    else if(a === 'menu'){ this.view = 'menu'; this.render(); }
    else if(a === 'rm'){ this.remove(t.getAttribute('data-k')); }
    else if(a === 'pay'){ this.pay(); }
    else if(a === 'again'){ this.reset(); }
    else if(a === 'start'){ this.view = 'menu'; this.render(); }
  };
  Order.prototype.pay = function(){
    var self = this; if(!this.lines().length) return;
    var d = this.deliv(), cash = !!d.cash;
    this.view = cash ? 'done' : 'pay'; this.render();
    if(!cash){ this.timers.push(setTimeout(function(){ self.view = 'done'; self.render(); if(self.o.onPaid) self.o.onPaid(self.snapshot(false)); }, reduce ? 600 : 2600)); }
    else if(this.o.onPaid) this.o.onPaid(this.snapshot(true));
  };
  Order.prototype.snapshot = function(cash){ return {id: this.id, lines: this.lines(), total: this.total(), deliv: this.deliv(), cash: cash, wa: this.wa}; };

  Order.prototype.render = function(){
    var R = this.R, W = R.web || {}, d = this.deliv(), self = this;
    var mesa = !!d.mesa, cash = !!d.cash;
    var hd = '<div class="ws-hd"><div class="ws-url"><i></i>' + esc(W.url || 'tumenu.bo') + '</div><div class="ws-brand"><b>' + esc(R.nombre) + '</b><span class="ws-chip' + (mesa ? ' mesa' : '') + '">' + (mesa ? 'Mesa 12' : esc(d.n.split(' ·')[0])) + '</span></div></div>';
    var body = '', P = W.ph || [];
    if(this.view === 'land'){
      var feat = R.CAT.filter(function(i){ return i.s !== 0; }).slice(0, 3);
      body += '<div class="ws-land"><div class="ws-lh" style="--img:url(' + asset(P[0]) + ')"><div class="ws-lph"></div><small>' + esc(W.eyebrow || '') + '</small><h3>' + esc(W.tag || R.nombre) + '</h3><button type="button" class="ws-go" data-a="start">' + (mesa ? 'Pedir desde la mesa 12' : 'Ver el menú y pedir') + ' →</button></div>' +
        '<div class="ws-lf"><b>' + esc(W.itemsTitle || 'Lo más pedido') + '</b><div class="ws-lgrid">' + feat.map(function(i, k){ return '<div class="ws-lcard" data-a="start"><span class="ws-lph2" style="background-image:url(' + asset(P[k + 1] || P[0]) + ')"></span><b>' + esc(i.n) + '</b><em>' + fmt(i.po || i.p) + '</em></div>'; }).join('') + '</div></div>' +
        '<div class="ws-lbadge">' + esc(W.badge || '') + '</div></div>';
    } else if(this.view === 'menu'){
      var cats = this.cats(), cur = this.cat || cats[0];
      var items = R.CAT.filter(function(i){ return i.c === cur; });
      body += '<div class="ws-cats">' + cats.map(function(c){ return '<button type="button" data-a="cat" data-cat="' + esc(c) + '" aria-pressed="' + (c === cur) + '">' + esc(c) + '</button>'; }).join('') + '</div>';
      body += '<div class="ws-list">' + items.map(function(i, k){
        return '<div class="ws-item' + (i.s === 0 ? ' out' : '') + '"><div class="ws-ph" style="--tint:' + TINTS[k % TINTS.length] + (P.length ? ';background-image:url(' + asset(P[(k % (P.length - 1)) + 1]) + ')' : '') + '"></div><div class="ws-it"><b>' + esc(i.n) + '</b>' + (i.d ? '<small>' + esc(i.d) + '</small>' : '') +
          (i.v ? '<select aria-label="Opción">' + i.v.map(function(x){ return '<option>' + esc(x) + '</option>'; }).join('') + '</select>' : '') +
          '<span class="ws-pr">' + fmt(i.po || i.p) + (i.po ? ' <s>' + fmt(i.p) + '</s>' : '') + '</span></div><button type="button" class="ws-add" data-a="add" data-sku="' + esc(i.sku) + '"' + (i.s === 0 ? ' disabled' : '') + ' aria-label="Agregar">' + (i.s === 0 ? '×' : '+') + '</button></div>';
      }).join('') + '</div>';
      var n = this.count();
      body += '<div class="ws-bar' + (n ? '' : ' empty') + '"><button type="button" data-a="cart"' + (n ? '' : ' disabled') + '><span>' + (n ? n + (n === 1 ? ' producto' : ' productos') : 'Agrega algo del menú') + '</span><b>' + (n ? 'Ver pedido · ' + fmt(this.total()) : '') + '</b></button></div>';
    } else if(this.view === 'cart'){
      var c = this.cart;
      body += '<div class="ws-cart"><button type="button" class="ws-back" data-a="menu">← Menú</button><h4>Tu pedido</h4><div class="ws-lines">' + Object.keys(c).map(function(k){ var l = c[k]; return '<div><button type="button" class="ws-rm" data-a="rm" data-k="' + esc(k) + '" aria-label="Quitar">−</button><span>' + l.q + ' × ' + esc(l.i.n) + (l.v ? ' (' + esc(l.v) + ')' : '') + '</span><b>' + fmt((l.i.po || l.i.p) * l.q) + '</b></div>'; }).join('') + '</div>' +
        '<label class="ws-field"><span>Nota para cocina</span><input type="text" placeholder="Sin cebolla, bien cocida…"></label>' +
        '<label class="ws-field"><span>¿Dónde y cómo?</span><select data-canal>' + R.delivery.map(function(x, i){ return '<option value="' + i + '"' + (i === self.canal ? ' selected' : '') + '>' + esc(x.n) + (x.c ? ' (+' + x.c + ' Bs)' : '') + '</option>'; }).join('') + '</select></label>' +
        (!mesa ? '<label class="ws-field"><span>' + (d.n.indexOf('Delivery') === 0 || d.n.indexOf('Envío') === 0 ? 'Dirección' : 'Tu nombre') + '</span><input type="text" placeholder="' + (d.n.indexOf('Delivery') === 0 ? 'Calle, número, referencia' : 'Para llamarte cuando esté listo') + '"></label>' : '') +
        (d.c ? '<div class="ws-tot"><span>Envío · lo pagas al repartidor</span><b>' + fmt(d.c) + '</b></div>' : '') +
        '<div class="ws-tot big"><span>Total</span><b>' + fmt(this.total()) + '</b></div>' +
        '<button type="button" class="ws-pay" data-a="pay">' + (cash ? 'Enviar a cocina · pago en caja' : 'Pagar ' + fmt(this.total()) + ' con QR') + '</button>' +
        (mesa ? '<small class="ws-fine">' + (cash ? 'Pagas al final con el mesero, en efectivo o con QR del local.' : 'Pagas con el QR del local. Tocas «Ya pagué» y caja confirma.') + '</small>' : '<small class="ws-fine">Pagas con el QR del local, desde cualquier banco. Caja confirma tu pago.</small>') + '</div>';
    } else if(this.view === 'pay'){
      body += '<div class="ws-cart ws-center"><h4>Escanea para pagar</h4><b class="ws-amt">' + fmt(this.total()) + '</b>' + qrHTML(this.total()) + '<small class="ws-fine">Abre tu app del banco y escanea. Luego toca «Ya pagué» y caja lo confirma.</small><div class="ws-wait"><i></i><i></i><i></i></div></div>';
    } else {
      var trackable = !mesa;
      body += '<div class="ws-cart ws-center ws-done"><span class="ws-ok">✓</span><h4>' + (cash ? 'Pedido en cocina' : 'Caja confirmó tu pago') + '</h4><p>Pedido <b>' + this.id + '</b> · ' + (mesa ? 'Mesa 12' : esc(d.n)) + '</p><p class="ws-eta">' + esc(R.cierre) + '</p>' +
        (cash ? '<small class="ws-fine">Pagas al final con el mesero.</small>' : '<span class="paid">✓ PAGADO · ' + fmt(this.total()) + '</span>') +
        (trackable ? '<label class="ws-opt"><input type="checkbox" data-wa-opt' + (this.wa ? ' checked' : '') + '><span><b>Avisarme por WhatsApp</b> cuando esté listo o salga el repartidor</span></label>' : '') +
        '<label class="ws-opt"><input type="checkbox"><span>Acepto recibir promociones de ' + esc(R.nombre) + '</span></label>' +
        '<div class="ws-review">¿Qué tal estuvo? <b>Deja tu reseña en Google ★</b></div>' +
        (this.mode === 'live' ? '<button type="button" class="ws-back" data-a="again">Pedir otra cosa</button>' : '') + '</div>';
    }
    this.el.innerHTML = '<div class="ws th-' + (W.theme || 'plain') + (this.view === 'land' ? ' landing' : '') + '">' + (this.view === 'land' ? '<div class="ws-hd slim"><div class="ws-url"><i></i>' + esc(W.url || '') + '</div></div>' : hd) + body + '</div>';
  };

  window.OPOrder = {Order: Order, qrHTML: qrHTML, fmt: fmt, esc: esc, now: now};

  /* Inicio: reproducción automática en bucle */
  document.querySelectorAll('.phone[data-mode="auto"] .screen').forEach(function(screen){
    var R = {nombre: 'Pizzería La Esquina', cierre: 'Ya está en cocina. Sale en 15 minutos a la mesa 12.', web: {url: 'pizzerialaesquina.bo', theme: 'pizza', eyebrow: 'Horno de leña desde 2014', tag: 'La mejor pizza de Santa Cruz, en tu mesa.', itemsTitle: 'Lo más pedido', badge: '4,9 ★ · 212 reseñas en Google', ph: ['/assets/demo/pizza-hero.webp', '/assets/demo/pizza-1.webp', '/assets/demo/pizza-2.webp', '/assets/demo/pizza-3.webp', '/assets/demo/pizza-4.webp']},
      delivery: [{n: 'Mesa 12 · pago con QR ahora', c: 0, mesa: true}, {n: 'Mesa 12 · pago en caja', c: 0, mesa: true, cash: true}, {n: 'Delivery Equipetrol', c: 5}],
      CAT: [{sku: 'PZ-002', n: 'Pizza Tarijeña', d: 'Jamón serrano, queso, aceitunas', c: 'Pizzas', p: 72, po: 65, v: ['Mediana', 'Familiar'], s: 30}, {sku: 'PZ-001', n: 'Pizza Margarita', d: 'Mozzarella, tomate, albahaca', c: 'Pizzas', p: 55, s: 30}, {sku: 'BE-001', n: 'Limonada 1 L', d: 'Con hierbabuena', c: 'Bebidas', p: 25, s: 40}, {sku: 'PO-001', n: 'Tiramisú', d: '', c: 'Postres', p: 22, s: 15}]};
    var ord = new Order(screen, {R: R, mode: 'auto'});
    if(reduce){ ord.add('PZ-002', 'Familiar'); ord.add('BE-001'); ord.add('BE-001'); ord.view = 'done'; ord.render(); return; }
    var steps = [
      function(){ ord.reset(); },
      function(){ ord.view = 'menu'; ord.render(); },
      function(){ ord.add('PZ-002', 'Familiar'); },
      function(){ ord.add('BE-001'); },
      function(){ ord.add('BE-001'); },
      function(){ ord.view = 'cart'; ord.render(); },
      function(){ ord.view = 'pay'; ord.render(); },
      function(){ ord.view = 'done'; ord.render(); }
    ], waits = [3200, 1400, 1100, 900, 1300, 2600, 2600, 5200];
    var i = 0, timer, started = false;
    function next(){ steps[i](); timer = setTimeout(next, waits[i]); i = (i + 1) % steps.length; }
    function start(){ if(started) return; started = true; timer = setTimeout(next, 500); }
    var phone = screen.closest('.phone');
    if('IntersectionObserver' in window) new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting) start(); }); }, {threshold: .2}).observe(phone); else start();
    document.addEventListener('visibilitychange', function(){ if(document.hidden) clearTimeout(timer); else if(started){ clearTimeout(timer); timer = setTimeout(next, 800); } });
  });

  /* la ficha de Google del inicio alterna "Hoy" y "En 7 días" */
  var flip = document.querySelector('[data-flip]');
  if(flip && !reduce){ var st = 1; setInterval(function(){ st = 1 - st; flip.setAttribute('data-state', st ? 'after' : 'before'); }, 4200); }
})();
