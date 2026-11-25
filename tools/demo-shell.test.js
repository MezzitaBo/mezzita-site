// Unit tests for the demo shell (assets/demo-vivo): menu builder, frame pool, tour runner, ambient timeline, the
// backend allow-list and the mock. Node's own runner, no dependency: node --test tools/demo-shell.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const dir = path.resolve(__dirname, "../assets/demo-vivo");
const api = require(path.join(dir, "api.js"));
const tours = require(path.join(dir, "tours.js"));
const phone = require(path.join(dir, "phone.js"));
const shell = require(path.join(dir, "shell.js"));

const build = (template, plan, venues = 1) => api.mock({ delay: 0 }).start({ template, plan, venues });
const items = (menu) => Object.fromEntries(menu.flatMap((g) => g.items).map((i) => [i.key, i]));

// --------------------------------------------------------------------------------------------- menu builder --

test("menu: café on Arranca shows what the plan has and dims tables with its cheapest plan", async () => {
  const sb = await build("cafe", "arranca");
  const menu = shell.buildMenu(sb);
  assert.deepEqual(menu.map((g) => g.title), ["Lo que ve tu cliente", "Lo que tu cliente puede hacer", "Tu equipo y tu sistema"]);
  const it = items(menu);
  assert.equal(it.whatsapp.state, "on");
  assert.equal(it.site.state, "on");
  assert.equal(it.menu.state, "on");
  assert.equal(it.table.state, "locked");
  assert.equal(it.table.plan.key, "crece");
  assert.equal(it.table.plan.name, "Crece");
  assert.equal(it.table.plan.price_cents, 60000);
  assert.equal(it.reserve, undefined, "the café template does not use reservations: hidden, not locked");
  assert.equal(it.tickets, undefined);
  assert.equal(it.entry, undefined);
  assert.deepEqual(["owner", "admin", "cashier", "waiter", "kitchen"].map((r) => it[r] && it[r].state), ["on", "on", "on", "on", "on"]);
  assert.equal(it.bar, undefined, "no bar in a café");
  assert.equal(it.door, undefined);
  assert.equal(it.cashier.line, "Cobra, abre y cierra caja, confirma pedidos y pagos. No cambia precios ni configuración.");
});

test("menu: discoteca on Nightlife opens entries, the door and the bar; entry carries both guest pages", async () => {
  const it = items(shell.buildMenu(await build("discoteca", "nightlife")));
  assert.equal(it.tickets.state, "on");
  assert.equal(it.entry.state, "on");
  assert.deepEqual(it.entry.subs, ["entry", "wristband"]);
  assert.equal(it.door.state, "on");
  assert.equal(it.bar.state, "on");
  assert.equal(it.table.state, "on");
});

test("menu: a bar on Crece dims the door and entries with «Plan Nightlife»", async () => {
  const it = items(shell.buildMenu(await build("bar", "crece")));
  assert.equal(it.door.state, "locked");
  assert.equal(it.door.plan.key, "nightlife");
  assert.equal(it.tickets.state, "locked");
  assert.equal(it.tickets.plan.name, "Nightlife");
  assert.equal(it.reserve.state, "on");
});

test("menu: absent module hides, on without a link hides, a role without a member hides", () => {
  const plans = api.PLANS;
  const sb = {
    plans,
    modules: { menu: { on: true, plan: "arranca" }, tables: { on: true, plan: "crece" }, door: { on: false, plan: "nightlife" }, wristbands: { on: false, plan: "nightlife" } },
    links: { menu: "/m/a/b" },
    seats: [{ role: "owner" }, { role: "cashier" }],
    has_bar: false,
  };
  const it = items(shell.buildMenu(sb));
  assert.equal(it.whatsapp, undefined, "no whatsapp module → hidden");
  assert.equal(it.menu.state, "on");
  assert.equal(it.table, undefined, "tables on but no table link was built → hidden");
  assert.equal(it.entry.state, "locked", "door and wristbands both off → locked");
  assert.equal(it.entry.plan.key, "nightlife");
  assert.equal(it.admin, undefined, "no admin member");
  assert.equal(it.owner.state, "on");
  assert.equal(it.door.state, "locked", "a locked role needs no member");
});

test("menu: the cheapest plan follows the backend's plan order", () => {
  const sb = {
    plans: [{ key: "crece", name: "Crece", price_cents: 60000 }, { key: "nightlife", name: "Nightlife", price_cents: 90000 }],
    modules: { door: { on: false, plan: "nightlife" }, wristbands: { on: false, plan: "crece" } },
    links: {},
    seats: [],
  };
  assert.equal(items(shell.buildMenu(sb)).entry.plan.key, "crece");
});

