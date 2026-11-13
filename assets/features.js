/* Mezzita · mocks de funciones (inicio y /funciones/): WhatsApp con IA, plano y QR, números, cierre y campañas.
   Cada uno arranca al entrar en pantalla, se pausa fuera de ella y se reproduce una vez por entrada.
   Con movimiento reducido no se toca nada: el HTML ya trae el cuadro final. */
(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.25,1,.5,1)';
  var each = function(sel, fn){ [].forEach.call(document.querySelectorAll(sel), fn); };
  var fmt = function(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };

  function watch(el, enter, leave){
    if(!('IntersectionObserver' in window)){ enter(); return; }
    new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting) enter(); else if(leave) leave(); });
    }, {threshold: .2, rootMargin: '0px 0px -10% 0px'}).observe(el);
  }

  /* Mueve un nodo a otro contenedor y anima el salto desde donde estaba (FLIP). */
  function moveTo(node, slot, quiet){
    if(node.parentNode === slot) return;
    if(quiet){ slot.appendChild(node); return; }
    var a = node.getBoundingClientRect();
    slot.appendChild(node);
    var b = node.getBoundingClientRect();
    if(node.animate) node.animate([{transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)'}, {transform: 'none'}], {duration: 420, easing: EASE});
  }

  /* Cuenta de 0 al valor de data-count, una vez. */
  function countUp(els){
    [].forEach.call(els, function(el){
      var end = +el.getAttribute('data-count'), t0 = null;
      function frame(t){ if(!t0) t0 = t; var p = Math.min(1, (t - t0) / 900); el.textContent = fmt(end * (1 - Math.pow(1 - p, 3))); if(p < 1) requestAnimationFrame(frame); }
      requestAnimationFrame(frame);
    });
  }

  /* ---------------------------------------------------------- WhatsApp con IA */
  each('[data-wa-mock]', function(wa){
    if(reduce) return;
    var chat = wa.querySelector('[data-wa-chat]'), board = wa.querySelector('[data-wa-board]');
    var bubs = [].slice.call(chat.querySelectorAll('.bub'));
    var card = board.querySelector('[data-wa-card]'), note = card.querySelector('[data-wa-note]');
    var stamp = wa.querySelector('[data-wa-stamp]');
    var typing = document.createElement('div');
    typing.className = 'bub them on'; typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    function slot(st){ return board.querySelector('[data-st="' + st + '"]'); }
    function counts(){ [].forEach.call(board.querySelectorAll('.wa-col'), function(c){ c.querySelector('.n').textContent = c.querySelector('.wa-slot').children.length; }); }
    function stage(st, text, quiet){ moveTo(card, slot(st), quiet); note.textContent = text; counts(); }
    function show(i){ if(typing.parentNode) typing.remove(); bubs[i].classList.add('on'); }
    function type(i){ chat.insertBefore(typing, bubs[i]); }
    function setStamp(wait){ if(!stamp) return; stamp.textContent = wait ? 'POR CONFIRMAR' : 'ACEPTADO'; stamp.classList.toggle('wait', wait); stamp.style.opacity = '1'; }
    function reset(){ bubs.forEach(function(b){ b.classList.remove('on'); }); card.classList.add('hide'); if(stamp) stamp.style.opacity = '0'; stage('nuevo', '¿Hacen delivery a Sopocachi?', true); }
    var steps = [
      [700, function(){ show(0); card.classList.remove('hide'); }],
      [900, function(){ type(1); }],
      [1300, function(){ show(1); stage('conversando', 'Responde la IA'); }],
      [1500, function(){ show(2); }],
      [700, function(){ type(3); }],
      [1100, function(){ show(3); note.textContent = 'Armando pedido · 2 productos'; }],
      [1500, function(){ show(4); }],
      [700, function(){ type(5); }],
      [1300, function(){ show(5); }],
      [1900, function(){ show(6); }],
      [600, function(){ type(7); }],
      [900, function(){ show(7); stage('pedido', 'Pedido 482 · Por confirmar'); setStamp(true); }],
      [2200, function(){ setStamp(false); note.textContent = 'Pedido 482 · Aceptado'; }],
      [1800, function(){ stage('listo', 'Pedido 482 · Listo'); }],
      [1800, function(){ stage('en_camino', 'Pedido 482 · En camino'); }],
      [1800, function(){ stage('entregado', 'Pedido 482 · Entregado'); }]
    ];
    var i = 0, timer = null, running = false, done = false, inview = false;
    function tick(){ steps[i][1](); i++; if(i < steps.length) timer = setTimeout(tick, steps[i][0]); else { running = false; done = true; } }
    function play(){
      if(running) return;
      if(done){ reset(); i = 0; done = false; }
      running = true; timer = setTimeout(tick, steps[i][0]);
    }
    function pause(){ running = false; clearTimeout(timer); }
    wa.setAttribute('data-anim', '');
    reset();
    watch(wa.querySelector('[data-wa-chat]').closest('.phone'), function(){ inview = true; play(); }, function(){ inview = false; pause(); });
    document.addEventListener('visibilitychange', function(){ if(document.hidden) pause(); else if(inview) play(); });
  });

  /* ---------------------------------------------------------- Plano por zonas */
  each('[data-fp]', function(fp){
    var lit = {};
    function liveChange(zone){
      if(reduce || lit[zone]) return;
      lit[zone] = true;
      var t = fp.querySelector('.fp-zone[data-zone="' + zone + '"] [data-live]');
      if(t) setTimeout(function(){ t.classList.remove('free'); t.classList.add('occ'); }, 2600);
    }
    function replay(){ fp.classList.remove('play'); void fp.getBoundingClientRect(); fp.classList.add('play'); }
    fp.addEventListener('click', function(e){
      var b = e.target.closest('button[data-zone]'); if(!b) return;
      var z = b.getAttribute('data-zone');
      fp.querySelectorAll('button[data-zone]').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      fp.querySelectorAll('.fp-zone').forEach(function(g){ if(g.getAttribute('data-zone') === z) g.setAttribute('data-on', ''); else g.removeAttribute('data-on'); });
      if(!reduce){ replay(); liveChange(z); }
    });
    if(reduce) return;
    fp.setAttribute('data-anim', '');
    var seen = false;
    watch(fp, function(){ if(seen) return; seen = true; fp.classList.add('play'); liveChange(fp.querySelector('.fp-zone[data-on]').getAttribute('data-zone')); });
  });

  /* ---------------------------------------------------------- Panel en vivo */
  each('[data-num]', function(num){
    var counted = false;
    if(!reduce){
      num.setAttribute('data-anim', '');
      [].forEach.call(num.querySelectorAll('[data-count]'), function(el){ el.textContent = '0'; });
    }
    watch(num, function(){
      num.classList.add('inview');
      if(reduce || counted) return;
      counted = true; num.classList.add('play'); countUp(num.querySelectorAll('[data-count]'));
    }, function(){ num.classList.remove('inview'); });
  });

  /* ---------------------------------------------------------- Cierre: la diferencia se marca una vez */
  each('[data-close]', function(t){
    if(reduce) return;
    t.setAttribute('data-anim', '');
    var seen = false;
    watch(t, function(){ if(seen) return; seen = true; t.classList.add('play'); });
  });

  /* ---------------------------------------------------------- Campañas: un grupo se elige y la cuenta se asienta */
  each('[data-camp]', function(c){
    if(reduce) return;
    var pick = c.querySelector('[data-pick]'), n = c.querySelectorAll('[data-count]');
    c.setAttribute('data-anim', '');
    pick.classList.remove('on');
    [].forEach.call(n, function(el){ el.textContent = '0'; });
    var seen = false;
    watch(c, function(){
      if(seen) return; seen = true;
      setTimeout(function(){ pick.classList.add('on'); countUp(n); }, 500);
    });
  });
})();
