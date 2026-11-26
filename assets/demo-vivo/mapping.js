/* Mezzita · demo en vivo: respuestas del asistente → plantilla, plan, locales y el porqué.
   Función pura (sin DOM). Reglas de docs/demo-vivo.md §2, en orden; gana la primera que aplica:
   1. «Dos o tres» o «Más de tres» locales → escala, 3 locales.
   2. mesas o reservas, o lleva inventario → crece.
   3. si no → arranca.
   Un plan elegido a mano (chip o ?plan=) reemplaza al recomendado.
   Solo locales de comida (dueño, 2026-11-26): los demás tipos y planes siguen en la app, el sitio no los ofrece. */
(function (root) {
  'use strict';

  var TEMPLATES = ['cafe', 'restaurante', 'pizzeria', 'foodtruck', 'heladeria', 'bar'];
  var PLANS = ['arranca', 'crece', 'escala'];
  var LOCALES = ['uno', 'dos-tres', 'mas'];
  var ATIENDE = ['mostrador', 'mesas', 'reservas', 'delivery'];
  var INVENTARIO = ['no', 'cuaderno', 'receta'];

  var PLAN_LINE = {
    arranca: 'Menú web, pedidos, caja y WhatsApp para vender desde el primer día.',
    crece: 'Suma mesas con QR, plano de mesas, reservas e inventario por receta.',
    escala: 'Hasta 3 locales en un solo panel, con su caja y su inventario cada uno.'
  };

  function has(list, v) { return list.indexOf(v) !== -1; }

  /** Una lista legible: «a», «a y b», «a, b y c». */
  function joinEs(parts) {
    if (parts.length < 2) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
  }

  /** Respuestas limpias: lo desconocido se descarta. */
  function normalize(a) {
    a = a || {};
    var rubro = has(TEMPLATES, a.rubro) ? a.rubro : null;
    var atiende = (Array.isArray(a.atiende) ? a.atiende : []).filter(function (x, i, arr) {
      return has(ATIENDE, x) && arr.indexOf(x) === i;
    });
    return {
      rubro: rubro,
      locales: has(LOCALES, a.locales) ? a.locales : null,
      atiende: atiende,
      inventario: has(INVENTARIO, a.inventario) ? a.inventario : null,
      plan: has(PLANS, a.plan) ? a.plan : null
    };
  }

  function venuesFor(plan) {
    return plan === 'escala' ? 3 : 1;
  }

  function recommend(a) {
    var multi = a.locales === 'dos-tres' || a.locales === 'mas';
    var truck = a.rubro === 'foodtruck';
    if (multi) {
      var what = truck ? (a.locales === 'mas' ? 'más de tres trucks' : 'varios trucks')
        : (a.locales === 'mas' ? 'más de tres locales' : 'dos o tres locales');
      return { plan: 'escala', reason: 'Porque tienes ' + what + ': ' + (truck ? 'cada truck es un local' : 'cada local') + ' con su caja y su inventario, en un solo panel.' };
    }
    var inv = a.inventario && a.inventario !== 'no';
    if (has(a.atiende, 'mesas') || has(a.atiende, 'reservas') || inv) {
      var c = [];
      if (has(a.atiende, 'mesas')) c.push('atiendes en mesas');
      if (has(a.atiende, 'reservas')) c.push('tomas reservas');
      if (a.inventario === 'receta') c.push('quieres inventario por receta');
      if (a.inventario === 'cuaderno') c.push('llevas tu inventario en cuaderno o Excel');
      return { plan: 'crece', reason: 'Porque ' + joinEs(c) + '.' };
    }
    var d = [];
    if (truck) d.push('vendes desde tu truck con pedidos por nombre');
    else if (has(a.atiende, 'mostrador')) d.push('atiendes en el mostrador o para llevar');
    if (has(a.atiende, 'delivery')) d.push('tienes delivery propio');
    if (!d.length) d.push('empiezas con lo esencial');
    return { plan: 'arranca', reason: 'Porque ' + joinEs(d) + ': pedidos, caja y menú web, sin pagar por lo que no usas.' };
  }

  /**
   * answers: {rubro, locales, atiende: [...], inventario, plan?}
   * → {template, plan, venues, reason, recommended}
   *   template: la plantilla del rubro (restaurante si falta).
   *   recommended: el plan que dicen las reglas (o ?plan= si vino en el enlace).
   *   plan: el que se abre (el recomendado salvo que se elija otro con `chosen`).
   */
  function mapAnswers(answers, chosen) {
    var a = normalize(answers);
    var rec = recommend(a);
    var recommended = a.plan || rec.plan;
    var reason = a.plan && a.plan !== rec.plan ? PLAN_LINE[a.plan] : rec.reason;
    var plan = has(PLANS, chosen) ? chosen : recommended;
    return {
      template: a.rubro || 'restaurante',
      plan: plan,
      venues: venuesFor(plan),
      reason: reason,
      recommended: recommended
    };
  }

  /** Los cuatro pasos, para todo local de comida. */
  function stepsFor() {
    return [1, 2, 3, 4];
  }

  var api = {
    mapAnswers: mapAnswers,
    normalize: normalize,
    stepsFor: stepsFor,
    TEMPLATES: TEMPLATES, PLANS: PLANS, LOCALES: LOCALES, ATIENDE: ATIENDE, INVENTARIO: INVENTARIO,
    PLAN_LINE: PLAN_LINE
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MezzitaMapping = api;
})(typeof self !== 'undefined' ? self : this);