test("menu: top bar plan label and the sales message", () => {
  assert.equal(shell.planLabel({ name: "Crece", price_cents: 60000 }), "Plan Crece · Bs 600 al mes");
  assert.equal(shell.bs(350000), "Bs 3.500");
  const href = shell.waLink("Restaurante con salón", "Crece");
  assert.ok(href.startsWith("https://wa.me/59162506518?text="));
  assert.equal(decodeURIComponent(href.split("text=")[1]), "Hola, vi el demo de restaurante con salón con el plan Crece y quiero hablar con alguien del equipo.");
});

test("plan switch: Escala shows 3 venues, Nightlife keeps 2 when it had several, the rest 1", () => {
  assert.equal(shell.venuesFor("escala", 1), 3);
  assert.equal(shell.venuesFor("nightlife", 3), 2);
  assert.equal(shell.venuesFor("nightlife", 1), 1);
  assert.equal(shell.venuesFor("crece", 3), 1);
  assert.equal(shell.venuesFor("arranca", 1), 1);
});

test("open params are normalised: unknown plan → crece, venues 1..3, name letters and .'&- only, 40 max", () => {
  const p = shell.normalize({ template: "pizzeria", plan: "gratis", venues: 9, name: "  Doña <b>Pepa</b> & Hijos!!  " });
  assert.equal(p.template, "pizzeria");
  assert.equal(p.plan, "crece");
  assert.equal(p.venues, 3);
  assert.equal(p.name, "Doña bPepab & Hijos");
  assert.equal(shell.normalize({ name: "x".repeat(60) }).name.length, 40);
  assert.equal(shell.normalize({ template: "../x" }).template, "restaurante");
});

// ---------------------------------------------------------------------------------------------- frame pool --

test("frame pool: keeps three, drops the least recently shown, names stay stable", () => {
  const made = [];
  const dropped = [];
  const pool = new shell.FramePool({
    max: 3,
    make: (k) => { const el = { name: shell.frameName("team", k) }; made.push(el); return el; },
    drop: (el, k) => dropped.push(k),
  });
  assert.equal(pool.show("owner").created, true);
  pool.show("cashier");
  pool.show("kitchen");
  assert.equal(pool.show("owner").created, false, "already mounted: instant switch");
  assert.deepEqual(pool.keys(), ["cashier", "kitchen", "owner"]);
  pool.show("waiter");
  assert.deepEqual(dropped, ["cashier"], "the least recently shown goes");
  assert.deepEqual(pool.keys(), ["kitchen", "owner", "waiter"]);
  const again = pool.show("cashier");
  assert.equal(again.created, true);
  assert.equal(again.el.name, "mz-demo:cashier", "a re-created seat has the same frame name, so the same storage");
  assert.equal(made.filter((e) => e.name === "mz-demo:cashier").length, 2);
  assert.equal(pool.keys().length, 3);
  pool.clear();
  assert.deepEqual(pool.keys(), []);
  assert.equal(dropped.length, 5);
});

test("frame names: seats are mz-demo:<role>, guest pages are not seats", () => {
  assert.equal(shell.frameName("team", "cashier"), "mz-demo:cashier");
  assert.equal(shell.frameName("guest", "menu"), "mz-guest:menu");
  assert.ok(!shell.frameName("guest", "menu").startsWith("mz-demo:"));
});

// --------------------------------------------------------------------------------------------- tour runner --

const tour = {
  key: "t",
  steps: [
    { text: "uno", until: tours.rose("phone_out") },
    { text: "dos", until: tours.rose("pending") },
    { text: "tres", until: tours.any(tours.fell("pending"), tours.rose("in_kitchen")) },
    { text: "cuatro" },
  ],
};
const snap = (o) => Object.assign({ pending: 1, in_kitchen: 3, ready: 0, to_verify: 1, paid_today_cents: 1000, open_tables: 4, phone_out: 0, phone_in: 0 }, o);

test("tour runner: advances on pulse when the expected change shows, not before", () => {
  const shown = [];
  let ended = null;
  const r = new tours.TourRunner(tour, { show: (s, i, n) => shown.push([s.text, i, n]), end: (c) => (ended = c) });
  r.start(snap());
  assert.deepEqual(shown, [["uno", 0, 4]]);
  assert.equal(r.kicker(), "Recorrido · paso 1 de 4");
  assert.equal(r.observe(snap()), false, "nothing changed");
  assert.equal(r.observe(snap({ pending: 2 })), false, "pending is not what step 1 waits for");
  assert.equal(r.observe(snap({ pending: 2, phone_out: 1 })), true);
  assert.equal(r.i, 1);
  assert.equal(r.observe(snap({ pending: 2, phone_out: 1 })), false, "the base moved with the step: the same pending does not count twice");
  assert.equal(r.observe(snap({ pending: 3, phone_out: 2 })), true);
  assert.equal(r.observe(snap({ pending: 2, phone_out: 2 })), true, "accepting it (pending fell) moves on");
  assert.equal(r.kicker(), "Recorrido · paso 4 de 4");
  assert.equal(r.observe(snap({ pending: 9 })), false, "a step without until waits for the button");
  r.next();
  assert.equal(ended, true);
  assert.equal(r.active, false);
  assert.equal(r.observe(snap({ phone_out: 9 })), false, "a finished tour ignores pulses");
});

