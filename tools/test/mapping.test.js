// Tabla de respuestas → plan del asistente del demo (docs/demo-vivo.md §2).
// Uso: node --test 'tools/test/*.test.js'
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../assets/demo-vivo/mapping.js');

const map = (answers, chosen) => M.mapAnswers(answers, chosen);
const pick = (r) => ({ template: r.template, plan: r.plan, venues: r.venues });

test('the owner\'s examples', () => {
  // Restaurante pequeño, solo mostrador → Arranca Bs 400.
  assert.deepEqual(pick(map({ rubro: 'cafe', locales: 'uno', atiende: ['mostrador'], inventario: 'no' })),
    { template: 'cafe', plan: 'arranca', venues: 1 });
  // Un food truck → Arranca.
  assert.deepEqual(pick(map({ rubro: 'foodtruck', locales: 'uno', atiende: ['mostrador'], inventario: 'no' })),
    { template: 'foodtruck', plan: 'arranca', venues: 1 });
  // Varios trucks → Escala, cada truck un local.
  assert.deepEqual(pick(map({ rubro: 'foodtruck', locales: 'dos-tres', atiende: ['mostrador'], inventario: 'no' })),
    { template: 'foodtruck', plan: 'escala', venues: 3 });
  assert.deepEqual(pick(map({ rubro: 'foodtruck', locales: 'mas', atiende: ['mostrador'], inventario: 'no' })),
    { template: 'foodtruck', plan: 'escala', venues: 3 });
});

test('food venues only: no discoteca, eventos, «Eventos con entrada» or Noche (owner, 2026-11-26)', () => {
  assert.deepEqual(M.TEMPLATES, ['cafe', 'restaurante', 'pizzeria', 'foodtruck', 'heladeria', 'bar']);
  assert.deepEqual(M.PLANS, ['arranca', 'crece', 'escala']);
  assert.ok(!M.ATIENDE.includes('eventos'));
  assert.equal(M.PLAN_LINE.nightlife, undefined);
  // A link or an old answer with them falls back to a food venue and a food plan.
  for (const rubro of ['discoteca', 'eventos']) {
    assert.deepEqual(pick(map({ rubro, locales: 'uno', inventario: 'no' })), { template: 'restaurante', plan: 'arranca', venues: 1 });
  }
  assert.equal(map({ rubro: 'bar', locales: 'uno', atiende: ['mesas', 'eventos'], inventario: 'no' }).plan, 'crece');
  assert.equal(map({ rubro: 'bar', locales: 'uno', atiende: ['mostrador'], inventario: 'no', plan: 'nightlife' }).plan, 'arranca');
  assert.equal(map({ rubro: 'bar', locales: 'uno', atiende: ['mesas'], inventario: 'no' }, 'nightlife').plan, 'crece', 'a Noche chip is ignored');
});

test('rule 1: two or more locations → escala with 3 venues', () => {
  for (const rubro of ['cafe', 'restaurante', 'pizzeria', 'heladeria', 'bar']) {
    for (const locales of ['dos-tres', 'mas']) {
      assert.deepEqual(pick(map({ rubro, locales, atiende: ['mostrador'], inventario: 'no' })), { template: rubro, plan: 'escala', venues: 3 });
      assert.deepEqual(pick(map({ rubro, locales, atiende: ['mesas', 'reservas'], inventario: 'receta' })), { template: rubro, plan: 'escala', venues: 3 });
    }
  }
});

test('rule 2: mesas, reservas or any inventory → crece', () => {
  const base = { rubro: 'pizzeria', locales: 'uno' };
  assert.equal(map({ ...base, atiende: ['mesas'], inventario: 'no' }).plan, 'crece');
  assert.equal(map({ ...base, atiende: ['reservas'], inventario: 'no' }).plan, 'crece');
  assert.equal(map({ ...base, atiende: ['mostrador'], inventario: 'cuaderno' }).plan, 'crece');
  assert.equal(map({ ...base, atiende: ['delivery'], inventario: 'receta' }).plan, 'crece');
  assert.deepEqual(pick(map({ rubro: 'restaurante', locales: 'uno', atiende: ['mesas'], inventario: 'receta' })),
    { template: 'restaurante', plan: 'crece', venues: 1 });
});

test('rule 3: otherwise → arranca', () => {
  assert.equal(map({ rubro: 'heladeria', locales: 'uno', atiende: ['mostrador', 'delivery'], inventario: 'no' }).plan, 'arranca');
  assert.equal(map({ rubro: 'pizzeria', locales: 'uno', atiende: ['delivery'], inventario: 'no' }).plan, 'arranca');
  assert.equal(map({ rubro: 'bar', locales: 'uno', atiende: ['mostrador'], inventario: 'no' }).plan, 'arranca');
});

