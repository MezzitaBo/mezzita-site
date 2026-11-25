// Screenshots and checks of the demo shell (assets/demo-vivo) at 375, 768, 1280 and 1440 px for four scenarios:
// café on Arranca, restaurante on Crece, food truck on Escala, discoteca on Nightlife.
// Checks per shot: no console errors, no horizontal scroll; at 375 px every menu item is reachable in two taps
// («Demo», then the item); at 1440 px the WhatsApp recorrido walks end to end on the mock.
//
// Use:  python3 build.py && cd tools && node shot-demo.js [base-url] [--backend mock|staging] [--out dir]
// Without a base URL it serves ../dist on http://localhost:8766. If the page has no #demo-vivo yet (the wizard lane
// adds it), the tool injects the shell's tags itself.
const { chromium } = require("playwright");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : def; };
const BACKEND = opt("backend", "mock");
const OUT = path.resolve(opt("out", path.join(os.tmpdir(), "mezzita-demo-shots")));
const ONLY = opt("only", "");
let BASE = args.find((a) => /^https?:/.test(a));

const SCENARIOS = [
  { id: "cafe-arranca", template: "cafe", plan: "arranca", venues: 1 },
  { id: "restaurante-crece", template: "restaurante", plan: "crece", venues: 1 },
  { id: "foodtruck-escala", template: "foodtruck", plan: "escala", venues: 3 },
  { id: "discoteca-nightlife", template: "discoteca", plan: "nightlife", venues: 1 },
].filter((s) => !ONLY || s.id.startsWith(ONLY));
const SIZES = [[375, 812], [768, 1024], [1280, 800], [1440, 900]];
const FILES = ["api.js", "phone.js", "tours.js", "shell.js"];

function serve(root, port) {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json", ".xml": "application/xml", ".webmanifest": "application/manifest+json" };
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end("not found"); }
      rsp.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(port, () => res(srv));
  });
}