test("tour runner: a tour started before the first pulse takes its base from the first snapshot", () => {
  const r = new tours.TourRunner(tour, {});
  r.start(null);
  assert.equal(r.observe(snap({ phone_out: 5 })), false, "first snapshot is only the base");
  assert.equal(r.observe(snap({ phone_out: 6 })), true);
});

test("tour runner: exit ends without completing; back stays inside the tour", () => {
  let ended = null;
  const r = new tours.TourRunner(tour, { end: (c) => (ended = c) });
  r.start(snap());
  r.next();
  r.back();
  assert.equal(r.i, 0);
  r.back();
  assert.equal(r.i, 0);
  r.exit();
  assert.equal(ended, false);
});

test("recorridos: only the ones the sandbox can show, roles only with a seat", () => {
  const on = (keys) => (k) => keys.includes(k);
  const cafe = tours.toursFor({ on: on(["whatsapp", "menu", "site", "customers", "owner", "admin", "cashier", "waiter", "kitchen"]), venue: "La Mesa Chica", venues: 1 });
  assert.deepEqual(cafe.map((t) => t.title), ["Un pedido por WhatsApp", "Quién ve qué", "Tus clientes vuelven"]);
  assert.equal(cafe[0].steps.length, 6);
  assert.match(cafe[0].steps[0].text, /La Mesa Chica/);
  assert.deepEqual(cafe[1].steps.map((s) => s.team), ["owner", "admin", "cashier", "waiter", "kitchen"]);
  const all = ["whatsapp", "table", "customers", "inventory", "tickets", "entry", "owner", "admin", "cashier", "waiter", "kitchen", "bar", "door"];
  const night = tours.toursFor({ on: on(all), venue: "Club Órbita", venues: 2 });
  assert.deepEqual(night.map((t) => t.key), ["whatsapp", "mesa", "roles", "clientes", "inventario", "noche", "sucursales"]);
  const noche = night.find((t) => t.key === "noche");
  assert.deepEqual(noche.steps.map((s) => s.play && s.play.script).filter(Boolean), ["door_checkin", "wristband"]);
  assert.deepEqual(night.find((t) => t.key === "mesa").steps[3].team, ["kitchen", "bar"], "cashier and kitchen side by side at 1440 px");
});

// ----------------------------------------------------------------------------------------- ambient timeline --

function clock() {
  let now = 0;
  const timers = [];
  return {
    setTimeout: (f, ms) => { const t = { at: now + ms, f }; timers.push(t); return t; },
    clearTimeout: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
    tick(ms) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > end) break;
        const t = timers.shift();
        now = t.at;
        t.f();
      }
      now = end;
    },
  };
}