test('first matching rule wins', () => {
  // Varios locales + mesas + receta: escala antes que crece.
  assert.equal(map({ rubro: 'restaurante', locales: 'dos-tres', atiende: ['mesas'], inventario: 'receta' }).plan, 'escala');
});

test('the reason line explains the pick', () => {
  assert.equal(map({ rubro: 'restaurante', locales: 'uno', atiende: ['mesas'], inventario: 'receta' }).reason,
    'Porque atiendes en mesas y quieres inventario por receta.');
  assert.equal(map({ rubro: 'restaurante', locales: 'uno', atiende: ['mesas', 'reservas'], inventario: 'cuaderno' }).reason,
    'Porque atiendes en mesas, tomas reservas y llevas tu inventario en cuaderno o Excel.');
  assert.match(map({ rubro: 'foodtruck', locales: 'dos-tres', atiende: ['mostrador'], inventario: 'no' }).reason, /varios trucks/);
  assert.match(map({ rubro: 'pizzeria', locales: 'mas', atiende: ['mostrador'], inventario: 'no' }).reason, /más de tres locales/);
  assert.match(map({ rubro: 'cafe', locales: 'uno', atiende: ['mostrador'], inventario: 'no' }).reason, /mostrador/);
  for (const rubro of M.TEMPLATES) {
    const r = map({ rubro, locales: 'uno', atiende: [], inventario: 'no' });
    assert.match(r.reason, /^Porque .+\.$/, rubro);
  }
});

test('a plan chosen on a chip changes the plan and venues, not the recommendation', () => {
  const a = { rubro: 'restaurante', locales: 'uno', atiende: ['mesas'], inventario: 'receta' };
  const r = map(a, 'arranca');
  assert.equal(r.recommended, 'crece');
  assert.equal(r.plan, 'arranca');
  assert.equal(r.venues, 1);
  assert.equal(map(a, 'escala').venues, 3);
  assert.equal(map({ ...a, locales: 'dos-tres' }, 'crece').venues, 1);
  assert.equal(map(a, 'gratis').plan, 'crece', 'unknown chip is ignored');
});

test('?plan= in a sales link is the recommendation', () => {
  const r = map({ rubro: 'pizzeria', locales: 'uno', plan: 'crece' });
  assert.deepEqual(pick(r), { template: 'pizzeria', plan: 'crece', venues: 1 });
  assert.equal(r.recommended, 'crece');
  // Si el enlace manda un plan distinto al que dirían las respuestas, el porqué describe ese plan.
  const e = map({ rubro: 'cafe', locales: 'uno', atiende: ['mostrador'], inventario: 'no', plan: 'escala' });
  assert.equal(e.recommended, 'escala');
  assert.equal(e.reason, M.PLAN_LINE.escala);
});

test('missing or unknown answers fall back safely', () => {
  assert.deepEqual(pick(map({})), { template: 'restaurante', plan: 'arranca', venues: 1 });
  assert.deepEqual(pick(map(null)), { template: 'restaurante', plan: 'arranca', venues: 1 });
  assert.deepEqual(pick(map({ rubro: 'franquicia', locales: 'siete', atiende: 'mesas', inventario: 'mucho', plan: 'oro' })),
    { template: 'restaurante', plan: 'arranca', venues: 1 });
  // Duplicados y opciones desconocidas no cuentan.
  assert.deepEqual(M.normalize({ rubro: 'bar', atiende: ['mesas', 'mesas', 'karaoke'] }).atiende, ['mesas']);
});

test('every food venue answers the four steps', () => {
  for (const rubro of ['cafe', 'restaurante', 'pizzeria', 'foodtruck', 'heladeria', 'bar', null]) {
    assert.deepEqual(M.stepsFor(rubro), [1, 2, 3, 4]);
  }
});

test('every path lands on a real template, plan and 1–3 venues', () => {
  const atiendes = [[], ['mostrador'], ['mesas'], ['reservas'], ['delivery'], ['mostrador', 'mesas', 'reservas', 'delivery']];
  for (const rubro of M.TEMPLATES) for (const locales of M.LOCALES) for (const atiende of atiendes) for (const inventario of M.INVENTARIO) {
    for (const chosen of [undefined, ...M.PLANS]) {
      const r = map({ rubro, locales, atiende, inventario }, chosen);
      assert.ok(M.TEMPLATES.includes(r.template));
      assert.ok(M.PLANS.includes(r.plan));
      assert.ok(M.PLANS.includes(r.recommended));
      assert.ok(r.venues >= 1 && r.venues <= 3);
      assert.equal(r.template, rubro);
    }
  }
});
