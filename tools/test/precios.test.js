// Los precios de los planes salen de src/_data/precios.json y el asistente del demo los usa todos.
// Uso: node --test 'tools/test/*.test.js'
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../../assets/demo-vivo/mapping.js');

const ROOT = path.resolve(__dirname, '../..');
const precios = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/_data/precios.json'), 'utf8'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('plan prices: Arranca 400, Crece 600, Escala 900; Noche is not on the site (owner, 2026-11-26)', () => {
  assert.equal(precios.plan_arranca, '400');
  assert.equal(precios.plan_crece, '600');
  assert.equal(precios.plan_escala, '900');
  assert.equal(precios.plan_nightlife, undefined);
  assert.equal(precios.install, '3.500');
});

test('the wizard has one chip per plan, named for visitors and priced from precios.json', () => {
  const html = read('src/04-demo.html');
  const names = { arranca: 'Arranca', crece: 'Crece', escala: 'Escala' };
  for (const plan of M.PLANS) {
    const chip = new RegExp(`data-plan="${plan}" data-name="${names[plan]}" data-price="\\{\\{precio:plan_${plan}\\}\\}"`);
    assert.match(html, chip, plan);
    assert.ok(precios['plan_' + plan], 'precios.json has plan_' + plan);
  }
  assert.doesNotMatch(html, /nightlife|Noche|discoteca|data-val="eventos"/i, 'food venues only');
});

test('no page offers Plan Noche or nightlife features (owner, 2026-11-26: food venues only)', () => {
  for (const f of ['src/02-planes.html', 'src/10-funciones.html', 'src/04-demo.html', 'build.py', 'tools/gen/gen.js']) {
    assert.doesNotMatch(read(f), /Plan Noche|plan_nightlife|discotec|manilla|lista de veto/i, f);
  }
});