test("ambient: first event at 20 s, then every 45 to 90 s, each once, at most 12", () => {
  const c = clock();
  const played = [];
  const events = Array.from({ length: 20 }, (_, i) => ({ kind: "order", after_s: i }));
  const a = new tours.Ambient(events, (i) => played.push(i), { random: () => 0, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout });
  a.start();
  c.tick(19999);
  assert.deepEqual(played, []);
  c.tick(1);
  assert.deepEqual(played, [0]);
  c.tick(44999);
  assert.deepEqual(played, [0]);
  c.tick(1);
  assert.deepEqual(played, [0, 1]);
  c.tick(3600e3);
  assert.equal(played.length, 12, "capped at 12");
  assert.deepEqual(played, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("ambient: holds while the tab is hidden and fires once when it comes back; resumes from a saved index", () => {
  const c = clock();
  const played = [];
  const a = new tours.Ambient([{}, {}, {}], (i) => played.push(i), { random: () => 1, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout });
  a.start();
  a.hold();
  c.tick(600e3);
  assert.deepEqual(played, []);
  a.release();
  assert.deepEqual(played, [0]);
  c.tick(89999);
  assert.deepEqual(played, [0]);
  c.tick(1);
  assert.deepEqual(played, [0, 1]);
  a.stop();
  c.tick(600e3);
  assert.deepEqual(played, [0, 1]);
  const b = new tours.Ambient([{}, {}, {}], (i) => played.push(i), { from: 2, random: () => 0, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout });
  b.start();
  c.tick(45000);
  assert.deepEqual(played, [0, 1, 2], "a resumed demo does not replay the first events");
});

// ------------------------------------------------------------------------------------------- backend, mock --

test("backend: ?backend= is read from an allow-list; unknown or unconfigured falls back to the default", () => {
  assert.equal(api.pickBackend("?backend=mock"), "mock");
  assert.equal(api.pickBackend("?rubro=bar&backend=staging"), "staging");
  assert.equal(api.pickBackend("?backend=evil"), api.DEFAULT_BACKEND);
  assert.equal(api.pickBackend("?backend=__proto__"), api.DEFAULT_BACKEND);
  assert.equal(api.pickBackend("?backend=demo"), api.usable("demo") ? "demo" : api.DEFAULT_BACKEND);
  assert.equal(api.pickBackend(""), api.DEFAULT_BACKEND);
});

test("backend: error statuses map to the Spanish lines of §3", () => {
  assert.equal(api.codeFor(410, {}), "expired");
  assert.equal(api.codeFor(429, {}), "rate_limited");
  assert.equal(api.codeFor(503, { error: "full" }), "full");
  assert.equal(api.codeFor(404, { error: "demo_off" }), "demo_off");
  assert.equal(api.codeFor(500, { error: "<script>" }), "unknown");
  const e = api.DemoError("expired", 410);
  assert.equal(e.message, "Tu demo se cerró por inactividad.");
  assert.equal(e.expired, true);
  assert.equal(api.DemoError("full", 503).message, "Hay muchas demos abiertas. Prueba en un minuto.");
});

test("mock: the WhatsApp order script ends in an order to confirm; replaying a step adds nothing", async () => {
  const m = api.mock({ delay: 0 });
  const sb = await m.start({ template: "pizzeria", plan: "crece", venues: 1 });
  const p0 = await m.pulse(sb, null);
  const steps = sb.wa.scripts.wa_order;
  let step = phone.nextGuest(steps, 0);
  let r;
  while (step !== null) {
    r = await m.play(sb, "wa_order", step);
    assert.ok(r.messages[0].from === "guest");
    step = r.next;
  }
  assert.equal(r.done, true);
  const p1 = await m.pulse(sb, p0.cursor);
  assert.equal(p1.state.pending, p0.state.pending + 1);
  assert.equal(p1.messages.length, steps.length);
  const again = await m.play(sb, "wa_order", 0);
  assert.deepEqual(again.messages, [], "idempotent replay");
  m.act(sb, "accept"); // the phone's order goes first: it is the one the guide points at
  m.act(sb, "ready");
  const p2 = await m.pulse(sb, p1.cursor);
  assert.equal(p2.state.ready, 1);
  assert.equal(p2.state.pending, p0.state.pending, "the seeded web order still waits");
  assert.equal(p2.messages.length, 1, "the phone gets the «listo» notice of its own order");
  assert.match(p2.messages[0].text, /listo/);
});

test("mock: a wrong key is refused and an expired sandbox answers expired", async () => {
  const m = api.mock({ delay: 0 });
  const sb = await m.start({ template: "cafe", plan: "arranca", venues: 1 });
  await assert.rejects(m.pulse({ sandbox: sb.sandbox, key: "x" }), (e) => e.code === "bad_key" && e.expired);
  m.act(sb, "expire");
  await assert.rejects(m.pulse(sb, null), (e) => e.code === "expired" && e.status === 410);
  await assert.rejects(m.start({ template: "nope", plan: "crece" }), (e) => e.code === "not_found");
});

test("mock: the start shape matches the contract", async () => {
  const sb = await build("foodtruck", "escala", 3);
  for (const k of ["sandbox", "key", "expires_at", "template", "label", "plan", "plans", "org", "venues", "modules", "has_bar", "seats", "links", "wa"]) {
    assert.ok(k in sb, "missing " + k);
  }
  assert.equal(sb.key.length, 43);
  assert.equal(sb.venues.length, 3);
  assert.deepEqual(Object.keys(sb.org).sort(), ["id", "name", "slug"]);
  assert.equal(sb.modules.tables, undefined, "a food truck has no tables");
  assert.ok(sb.wa.scripts.wa_order && sb.wa.scripts.wa_reservation && sb.wa.scripts.wa_handoff);
});

// --------------------------------------------------------------------------------------------- phone chips --

test("phone: chips show every script's first line, then only the running script's next line", () => {
  const scripts = { wa_order: [{ guest: "a" }, { assistant: "x" }, { guest: "b" }], wa_handoff: [{ guest: "c" }] };
  const flows = { wa_order: { next: 0 }, wa_handoff: { next: 0 } };
  assert.deepEqual(phone.chipsFor(scripts, flows, null).map((c) => c.text), ["a", "c"]);
  flows.wa_order.next = 2;
  assert.deepEqual(phone.chipsFor(scripts, flows, "wa_order").map((c) => [c.text, c.step]), [["b", 2]]);
  flows.wa_order.next = null;
  assert.deepEqual(phone.chipsFor(scripts, flows, null).map((c) => c.text), ["c"]);
});