async function openShell(page, sc) {
  // On the mock the 12 WhatsApp conversations play 10 times faster, so a run sees the board move.
  await page.goto(`${BASE}/demo/?backend=${BACKEND}${BACKEND === "mock" ? "&demo_speed=10" : ""}`, { waitUntil: "load" });
  await page.addStyleTag({ content: "*{transition:none!important;animation:none!important}" });
  const ready = await page.evaluate(() => Boolean(document.getElementById("demo-vivo") && window.MezzitaDemo && window.MezzitaDemo.open));
  if (!ready) {
    await page.evaluate(() => {
      if (!document.getElementById("demo-vivo")) {
        const d = document.createElement("div");
        d.id = "demo-vivo";
        d.hidden = true;
        document.getElementById("main").appendChild(d);
      }
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "/assets/demo-vivo/shell.css";
      document.head.appendChild(l);
    });
    for (const f of FILES) await page.addScriptTag({ url: `/assets/demo-vivo/${f}` });
  }
  await page.evaluate((p) => window.MezzitaDemo.open(p), { template: sc.template, plan: sc.plan, venues: sc.venues, name: "" });
  await page.waitForSelector('.mzd[data-state="ready"]', { timeout: 20000 });
  await page.waitForTimeout(400);
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  let srv = null;
  if (!BASE) {
    const dist = path.resolve(__dirname, "../dist");
    if (!fs.existsSync(path.join(dist, "demo", "index.html"))) { console.error("dist/ is missing: run python3 build.py first"); process.exit(2); }
    srv = await serve(dist, 8766);
    BASE = "http://localhost:8766";
  }
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const problems = [];
  const files = [];
  const note = (where, what) => problems.push(`${where}: ${what}`);

  for (const sc of SCENARIOS) {
    for (const [w, h] of SIZES) {
      const where = `${sc.id} @${w}`;
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 1100 });
      const page = await ctx.newPage();
      const errs = [];
      const shot = async (name) => { const f = path.join(OUT, `${sc.id}-${w}${name ? "-" + name : ""}.png`); await page.screenshot({ path: f }); files.push(f); };
      page.on("pageerror", (e) => errs.push(e.message));
      // /demo/sitio/ is L7's page (its own PR): until it is merged it answers 404 inside the phone.
      page.on("console", (m) => m.type() === "error" && !/fonts\.g|favicon/.test(m.text()) && !/\/demo\/sitio\//.test((m.location() || {}).url || "") && errs.push(m.text()));
      try {
        await openShell(page, sc);
        // first open: the «¿Cómo quieres verlo?» card
        if (!(await page.isVisible(".mzd-modal"))) note(where, "the welcome card did not show");
        await shot("guia");
        await page.click('.mzd-modal .mzd-mf [data-act="explore"]');
        await page.waitForTimeout(250);
        await shot("");
        const ov = await overflow(page);
        if (ov > 1) note(where, `horizontal scroll ${ov}px`);

        if (w >= 1100) {
          // hover the menu: labels, lines and plan chips
          await page.hover(".mzd-menu .mzd-item >> nth=0");
          await page.waitForTimeout(150);
          await shot("menu");
          await page.mouse.move(w - 10, h - 10);
          // a dimmed item offers the plan that has it
          const locked = await page.$(".mzd-menu .mzd-item.is-locked");
          if (locked) {
            await locked.click();
            const txt = await page.textContent(".mzd-modal");
            if (!/Esto viene en el plan \w+/.test(txt) || !/Ver el demo con/.test(txt)) note(where, "locked item without its plan offer: " + txt);
            await shot("bloqueado");
            await page.click('.mzd-modal .mzd-mf [data-act="modal-close"]');
          }
          // every menu item opens something (or offers its plan)
          for (const k of await page.$$eval(".mzd-menu [data-item]:not(.is-locked)", (bs) => bs.map((x) => x.getAttribute("data-item")))) {
            await page.click(`.mzd-menu [data-item="${k}"]`);
            const cur = await page.getAttribute(`.mzd-menu [data-item="${k}"]`, "aria-current");
            if (cur !== "true") note(where, `menu item ${k} did not open`);
          }
          await page.mouse.move(w - 10, h - 10);
        } else {
          // phone: the «Demo» sheet, then every item in two taps
          await page.click(".mzd-mbtn");
          await shot("hoja");
          const keys = await page.$$eval(".mzd-sheet [data-item]", (bs) => bs.map((x) => x.getAttribute("data-item")));
          await page.click('.mzd-sheet [data-act="sheet-close"]');
          for (const k of keys) {
            await page.click(".mzd-mbtn");
            await page.click(`.mzd-sheet [data-item="${k}"]`);
            const ok = await page.evaluate((key) => {
              const m = document.querySelector(".mzd-modal");
              if (m && !m.hidden) return /Esto viene en el plan/.test(m.textContent) ? "locked" : "modal?";
              const it = document.querySelector(`.mzd-sheet [data-item="${key}"]`);
              return it && it.getAttribute("aria-current") === "true" ? "on" : "no";
            }, k);
            if (ok === "locked") await page.click('.mzd-modal .mzd-mf [data-act="modal-close"]');
            else if (ok !== "on") note(where, `item ${k} not reached in two taps (${ok})`);
          }
          const ov2 = await overflow(page);
          if (ov2 > 1) note(where, `horizontal scroll after the walk ${ov2}px`);
          await page.click(".mzd-seg [data-side=guest]");
          await page.click(".mzd-mbtn");
          await page.click('.mzd-sheet [data-item="whatsapp"]');
          await shot("cliente");
          await page.click(".mzd-seg [data-side=team]");
          await shot("equipo");
        }

        if (w === 1440 && BACKEND === "mock") {
          // D2: the 12 conversations play by themselves; the phone shows conversation 1, the board fills up
          await page.click('.mzd-menu [data-item="whatsapp"]');
          await page.click('.mzd-menu [data-item="owner"]');
          await page.mouse.move(w - 10, h - 10);
          const chat = await page.waitForSelector(".mzp-msg", { timeout: 15000 }).catch(() => null);
          if (!chat) note(where, "no WhatsApp message reached the phone");
          if (await page.isEnabled(".mzp-in input")) note(where, "the phone's input should be read-only");
          await page.waitForTimeout(6000);
          const board = await page.frameLocator('iframe[name="mz-demo:owner"]').locator(".col span").count().catch(() => 0);
          if (!board) note(where, "the owner's WhatsApp board stayed empty");
          await shot("whatsapp");
          // the WhatsApp recorrido end to end, following an order chat; nobody touches anything: the demo
          // accepts it, the kitchen marks it ready, the notice reaches the phone
          await page.click('.mzd-top [data-act="guide"]');
          const wa = await page.$('.mzd-modal [data-tour="whatsapp"]');
          if (wa) {
            await wa.click();
            const waitStep = (n, ms) => page.waitForFunction((x) => document.querySelector(".mzd-rail-k").textContent.includes(`paso ${x} de`), n, { timeout: ms || 45000 });
            await shot("recorrido-1");
            await waitStep(4);
            await shot("recorrido-4");
            await waitStep(7, 60000);
            await shot("recorrido-7");
            await page.click('[data-act="tour-next"]');
            if (await page.isVisible(".mzd-rail")) note(where, "the recorrido did not end");
          } else note(where, "no WhatsApp recorrido");
          // the table recorrido puts kitchen and bar (or kitchen) on screen at step 4: two seats side by side
          await page.click('.mzd-top [data-act="guide"]');
          const mesa = await page.$('.mzd-modal [data-tour="mesa"]');
          if (mesa) {
            await mesa.click();
            for (let i = 0; i < 3; i++) await page.click('[data-act="tour-next"]');
            await page.waitForTimeout(300);
            const duo = await page.evaluate(() => [...document.querySelectorAll(".mzd-seat")].filter((s) => !s.hidden).map((s) => s.dataset.role));
            const bar = await page.$('.mzd-menu [data-item="bar"]');
            if (duo.length !== (bar ? 2 : 1)) note(where, "mesa step 4 shows seats " + duo.join("+"));
            await shot("mesa-4");
            await page.click('[data-act="tour-exit"]');
          } else await page.click('.mzd-modal .mzd-mf [data-act="explore"]');
        }

        if (w === 1280 && sc === SCENARIOS[0] && BACKEND === "mock") {
          // «Cambiar»: the four plans; «Reiniciar»: asks first
          await page.click('.mzd-top [data-act="plans"]');
          if ((await page.$$(".mzd-modal .mzd-plancard")).length !== 4) note(where, "Cambiar does not show four plans");
          await shot("planes");
          await page.click('.mzd-modal [data-act="modal-close"]');
          await page.click('.mzd-top [data-act="restart"]');
          await shot("reiniciar");
          const before = await page.evaluate(() => window.MezzitaDemo.__sandbox.sandbox);
          await page.click('.mzd-modal [data-act="do-restart"]');
          await page.waitForSelector('.mzd[data-state="ready"]');
          const after = await page.evaluate(() => window.MezzitaDemo.__sandbox.sandbox);
          if (before === after) note(where, "Reiniciar did not build a new sandbox");
          await page.click('.mzd-modal .mzd-mf [data-act="explore"]').catch(() => {});
          // expiry: the sandbox closes, the shell offers to open it again
          await page.evaluate(() => window.MezzitaDemo.__mock.act(window.MezzitaDemo.__sandbox, "expire"));
          await page.click('.mzd-menu [data-item="whatsapp"]'); // fast pulse
          await page.waitForFunction(() => /Tu demo se cerró por inactividad/.test(document.querySelector(".mzd-modal").textContent), null, { timeout: 15000 });
          await shot("cerrada");
          await page.click('.mzd-modal [data-act="reopen"]');
          await page.waitForSelector('.mzd[data-state="ready"]');
          // a reload brings the same sandbox back (sessionStorage), not a new one
          const id = await page.evaluate(() => window.MezzitaDemo.__sandbox.sandbox);
          await page.reload({ waitUntil: "load" });
          const hasShell = await page.evaluate(() => Boolean(window.MezzitaDemo && window.MezzitaDemo.saved));
          if (!hasShell) {
            await page.addStyleTag({ url: "/assets/demo-vivo/shell.css" });
            await page.evaluate(() => { if (!document.getElementById("demo-vivo")) { const d = document.createElement("div"); d.id = "demo-vivo"; document.getElementById("main").appendChild(d); } });
            for (const f of FILES) await page.addScriptTag({ url: `/assets/demo-vivo/${f}` });
          }
          const savedParams = await page.evaluate(() => window.MezzitaDemo.saved());
          if (!savedParams || savedParams.template !== sc.template) note(where, "saved() lost the demo after a reload");
          else {
            // the mock lives in memory, so after a reload only the shape of resume is checked: it must not rebuild
            await page.evaluate(() => window.MezzitaDemo.resume());
            await page.waitForSelector('.mzd[data-state="ready"]');
            const again = await page.evaluate(() => window.MezzitaDemo.__sandbox.sandbox);
            if (again !== id) note(where, "resume() built a new sandbox instead of reopening " + id);
          }
        }
        if (errs.length) note(where, "console: " + errs.join(" | "));
      } catch (e) {
        note(where, "failed: " + e.message.split("\n")[0]);
        try { await shot("error"); } catch (_) { /* page gone */ }
      }
      await ctx.close();
    }
  }
  await b.close();
  if (srv) srv.close();
  console.log(`${files.length} screenshots in ${OUT}`);
  console.log(`${SCENARIOS.length} scenarios x ${SIZES.length} widths, ${problems.length} problems`);
  problems.forEach((p) => console.log(" - " + p));
  process.exit(problems.length ? 1 : 0);
})();
