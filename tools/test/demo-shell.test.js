// Unit tests for the demo shell (assets/demo-vivo): menu builder, frame pool, tour runner, the WhatsApp timeline
// (12 scripted conversations, owner decision D2), the active clock, the ambient timeline, the backend allow-list,
// the error codes of L2/L3 and the mock. Node's own runner, no dependency: node --test 'tools/test/*.test.js'
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const dir = path.resolve(__dirname, "../../assets/demo-vivo");
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

test("menu: discoteca on Noche opens entries, the door and the bar; entry carries both guest pages", async () => {
  const it = items(shell.buildMenu(await build("discoteca", "nightlife")));
  assert.equal(it.tickets.state, "on");
  assert.equal(it.entry.state, "on");
  assert.deepEqual(it.entry.subs, ["entry", "wristband"]);
  assert.equal(it.door.state, "on");
  assert.equal(it.bar.state, "on");
  assert.equal(it.table.state, "on");
});

test("menu: a bar on Crece dims the door and entries with the backend's name for nightlife, «Noche»", async () => {
  const it = items(shell.buildMenu(await build("bar", "crece")));
  assert.equal(it.door.state, "locked");
  assert.equal(it.door.plan.key, "nightlife");
  assert.equal(it.tickets.state, "locked");
  assert.equal(it.tickets.plan.name, "Noche");
  assert.equal(it.tickets.plan.price_cents, 150000);
  assert.equal(it.reserve.state, "on");
});

