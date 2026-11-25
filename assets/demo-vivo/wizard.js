/* Mezzita · demo en vivo: el asistente de /demo/ (docs/demo-vivo.md §2).
   Cuatro pasos y un resultado; al final llama a window.MezzitaDemo.open({template, plan, venues, name}),
   que vive en shell.js (carril L6) y dibuja el demo en <div id="demo-vivo">.
   Enlace para ventas: /demo/?rubro=pizzeria&plan=crece&locales=1&nombre=... salta los pasos respondidos.
   Atrás y adelante del navegador recorren los pasos sin perder respuestas. */
(function () {
  'use strict';
  var M = window.MezzitaMapping;
  var root = document.getElementById('demo-wizard');
  if (!M || !root) return;

  var KEY = 'mz.demo.wizard';
  var NAMES = { 1: 'negocio', 2: 'locales', 3: 'atiende', 4: 'inventario', resultado: 'resultado' };
  var NAME_OK = /^[\p{L}\p{N} .'&-]*$/u;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var A = { rubro: null, locales: null, atiende: [], inventario: null, plan: null };
  var chosen = null;     // plan elegido en un chip
  var nombre = '';
  var cur = null;        // pantalla visible: 1..4, 'resultado' o 'armando'
  var from = null;       // pantalla desde la que se abrió el demo
  var pos = 0;           // posición en el historial propio
  var opened = false;
  var building = 0;      // turno de la apertura en curso
  var last = null;       // parámetros de la última apertura
  var pre = {};          // pasos que respondió el enlace y aún no se mostraron: se saltan al avanzar

  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var screen = function (id) { return $('.mzw-step[data-step="' + id + '"]'); };
  var input = $('#mzw-nombre');

  /* ---------------------------------------------------------- estado */
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify({ q: location.search, A: A, chosen: chosen, nombre: nombre })); } catch (e) {}
  }
  function cleanName(s) {
    return String(s || '').replace(/[‘’ʼ`´]/g, "'").replace(/\s+/g, ' ').slice(0, 40);
  }
  function fromQuery(q) {
    var a = { atiende: [] };
    var r = (q.get('rubro') || '').toLowerCase();
    if (r === 'franquicia') a.locales = 'dos-tres'; else a.rubro = r;
    var l = (q.get('locales') || '').toLowerCase(), n = parseInt(l, 10);
    if (l === 'uno' || n === 1) a.locales = 'uno';
    else if (l === 'dos-tres' || n === 2 || n === 3) a.locales = 'dos-tres';
    else if (l === 'mas' || n >= 4) a.locales = 'mas';
    a.atiende = (q.get('atiende') || '').toLowerCase().split(',');
    a.inventario = (q.get('inventario') || '').toLowerCase();
    a.plan = (q.get('plan') || '').toLowerCase();
    A = M.normalize(a);
    [1, 2, 3, 4].forEach(function (s) { if (answered(s)) pre[s] = 1; });
    var nm = cleanName(q.get('nombre'));
    nombre = NAME_OK.test(nm) ? nm.trim() : '';
  }
  function load() {
    var st = null;
    try { st = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (st && st.q === location.search && st.A) {
      A = M.normalize(st.A);
      chosen = M.PLANS.indexOf(st.chosen) !== -1 ? st.chosen : null;
      nombre = typeof st.nombre === 'string' ? cleanName(st.nombre) : '';
    } else {
      fromQuery(new URLSearchParams(location.search));
    }
  }

  /* ---------------------------------------------------------- pasos */
  function steps() { return M.stepsFor(A.rubro).concat('resultado'); }
  function answered(s) {
    if (s === 1) return !!A.rubro;
    if (s === 2) return !!A.locales;
    if (s === 3) return A.atiende.length > 0 || !!A.plan;
    if (s === 4) return !!A.inventario || !!A.plan;
    return false;
  }
  function firstOpen() {
    var list = steps();
    for (var i = 0; i < list.length; i++) if (!answered(list[i])) return list[i];
    return 'resultado';
  }
  /** La pantalla pedida, o la primera sin responder si todavía no se llega ahí. */
  function reachable(id) {
    var list = steps(), at = list.indexOf(id);
    if (at === -1) return firstOpen();
    for (var i = 0; i < at; i++) if (!answered(list[i])) return list[i];
    return id;
  }
  function hashFor(id) { return id === 'resultado' ? '#resultado' : '#paso-' + id; }
  function idFromHash(h) {
    var m = /^#paso-([1-4])$/.exec(h || '');
    return m ? +m[1] : h === '#resultado' || h === '#demo' ? 'resultado' : null;
  }
  function url(hash) { return location.pathname + location.search + hash; }

  /* ---------------------------------------------------------- analítica (sin datos personales) */
  function track(event, props) {
    var o = { event: event };
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) o[k] = props[k];
    try { (window.dataLayer = window.dataLayer || []).push(o); } catch (e) {}
  }

  /* ---------------------------------------------------------- pintar */
  function paintCards() {
    $$('.mzw-card').forEach(function (b) {
      var k = b.getAttribute('data-key'), v = b.getAttribute('data-val');
      var on = k === 'atiende' ? A.atiende.indexOf(v) !== -1 : A[k] === v;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var only = b.getAttribute('data-only');
      if (only) b.hidden = only.split(' ').indexOf(A.rubro) === -1;
    });
    var t2 = $('#mzw-t2');
    if (!t2.hasAttribute('data-default')) t2.setAttribute('data-default', t2.textContent);
    t2.textContent = A.rubro === 'foodtruck' ? t2.getAttribute('data-truck') : t2.getAttribute('data-default');
  }

  function paintResult() {
    var r = M.mapAnswers(A, chosen);
    var rec = $('.mzw-chip[data-plan="' + r.recommended + '"]');
    $('#mzw-rec').textContent = rec.getAttribute('data-name') + ': Bs ' + rec.getAttribute('data-price') + ' al mes';
    $('#mzw-why').textContent = r.reason;
    $$('.mzw-chip').forEach(function (c) {
      var p = c.getAttribute('data-plan');
      c.setAttribute('aria-pressed', p === r.plan ? 'true' : 'false');
      c.classList.toggle('is-rec', p === r.recommended);
    });
    $('#mzw-other span').hidden = r.plan === r.recommended;
    if (input.value !== nombre) input.value = nombre;
    checkName();
    return r;
  }

  function show(id, mode) {
    if (id !== 'armando') id = reachable(id);
    cur = id;
    delete pre[id];
    $$('.mzw-step').forEach(function (s) { s.hidden = s.getAttribute('data-step') !== String(id); });
    var list = steps(), at = list.indexOf(id), total = list.length - 1;
    var isStep = at !== -1 && id !== 'resultado';
    $('#mzw-count').textContent = isStep ? 'Paso ' + (at + 1) + ' de ' + total : '';
    $('#mzw-bar').style.width = (id === 'resultado' || id === 'armando' ? 100 : (at / total) * 100) + '%';
    $('[data-skip]').hidden = !isStep;
    $('.mzw-foot [data-back]').hidden = !(at > 0);
    $('#mzw-e3').hidden = true;
    paintCards();
    if (id === 'resultado') paintResult();

    if (id !== 'armando') {
      var st = { mzw: id, i: pos };
      if (mode === 'push') { st.i = ++pos; history.pushState(st, '', url(hashFor(id))); }
      else if (mode === 'replace') history.replaceState(st, '', url(hashFor(id)));
      var ev = { step: NAMES[id], paso: at + 1 };
      if (A.rubro) ev.template = A.rubro;
      track('demo_step', ev);
      save();
    }
    if (mode !== 'init') {
      var top = root.getBoundingClientRect().top + window.scrollY - 96;
      if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
      var h = $('.mzw-title', screen(id));
      if (h) h.focus({ preventScroll: true });
    }
  }

  function next() {
    var list = steps(), i = list.indexOf(cur) + 1;
    while (i < list.length - 1 && pre[list[i]] && answered(list[i])) i++;
    show(list[Math.min(i, list.length - 1)], 'push');
  }
  function back() {
    if (cur === 'armando') { building = 0; return show(from || 'resultado', 'replace'); }
    if (pos > 0 && history.state && history.state.mzw) return history.back();
    var list = steps(), at = list.indexOf(cur);
    if (at > 0) show(list[at - 1], 'replace');
  }

  /* ---------------------------------------------------------- respuestas */
  function answer(b) {
    var k = b.getAttribute('data-key'), v = b.getAttribute('data-val');
    if (k === 'atiende') {
      var i = A.atiende.indexOf(v);
      if (i === -1) A.atiende.push(v); else A.atiende.splice(i, 1);
      A.plan = null; chosen = null;
      $('#mzw-e3').hidden = true;
      paintCards(); save();
      return;
    }
    if (A[k] !== v) {
      A[k] = v;
      A = M.normalize(A);
      A.plan = null; chosen = null;
    }
    next();
  }

  function checkName() {
    var ok = NAME_OK.test(input.value);
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    $('#mzw-nombre-err').hidden = ok;
    return ok;
  }

  /* ---------------------------------------------------------- abrir el demo
     Contrato con shell.js (nota demo-shell-api.md): open() devuelve una promesa; el shell avisa con eventos en
     document: mezzita-demo:open (toma la pantalla: el asistente se esconde), mezzita-demo:close (el visitante salió
     del demo: vuelve el asistente). saved()/resume() reabren un demo vivo al recargar. */
  function demo() { return window.MezzitaDemo || null; }
  function fail(err) {
    if (opened) return; // el shell ya está a la vista y muestra su propio error
    var msg = err && (err.userMessage || (err.name === 'DemoError' && err.message));
    $('#mzw-fail-msg').textContent = msg || 'No pudimos abrir tu demo. Prueba de nuevo en un minuto.';
    $('#mzw-fail').hidden = false;
    $('.mzw-building').classList.add('is-failed');
    $('[data-retry]').focus({ preventScroll: true });
  }
  /** El demo tomó la pantalla. */
  function hideWizard() {
    if (opened) return;
    building = 0;
    opened = true;
    root.hidden = true;
    if (!(history.state && history.state.mzw === 'demo')) history.pushState({ mzw: 'demo', i: ++pos }, '', url('#demo'));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  /** El visitante salió del demo: vuelve el asistente en el resultado. */
  function showWizard(mode) {
    building = 0;
    if (!opened && !root.hidden) return;
    opened = false;
    root.hidden = false;
    show('resultado', mode || 'replace');
  }
  function openDemo(params, resume) {
    last = params;
    if (cur !== 'armando') from = cur;
    show('armando');
    $('#mzw-fail').hidden = true;
    $('.mzw-building').classList.remove('is-failed');
    if (!resume) track('demo_start', { template: params.template, plan: params.plan });
    var turn = ++building;
    var D = demo(), res;
    if (!D || typeof D.open !== 'function') return fail();
    try {
      res = resume && typeof D.resume === 'function' ? D.resume()
        : D.open({ template: params.template, plan: params.plan, venues: params.venues, name: params.name });
    } catch (e) { return fail(e); }
    if (res && typeof res.then === 'function') {
      res.then(function () { if (turn === building) hideWizard(); }, function (e) { if (turn === building) fail(e); });
    } else hideWizard();
  }
  document.addEventListener('mezzita-demo:open', hideWizard);
  document.addEventListener('mezzita-demo:close', function () { showWizard(); });

  /* ---------------------------------------------------------- eventos */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.classList.contains('mzw-card')) return answer(t);
    if (t.classList.contains('mzw-chip')) {
      chosen = t.getAttribute('data-plan');
      paintResult(); save();
      return;
    }
    if (t.hasAttribute('data-next')) {
      if (!A.atiende.length) { $('#mzw-e3').hidden = false; $('.mzw-card', screen(3)).focus(); return; }
      return next();
    }
    if (t.hasAttribute('data-back')) return back();
    if (t.hasAttribute('data-skip')) return openDemo({ template: 'restaurante', plan: 'crece', venues: 1, name: null });
    if (t.hasAttribute('data-retry')) return last && openDemo(last);
    if (t.hasAttribute('data-open')) {
      if (!checkName()) return input.focus();
      var r = M.mapAnswers(A, chosen);
      return openDemo({ template: r.template, plan: r.plan, venues: r.venues, name: nombre.trim() || null });
    }
  });

  input.addEventListener('input', function () {
    var v = cleanName(input.value);
    if (v !== input.value) input.value = v;
    nombre = v;
    checkName(); save();
  });
  input.addEventListener('blur', function () {
    nombre = input.value = nombre.trim();
    save();
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('[data-open]').click(); }
  });

  window.addEventListener('popstate', function (e) {
    var st = e.state && e.state.mzw ? e.state : null;
    var id = st ? st.mzw : idFromHash(location.hash);
    if (st) pos = st.i || 0;
    building = 0;
    if (id === 'demo') {
      if (opened) return;
      id = 'resultado';
    }
    if (opened) {
      opened = false;
      root.hidden = false;
      var D = demo();
      if (D && typeof D.close === 'function') D.close();
    }
    show(id || firstOpen(), st ? 'pop' : 'replace');
  });

  /** Para que el demo pueda volver al asistente con las respuestas puestas. */
  window.MezzitaWizard = { show: function () { showWizard('push'); } };

  /* ---------------------------------------------------------- inicio */
  load();
  var start = idFromHash(location.hash);
  var D0 = demo(), saved = null;
  try { saved = D0 && typeof D0.saved === 'function' ? D0.saved() : null; } catch (e) {}
  show(saved ? 'resultado' : start ? reachable(start) : firstOpen(), 'init');
  history.replaceState({ mzw: cur, i: 0 }, '', url(hashFor(cur)));
  // Un demo vivo de esta pestaña (recarga): se reabre sin volver a preguntar.
  if (saved) openDemo(saved, true);
})();
