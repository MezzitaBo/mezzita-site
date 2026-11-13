/* Mezzita · secciones de funciones del inicio: WhatsApp con IA, plano y QR, la noche en números.
   Cada una arranca al entrar en pantalla y se pausa fuera de ella. Con movimiento reducido no se toca nada:
   el HTML ya trae el cuadro final. */
(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.25,1,.5,1)';

  function watch(el, enter, leave, threshold){
    if(!('IntersectionObserver' in window)){ enter(); return; }
    new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting) enter(); else if(leave) leave(); });
    }, {threshold: threshold || .25}).observe(el);
  }

  /* Mueve un nodo a otro contenedor y anima el salto desde donde estaba (FLIP). */
  function moveTo(node, slot){
    if(node.parentNode === slot) return;
    var a = node.getBoundingClientRect();
    slot.appendChild(node);
    var b = node.getBoundingClientRect();
    if(node.animate) node.animate([{transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)'}, {transform: 'none'}], {duration: 420, easing: EASE});
  }

  /* ---------------------------------------------------------- WhatsApp con IA */
  var wa = document.querySelector('.feat-wa');
  if(wa && !reduce){
    var chat = wa.querySelector('[data-wa-chat]'), board = wa.querySelector('[data-wa-board]');
    var bubs = [].slice.call(chat.querySelectorAll('.bub'));
    var card = board.querySelector('[data-wa-card]'), note = card.querySelector('[data-wa-note]');
    var stamp = wa.querySelector('[data-wa-stamp]');
    var typing = document.createElement('div');
    typing.className = 'bub them on'; typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    function slot(st){ return board.querySelector('[data-st="' + st + '"]'); }
    function counts(){ [].forEach.call(board.querySelectorAll('.wa-col'), function(c){ c.querySelector('.n').textContent = c.querySelector('.wa-slot').children.length; }); }
    function stage(st, text){ moveTo(card, slot(st)); note.textContent = text; counts(); }
    function show(i){ if(typing.parentNode) typing.remove(); bubs[i].classList.add('on'); }
    function type(i){ chat.insertBefore(typing, bubs[i]); }
    function setStamp(wait){ stamp.textContent = wait ? 'POR CONFIRMAR' : 'ACEPTADO'; stamp.classList.toggle('wait', wait); stamp.style.opacity = '1'; }
    var steps = [
      [0, function(){ bubs.forEach(function(b){ b.classList.remove('on'); }); card.classList.add('hide'); stamp.style.opacity = '0'; stage('nuevo', '¿Hacen delivery a Sopocachi?'); }],
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
      [1800, function(){ show(8); stage('listo', 'Pedido 482 · Listo'); }],
      [1800, function(){ show(9); stage('en_camino', 'Pedido 482 · En camino'); }],
      [1800, function(){ stage('entregado', 'Pedido 482 · Entregado'); }],
      [4200, null]
    ];
    var i = 0, timer = null, running = false;
    function tick(){ var s = steps[i]; if(s[1]) s[1](); i = (i + 1) % steps.length; timer = setTimeout(tick, steps[i][0]); }
    function play(){ if(running) return; running = true; timer = setTimeout(tick, steps[i][0] || 300); }
    function pause(){ running = false; clearTimeout(timer); }
    wa.setAttribute('data-anim', '');
    steps[0][1](); i = 1;
    watch(wa.querySelector('.wa-grid'), play, pause, .3);
    document.addEventListener('visibilitychange', function(){ if(document.hidden) pause(); });
  }

  /* ---------------------------------------------------------- Plano por zonas */
  var fp = document.querySelector('[data-fp]');
  if(fp){
    var lit = {};
    function liveChange(zone){
      if(reduce || lit[zone]) return;
      lit[zone] = true;
      var t = fp.querySelector('.fp-zone[data-zone="' + zone + '"] [data-live]');
      if(t) setTimeout(function(){ t.classList.remove('free'); t.classList.add('occ'); }, 2600);
    }
    function replay(){ fp.classList.remove('play'); void fp.getBoundingClientRect(); fp.classList.add('play'); }
    fp.addEventListener('click', function(e){
      var b = e.target.closest('[data-zone]'); if(!b || b.tagName !== 'BUTTON') return;
      var z = b.getAttribute('data-zone');
      fp.querySelectorAll('button[data-zone]').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      fp.querySelectorAll('.fp-zone').forEach(function(g){ if(g.getAttribute('data-zone') === z) g.setAttribute('data-on', ''); else g.removeAttribute('data-on'); });
      if(!reduce){ replay(); liveChange(z); }
    });
    if(!reduce){
      fp.setAttribute('data-anim', '');
      var seen = false;
      watch(fp, function(){ if(seen) return; seen = true; fp.classList.add('play'); liveChange('salon'); }, null, .3);
    }
  }

  /* ---------------------------------------------------------- La noche en números */
  var num = document.querySelector('[data-num]');
  if(num){
    var fmt = function(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    var counted = false;
    function countUp(){
      [].forEach.call(num.querySelectorAll('[data-count]'), function(el){
        var end = +el.getAttribute('data-count'), t0 = null;
        function frame(t){ if(!t0) t0 = t; var p = Math.min(1, (t - t0) / 900); el.textContent = fmt(end * (1 - Math.pow(1 - p, 3))); if(p < 1) requestAnimationFrame(frame); }
        requestAnimationFrame(frame);
      });
    }
    if(!reduce){
      num.setAttribute('data-anim', '');
      [].forEach.call(num.querySelectorAll('[data-count]'), function(el){ el.textContent = '0'; });
    }
    watch(num, function(){
      num.classList.add('inview');
      if(reduce || counted) return;
      counted = true; num.classList.add('play'); countUp();
    }, function(){ num.classList.remove('inview'); }, .3);
  }
})();