test("menu: absent module hides, on without a link hides, a role without a member hides", () => {
  const sb = {
    plans: api.PLANS,
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

test("menu: the cheapest plan follows the backend's plan order; a module no plan has gets no chip", () => {
  const sb = {
    plans: [{ key: "crece", name: "Crece", price_cents: 60000 }, { key: "nightlife", name: "Noche", price_cents: 150000 }],
    modules: { door: { on: false, plan: "nightlife" }, wristbands: { on: false, plan: "crece" }, events: { on: false, plan: null } },
    links: {},
    seats: [],
  };
  const it = items(shell.buildMenu(sb));
  assert.equal(it.entry.plan.key, "crece");
  assert.equal(it.tickets.state, "locked");
  assert.equal(it.tickets.plan, null);
});

test("menu: top bar plan label and the sales message", () => {
  assert.equal(shell.planLabel({ name: "Crece", price_cents: 60000 }), "Plan Crece · Bs 600 al mes");
  assert.equal(shell.planLabel({ name: "Noche", price_cents: 150000 }), "Plan Noche · Bs 1.500 al mes");
  assert.equal(shell.bs(350000), "Bs 3.500");
  const href = shell.waLink("Restaurante con salón", "Crece");
  assert.ok(href.startsWith("https://wa.me/59162506518?text="));
  assert.equal(decodeURIComponent(href.split("text=")[1]), "Hola, vi el demo de restaurante con salón con el plan Crece y quiero hablar con alguien del equipo.");
});

test("plan switch: Escala shows 3 venues, Noche keeps 2 when it had several, the rest 1", () => {
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
  assert.equal(shell.normalize({ name: null }).name, "", "the wizard sends null when there is no name");
});

test("venue site URL (L7): org, venue, template, the event's slug and the backend", async () => {
  const sb = await build("discoteca", "nightlife");
  const u = new URL(shell.sitePath(sb, "staging"), "https://mezzita.com");
  assert.equal(u.pathname, "/demo/sitio/");
  assert.equal(u.searchParams.get("org"), sb.org.slug);
  assert.equal(u.searchParams.get("venue"), "centro");
  assert.equal(u.searchParams.get("tpl"), "discoteca");
  assert.equal(u.searchParams.get("evento"), "esta-noche");
  assert.equal(u.searchParams.get("backend"), "staging");
  const cafe = new URL(shell.sitePath(await build("cafe", "arranca"), "mock"), "https://mezzita.com");
  assert.equal(cafe.searchParams.has("evento"), false, "no event: no evento");
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
    { text: "uno", until: tours.reach("f_rank", 1) },
    { text: "dos", until: tours.rose("pending") },
    { text: "tres", until: tours.any(tours.fell("pending"), tours.rose("in_kitchen")) },
    { text: "cuatro" },
  ],
};
const snap = (o) => Object.assign({ pending: 1, in_kitchen: 3, ready: 0, to_verify: 1, paid_today_cents: 1000, open_tables: 4, chats: 0, max_rank: 0, f_rank: 0, f_appr: 0 }, o);

test("tour runner: advances on pulse when the expected change shows, not before", () => {
  const shown = [];
  let ended = null;
  const r = new tours.TourRunner(tour, { show: (s, i, n) => shown.push([s.text, i, n]), end: (c) => (ended = c) });
  r.start(snap());
  assert.deepEqual(shown, [["uno", 0, 4]]);
  assert.equal(r.kicker(), "Recorrido · paso 1 de 4");
  assert.equal(r.observe(snap()), false, "nothing changed");
  assert.equal(r.observe(snap({ pending: 2 })), false, "pending is not what step 1 waits for");
  assert.equal(r.observe(snap({ pending: 2, f_rank: 1 })), true, "the followed chat reached «Nuevo lead»");
  assert.equal(r.i, 1);
  assert.equal(r.observe(snap({ pending: 2, f_rank: 1 })), false, "the base moved with the step: the same pending does not count twice");
  assert.equal(r.observe(snap({ pending: 3, f_rank: 2 })), true);
  assert.equal(r.observe(snap({ pending: 2, f_rank: 2 })), true, "accepting it (pending fell) moves on");
  assert.equal(r.kicker(), "Recorrido · paso 4 de 4");
  assert.equal(r.observe(snap({ pending: 9 })), false, "a step without until waits for the button");
  r.next();
  assert.equal(ended, true);
  assert.equal(r.active, false);
  assert.equal(r.observe(snap({ f_rank: 9 })), false, "a finished tour ignores pulses");
});

test("tour runner: a tour started before the first pulse takes its base from the first snapshot", () => {
  const t = { key: "x", steps: [{ text: "a", until: tours.rose("chats") }, { text: "b" }] };
  const r = new tours.TourRunner(t, {});
  r.start(null);
  assert.equal(r.observe(snap({ chats: 5 })), false, "first snapshot is only the base");
  assert.equal(r.observe(snap({ chats: 6 })), true);
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

test("recorridos: «Mira tu WhatsApp trabajar solo» first when WhatsApp is on; roles only with a seat", () => {
  const on = (keys) => (k) => keys.includes(k);
  const cafe = tours.toursFor({ on: on(["whatsapp", "menu", "site", "customers", "owner", "admin", "cashier", "waiter", "kitchen"]), guest: "Carla M.", venues: 1 });
  assert.deepEqual(cafe.map((t) => t.title), ["Mira tu WhatsApp trabajar solo", "Un pedido por WhatsApp", "Quién ve qué", "Tus clientes vuelven"]);
  const order = cafe[1];
  assert.equal(order.steps.length, 7);
  assert.equal(order.follow, true);
  assert.match(order.steps[0].text, /^Carla M\. escribe/);
  assert.deepEqual(order.steps.map((s) => s.team), ["owner", "owner", "owner", "cashier", "kitchen", "owner", "owner"]);
  assert.deepEqual(cafe[2].steps.map((s) => s.team), ["owner", "admin", "cashier", "waiter", "kitchen"]);
  const all = ["whatsapp", "table", "customers", "inventory", "tickets", "entry", "wristbands", "owner", "admin", "cashier", "waiter", "kitchen", "bar", "door"];
  const night = tours.toursFor({ on: on(all), venues: 2 });
  assert.deepEqual(night.map((t) => t.key), ["wa-solo", "whatsapp", "mesa", "roles", "clientes", "inventario", "noche", "sucursales"]);
  const noche = night.find((t) => t.key === "noche");
  assert.deepEqual(noche.steps.map((s) => s.play).filter(Boolean), [{ script: "door_checkin" }, { script: "wristband", step: 0 }, { script: "wristband", step: 1 }]);
  assert.deepEqual(night.find((t) => t.key === "mesa").steps[3].team, ["kitchen", "bar"], "cashier and kitchen side by side at 1440 px");
  assert.equal(tours.toursFor({ on: on(["owner"]) })[0].key, "roles", "no WhatsApp: no WhatsApp recorridos");
});

test("recorrido «Un pedido por WhatsApp» follows conversation 1, or the next order chat that has not started", () => {
  const tl = [{ conv: 1, kind: "order_pickup" }, { conv: 2, kind: "question" }, { conv: 3, kind: "order_delivery" }, { conv: 5, kind: "order_qr" }, { conv: 7, kind: "order_here" }];
  assert.equal(tours.pickFollow(tl, {}), 1);
  assert.equal(tours.pickFollow(tl, { 1: "nuevo" }), 1, "still in Nuevo lead: follow it");
  assert.equal(tours.pickFollow(tl, { 1: "conversando", 2: "nuevo" }), 3, "conversation 1 is past it; questions are skipped");
  assert.equal(tours.pickFollow(tl, { 1: "conversando", 3: "pedido" }), 7, "a QR order skips the cashier: not followed");
  assert.equal(tours.pickFollow(tl, { 1: "entregado", 3: "pedido", 7: "listo" }), 1, "all past: back to 1");
  assert.equal(tours.rank("en_camino"), 5);
  assert.equal(tours.rank("no_relevante"), 7);
  assert.equal(tours.rank(undefined), 0);
});

// ---------------------------------------------------------------------------------- WhatsApp timeline (D2) --

function fakeNow() { let t = 0; return { now: () => t, set: (v) => (t = v), add: (v) => (t += v) }; }
const flush = () => new Promise((r) => setImmediate(r));
const conv = (n, start, beats) => ({ conv: n, kind: "order_pickup", guest_name: "G" + n, start_s: start, beats });

test("timeline: beat 0 at start_s, then each beat after_s (+hold_s) after the previous one finished", async () => {
  const clock = fakeNow();
  const played = [];
  const tl = new tours.WaTimeline([conv(1, 8, [{ after_s: 0, type: "guest" }, { after_s: 3, type: "assistant" }, { after_s: 0, hold_s: 40, type: "staff" }])], {
    now: clock.now,
    play: (c, b) => { played.push([c, b, clock.now()]); return Promise.resolve({ ok: true, next: b + 1 < 3 ? b + 1 : null, done: b === 2 }); },
  });
  clock.set(7999); tl.tick(); await flush();
  assert.deepEqual(played, []);
  clock.set(8000); tl.tick(); await flush();
  assert.deepEqual(played.map((p) => p[1]), [0]);
  clock.set(10999); tl.tick(); await flush();
  assert.equal(played.length, 1, "3 s after the first beat finished, not before");
  clock.set(11000); tl.tick(); await flush();
  assert.equal(played.length, 2);
  clock.set(50999); tl.tick(); await flush();
  assert.equal(played.length, 2, "the hold gives the visitor 40 s to do it by hand");
  clock.set(51000); tl.tick(); await flush();
  assert.equal(played.length, 3);
  assert.equal(tl.over(), true);
  clock.set(1e9); tl.tick(); await flush();
  assert.equal(played.length, 3, "a finished conversation plays nothing more");
});

test("timeline: one request in flight per conversation; conversations run side by side", async () => {
  const clock = fakeNow();
  const pending = [];
  const tl = new tours.WaTimeline([conv(1, 0, [{ after_s: 0, type: "guest" }, { after_s: 0, type: "guest" }]), conv(2, 0, [{ after_s: 0, type: "guest" }])], {
    now: clock.now,
    play: (c, b) => new Promise((res) => pending.push({ c, b, res })),
  });
  clock.set(1);
  assert.deepEqual(tl.tick(), [1, 2]);
  await flush();
  assert.deepEqual(tl.tick(), [], "both busy: nothing fired twice");
  pending[0].res({ ok: true, next: 1 });
  await flush();
  clock.add(1);
  assert.deepEqual(tl.tick(), [1]);
  await flush();
  assert.deepEqual(pending.map((p) => [p.c, p.b]), [[1, 0], [2, 0], [1, 1]]);
});

test("timeline: stopped (by the reply or by a 409) ends that conversation only", async () => {
  const clock = fakeNow();
  const played = [];
  const tl = new tours.WaTimeline([conv(1, 0, [{ after_s: 0 }, { after_s: 0 }, { after_s: 0 }]), conv(2, 0, [{ after_s: 0 }, { after_s: 0 }])], {
    now: clock.now,
    play: (c, b) => {
      played.push([c, b]);
      if (c === 1) return Promise.resolve({ ok: true, stopped: true, next: 1 });
      return Promise.reject(api.DemoError("conversation_stopped", 409));
    },
  });
  for (let i = 1; i < 6; i++) { clock.set(i * 1000); tl.tick(); await flush(); }
  assert.deepEqual(played, [[1, 0], [2, 0]]);
  assert.equal(tl.over(), true);
});

test("timeline: module_off pauses everything and retries the same beat; expiry ends it", async () => {
  const clock = fakeNow();
  let off = true;
  const played = [];
  const tl = new tours.WaTimeline([conv(1, 0, [{ after_s: 0 }, { after_s: 0 }]), conv(2, 5, [{ after_s: 0 }])], {
    now: clock.now,
    offMs: 20000,
    play: (c, b) => { played.push([c, b]); return off ? Promise.reject(api.DemoError("module_off", 409)) : Promise.resolve({ ok: true, next: b + 1 }); },
  });
  clock.set(1); tl.tick(); await flush();
  clock.set(10000); assert.deepEqual(tl.tick(), [], "paused while WhatsApp is off");
  off = false;
  clock.set(20001); tl.tick(); await flush();
  assert.deepEqual(played, [[1, 0], [1, 0], [2, 0]], "the same beat again, then the rest");
  const t2 = new tours.WaTimeline([conv(1, 0, [{ after_s: 0 }, { after_s: 0 }])], { now: clock.now, play: () => Promise.reject(api.DemoError("demo_expired", 410)) });
  t2.tick(); await flush();
  clock.add(60000);
  assert.deepEqual(t2.tick(), [], "an expired sandbox ends the timeline");
});

test("timeline: sync adopts the stored progress after a reload and never moves back", async () => {
  const clock = fakeNow();
  const played = [];
  const beats = [{ after_s: 0 }, { after_s: 3 }, { after_s: 3 }, { after_s: 3 }];
  const tl = new tours.WaTimeline([conv(1, 8, beats), conv(2, 35, beats)], { now: clock.now, play: (c, b) => { played.push([c, b]); return Promise.resolve({ ok: true, next: b + 1 }); } });
  clock.set(100000); // a resumed clock: both conversations are long due
  tl.sync({ 1: 2 }, [2]);
  tl.tick(); await flush();
  assert.deepEqual(played, [], "beat 3 of conversation 1 keeps its 3 s; conversation 2 was stopped");
  clock.add(3000); tl.tick(); await flush();
  assert.deepEqual(played, [[1, 3]]);
  tl.sync({ 1: 0 }, []);
  assert.equal(tl.get(1).finished, true, "an older pulse does not move it back");
});

test("active clock: counts only while running, from a stored value, at the test speed", () => {
  let t = 0;
  const c = new tours.ActiveClock({ perf: () => t, from: 5000 });
  assert.equal(c.now(), 5000);
  c.start(); t = 1000;
  assert.equal(c.now(), 6000);
  c.pause(); t = 60000;
  assert.equal(c.now(), 6000, "hidden tab: the clock stands still");
  c.start(); t = 61000;
  assert.equal(c.now(), 7000);
  const fast = new tours.ActiveClock({ perf: () => t, speed: 10 });
  fast.start(); t = 62000;
  assert.equal(fast.now(), 10000);
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

test("ambient: first event at 20 s, then every 45 to 90 s, each once, at most 6", () => {
  const c = clock();
  const played = [];
  const events = Array.from({ length: 10 }, (_, i) => ({ kind: "order", after_s: i }));
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
  assert.deepEqual(played, [0, 1, 2, 3, 4, 5], "capped at 6");
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

test("backend: L2/L3 error codes map to the Spanish lines; play refusals stay internal", () => {
  assert.equal(api.codeFor(410, { error: "demo_expired" }), "demo_expired");
  assert.equal(api.codeFor(410, {}), "demo_expired");
  assert.equal(api.codeFor(403, { error: "bad_key" }), "bad_key");
  assert.equal(api.codeFor(503, { error: "demo_full" }), "demo_full");
  assert.equal(api.codeFor(404, { error: "template_not_found" }), "template_not_found");
  assert.equal(api.codeFor(409, { error: "module_off" }), "module_off");
  assert.equal(api.codeFor(500, { error: "<script>" }), "unknown");
  for (const c of ["demo_key", "bad_key", "demo_expired", "sandbox_expired", "sandbox_not_found"]) {
    const e = api.DemoError(c, 410);
    assert.equal(e.message, "Tu demo se cerró por inactividad.");
    assert.equal(e.expired, true, c);
  }
  assert.equal(api.DemoError("demo_full", 503).message, "Hay muchas demos abiertas. Prueba en un minuto.");
  assert.equal(api.DemoError("demo_disabled", 404).message, "La demo no está disponible en este momento.");
  assert.equal(api.DemoError("rate_limited", 429).message, "Abriste muchas demos seguidas. Prueba en unos minutos.");
  assert.equal(api.DemoError("conversation_stopped", 409).expired, false);
  assert.equal(api.planKey({ plan: { key: "crece", name: "Crece" } }), "crece");
  assert.equal(api.planKey({ plan: "escala" }), "escala");
});

test("mock: the start shape matches L2's demo-start, with a 12-conversation timeline without texts", async () => {
  const sb = await build("foodtruck", "escala", 3);
  for (const k of ["sandbox", "key", "expires_at", "template", "label", "plan", "plans", "org", "venues", "modules", "has_bar", "seats", "links", "wa_timeline", "wa"]) {
    assert.ok(k in sb, "missing " + k);
  }
  assert.equal(sb.key.length, 43);
  assert.equal(sb.venues.length, 3);
  assert.deepEqual(Object.keys(sb.org).sort(), ["id", "name", "slug"]);
  assert.equal(sb.modules.tables, undefined, "a food truck has no tables");
  assert.equal(sb.links.app, null, "links.app may be null: the client falls back to the backend's app");
  assert.equal(sb.wa_timeline.length, 12);
  assert.deepEqual(sb.wa_timeline.map((c) => c.start_s), [8, 35, 60, 85, 110, 140, 170, 200, 230, 260, 290, 320]);
  assert.equal(sb.wa_timeline[0].guest_name, "Carla M.");
  for (const c of sb.wa_timeline) for (const b of c.beats) assert.equal(b.text, undefined, "no texts in the timeline");
  assert.ok(!sb.wa_timeline.some((c) => c.kind === "order_delivery"), "no delivery zones: no delivery chats");
  assert.equal(sb.wa_timeline.filter((c) => c.kind === "handoff").length, 1);
  assert.equal(sb.wa.free_text, undefined, "no free text after D2");
});

test("mock: playing conversation 1 moves its card across the board; replays and gaps are refused or stored", async () => {
  const m = api.mock({ delay: 0 });
  const sb = await m.start({ template: "pizzeria", plan: "crece", venues: 1 });
  const c1 = sb.wa_timeline[0];
  const stageAfter = [];
  const toasts = [];
  await assert.rejects(m.play(sb, { conv: 1, beat: 1 }), (e) => e.code === "beat_out_of_order");
  for (let b = 0; b < c1.beats.length; b++) {
    const r = await m.play(sb, { conv: 1, beat: b });
    toasts.push(...r.did.map((d) => d.actor + ":" + d.action));
    const p = await m.pulse(sb, { conv: 1 });
    stageAfter.push(p.wa.chats.find((c) => c.conv === 1).stage);
  }
  assert.deepEqual([...new Set(stageAfter)], ["nuevo", "conversando", "pedido", "listo", "entregado"]);
  assert.ok(toasts.includes("guest:new_chat") && toasts.includes("assistant:order") && toasts.includes("cashier:approve"));
  const again = await m.play(sb, { conv: 1, beat: 0 });
  assert.equal(again.beat, 0, "a replay answers its stored body");
  const p = await m.pulse(sb, { conv: 1 });
  assert.equal(p.wa.done["1"], c1.beats.length - 1);
  assert.ok(p.wa.messages.some((x) => /está listo/.test(x.text)), "the «listo» notice reached the guest");
  assert.equal(p.state.pending, 0);
});

test("mock: the visitor accepting by hand makes the script's approve a skip; module_off and expiry", async () => {
  const m = api.mock({ delay: 0 });
  const sb = await m.start({ template: "cafe", plan: "arranca", venues: 1 });
  const c1 = sb.wa_timeline[0];
  const approve = c1.beats.findIndex((b) => b.type === "staff" && b.hold_s === 40);
  for (let b = 0; b < approve; b++) await m.play(sb, { conv: 1, beat: b });
  m.act(sb, "accept");
  const r = await m.play(sb, { conv: 1, beat: approve });
  assert.deepEqual(r.did, [], "already approved by the visitor");
  m.act(sb, "wa_off");
  await assert.rejects(m.play(sb, { conv: 1, beat: approve + 1 }), (e) => e.code === "module_off");
  m.act(sb, "wa_on");
  assert.equal((await m.play(sb, { conv: 1, beat: approve + 1 })).ok, true);
  await assert.rejects(m.pulse({ sandbox: sb.sandbox, key: "x" }), (e) => e.code === "demo_key" && e.expired);
  m.act(sb, "expire");
  await assert.rejects(m.pulse(sb, {}), (e) => e.code === "demo_expired" && e.status === 410);
  await assert.rejects(m.start({ template: "nope", plan: "crece" }), (e) => e.code === "template_not_found");
});

test("mock: on Arranca the reservation chats play their no_module beats", async () => {
  const m = api.mock({ delay: 0 });
  const sb = await m.start({ template: "restaurante", plan: "arranca", venues: 1 });
  const res = sb.wa_timeline.filter((c) => c.kind === "reservation");
  assert.equal(res.length, 2);
  const c = res[0];
  const did = [];
  for (let b = 0; b < c.beats.length; b++) did.push(...(await m.play(sb, { conv: c.conv, beat: b })).did.map((d) => d.action));
  assert.ok(!did.includes("reservation"), "no reservation made by this channel");
  assert.ok(did.includes("close_chat"));
});

// ------------------------------------------------------------------------------------------------ the phone --

test("phone: links in the venue's messages are clickable, text is escaped", () => {
  assert.equal(phone.linkify("Paga aquí: https://demo.mezzita.com/pedido/12?t=a."), 'Paga aquí: <a href="https://demo.mezzita.com/pedido/12?t=a" data-link target="_blank" rel="noopener">https://demo.mezzita.com/pedido/12?t=a</a>.');
  assert.equal(phone.linkify("<b>hola</b>\nchau"), "&lt;b&gt;hola&lt;/b&gt;<br>chau");
  assert.equal(phone.linkify("javascript:alert(1)"), "javascript:alert(1)", "only http(s) becomes a link");
});

test("phone: the dot marks chats with news other than the one on screen", () => {
  const chats = [{ conv: 1, last_at: "2026-11-25T10:00:05Z" }, { conv: 2, last_at: "2026-11-25T10:00:09Z" }, { conv: 3, last_at: null }];
  assert.deepEqual(phone.unread(chats, { 2: "2026-11-25T10:00:01Z" }, 1), { 1: false, 2: true, 3: false });
  assert.deepEqual(phone.unread(chats, { 2: "2026-11-25T10:00:09Z" }, 1), { 1: false, 2: false, 3: false });
});
