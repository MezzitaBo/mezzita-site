// Genera iconos, imagen OG, portadas de LinkedIn y PDFs de Mezzita.
// Uso: cd tools && node gen/gen.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
// Precios en un solo archivo, el mismo que usa build.py para el sitio.
const PRECIOS = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "_data", "precios.json"), "utf8"));
const A = (f) => path.join(ROOT, "assets", f);
const FAV = fs.readFileSync(A("favicon.svg"), "utf8");
const LOGO = fs.readFileSync(A("logo.svg"), "utf8");
const MARK = fs.readFileSync(A("logo-mark.svg"), "utf8");
const CSS = fs.readFileSync(path.join(__dirname, "brand.css"), "utf8");
const page = (body, extra = "") => `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}${extra}</style></head><body>${body}</body></html>`;
// size: altura de la x del texto anterior; el logo completo mide ~1.9 veces eso de alto
const brand = (size) => `<div class="brand" style="height:${Math.round(size * 1.9)}px">${LOGO.replace("<svg ", '<svg style="height:100%;width:auto" ')}</div>`;

const QR = (() => {
  // patrón fijo tipo QR con los tres marcadores de esquina
  const n = 21, on = new Set();
  const finder = (x, y) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (i == 0 || j == 0 || i == 6 || j == 6 || (i > 1 && i < 5 && j > 1 && j < 5)) on.add(`${x + i},${y + j}`); };
  finder(0, 0); finder(14, 0); finder(0, 14);
  let s = 7;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    if (s % 100 < 46) on.add(`${x},${y}`);
  }
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">${[...on].map((k) => { const [x, y] = k.split(","); return `<rect x="${x}" y="${y}" width="1" height="1"/>`; }).join("")}</svg>`;
})();

const OG = page(`
<div class="grid-bg" style="width:1200px;height:630px;padding:64px 72px;display:grid;grid-template-columns:1fr 330px;gap:56px;align-items:center;position:relative">
  <div>
    ${brand(44)}
    <h1 class="d" style="font-size:76px;margin-top:44px">Tu carta en un <span class="hl">QR.</span><br>Tu cliente pide y paga solo.</h1>
    <p style="font-size:25px;line-height:1.35;color:var(--ink-2);margin-top:26px;max-width:640px">Menú web propio para pizzerías, heladerías, restaurantes, bares y franquicias de Bolivia. Pide en la mesa, delivery o recojo, y paga en el navegador.</p>
  </div>
  <div style="position:relative">
    <div style="position:absolute;inset:18px -18px -18px 18px;background:var(--red);border-radius:28px"></div>
    <div style="position:relative;background:#fff;border:3px solid var(--ink);border-radius:28px;padding:30px;display:grid;gap:22px;justify-items:center">
      <div style="width:230px;height:230px">${QR}</div>
      <div class="pill" style="background:var(--sun);color:var(--ink);font-weight:700;font-size:26px;border:3px solid var(--ink)">Mesa 12</div>
    </div>
  </div>
  <div style="position:absolute;left:72px;right:72px;bottom:44px;display:flex;justify-content:space-between;font-size:21px;font-weight:600">
    <span>mezzita.com</span><span style="color:var(--ink-2)">Desde 400 Bs al mes · 0 % de comisión · 7 días hábiles</span>
  </div>
</div>`);

const chips = (size) => [["#0F7A4B", "Pedido en mesa, delivery y recojo"], ["#DA291C", "0 % de comisión"], ["#FFC72C", "Panel de pedidos y caja"]]
  .map(([c, t], i) => `<div style="display:flex;align-items:center;gap:.55em;background:#fff;border:2px solid var(--ink);box-shadow:5px 5px 0 var(--ink);border-radius:14px;padding:.55em 1em;font-weight:600;font-size:${size}px;margin-right:${[0, 60, 20][i]}px"><i style="width:.75em;height:.75em;border-radius:50%;background:${c};border:2px solid var(--ink)"></i>${t}</div>`).join("");

const LI_PERFIL = page(`
<div class="grid-bg" style="width:1584px;height:396px;padding:34px 48px 30px 360px;display:grid;grid-template-columns:1fr auto;gap:40px;position:relative">
  <div style="display:flex;flex-direction:column;justify-content:space-between">
    ${brand(36)}
    <h1 class="d" style="font-size:78px">Tu restaurante vende <span class="hl">solo.</span></h1>
    <p style="font-size:24px;color:var(--ink-2);max-width:640px;line-height:1.3">El cliente pide y paga desde su celular, en tu propio menú web. Sin app de delivery que se quede con entre el 20 y el 30 % según la región.</p>
    <p class="mono" style="font-size:14px;letter-spacing:.14em;color:var(--ink-3);text-transform:uppercase">mezzita.com · del equipo detrás de Levisoft</p>
  </div>
  <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:18px">${chips(22)}</div>
</div>`);

const LI_EMPRESA = page(`
<div class="grid-bg" style="width:1128px;height:191px;padding:0 40px 0 200px;display:flex;align-items:center;justify-content:space-between;gap:24px">
  <div style="display:grid;gap:12px">
    <h1 class="d" style="font-size:46px">Tu carta en un <span class="hl">QR.</span> Tu cliente pide y paga solo.</h1>
    <p class="mono" style="font-size:12px;letter-spacing:.14em;color:var(--ink-3);text-transform:uppercase">mezzita.com · pedidos con QR para negocios de comida en Bolivia</p>
  </div>
  ${brand(30)}
</div>`);

const DOC_CSS = `@page{size:A4;margin:16mm 18mm}body{background:#fff;font-size:10.5pt;line-height:1.55;color:var(--ink-2)}
.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:18px}.hd .brand{font-size:19px;color:var(--ink)}.hd small{color:var(--ink-3);font-size:9.5pt}
h1{font-family:"Bricolage Grotesque";font-weight:800;letter-spacing:-.03em;color:var(--ink);line-height:1.1}
h2{color:var(--red);font-size:11pt;letter-spacing:.06em;text-transform:uppercase;margin:16px 0 6px;font-weight:700}
b,strong{color:var(--ink)}ul{padding-left:18px}li{margin:3px 0}
table td,table th{padding:7px 9px;vertical-align:top}
.eyebrow{font-family:"Geist Mono";color:var(--red);font-size:9pt;letter-spacing:.14em;font-weight:700;text-transform:uppercase}
.ft{border-top:1px solid var(--line);margin-top:18px;padding-top:10px;font-size:9pt;color:var(--ink-3);display:flex;justify-content:space-between;gap:16px}`;

const item = (n, t, d, m, tag = "OBLIGATORIO") => `<div style="display:grid;grid-template-columns:26px 1fr auto;gap:14px;padding:12px 0;border-bottom:1px solid var(--line);break-inside:avoid">
<i style="width:20px;height:20px;border:2px solid var(--ink);border-radius:5px;margin-top:2px"></i>
<div><b style="font-size:11.5pt">${n}. ${t}</b><p>${d}</p><p style="font-size:9pt;color:var(--ink-3)">${m}</p></div>
<span class="mono" style="align-self:start;background:${tag == "SI APLICA" ? "var(--sun)" : "var(--ink)"};color:${tag == "SI APLICA" ? "var(--ink)" : "#fff"};border-radius:999px;padding:2px 9px;font-size:8pt;font-weight:700;letter-spacing:.06em">${tag}</span></div>`;

const CHECKLIST = page(`
<div class="hd">${brand(19)}<small>Pedidos con QR · Checklist de inicio · v4 · octubre 2026</small></div>
<p class="eyebrow">Qué necesitas entregar</p>
<h1 style="font-size:26pt;margin:6px 0 8px">Cuatro cosas. Quince minutos. Todo por WhatsApp.</h1>
<p style="font-size:11pt">Nos mandas esto al +591 62506518 junto con el pago de la instalación y desde ese momento corren los 7 días hábiles de la garantía «7 Días o No Pagas el Mes». No vamos a tu local: no hace falta.</p>
<div style="margin-top:12px">
${item(1, "Datos del local", "Nombre comercial, dirección, horarios y un correo para la cuenta del panel. Si haces delivery, tus zonas y el costo de envío de cada una. En Crece y Escala, cuántas mesas tienes.", "Un mensaje de texto alcanza · 3 min")}
${item(2, "Tu carta con precios", "Foto de la carta, planilla o audio, con variantes («mediana, familiar»). Si tienes fotos de tus platos, mándalas también. Nosotros la ordenamos.", "Después la cambias tú desde el panel cuando quieras · 5 min")}
${item(3, "Carnet o NIT del titular", "Una foto del carnet de identidad o del NIT de quien recibirá los cobros.", "Una foto · 2 min")}
${item(4, "El QR de cobro de tu banco", "Una captura del QR de la cuenta donde quieres recibir lo que vendes. Tu cliente paga ahí y la plata va directo a tu cuenta.", "Una captura · 2 min")}
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;break-inside:avoid">
<div style="border:2px dashed var(--ink);border-radius:12px;padding:14px 16px"><p class="eyebrow" style="font-family:'Instrument Sans'">Lo que no necesitas</p><ul style="margin-top:6px">
<li>Impresoras térmicas ni cables: el panel usa el celular, la tablet o la computadora que ya tienes.</li><li>Darnos acceso a tu cuenta de Google: no entramos a tu ficha ni la configuramos.</li><li>Textos: los escribimos con lo que nos cuentes por audio.</li><li>Saber de dominios o de hosting.</li><li>Computadora: todo funciona desde tu celular.</li></ul></div>
<div style="border:2px dashed var(--ink);border-radius:12px;padding:14px 16px"><p class="eyebrow" style="font-family:'Instrument Sans'">Qué pasa después</p><ul style="margin-top:6px">
<li><b>Día 1:</b> cargamos tu carta y tus zonas, y ponemos el QR de tu banco en tu menú.</li><li><b>Días 1 a 5:</b> armamos tu menú web y tu Panel de pedidos y caja. Apruebas.</li><li><b>Día 7 hábil como máximo:</b> todo activo (apuntamos a 72 horas hábiles). Te mandamos el PDF con tus QR.</li><li><b>Tu ficha de Google:</b> te damos el QR de reseñas y el enlace de tu menú, con un video corto para que los pongas tú.</li></ul></div>
</div>
<div style="background:var(--red);color:#fff;border-radius:12px;padding:14px 18px;margin-top:16px;break-inside:avoid">
<p style="font-weight:700;font-size:13pt;line-height:1.35">Instalación ${PRECIOS.install} Bs · Arranca 400 Bs, Crece 600 Bs, Escala 900 Bs al mes · 0 % de comisión</p>
<p style="font-size:9.5pt;margin-top:4px">0 % de comisión, en la mesa, para llevar y a domicilio: lo que vendes va directo a tu cuenta. Precios con IVA incluido. En línea en 7 días hábiles o tu primer mes es gratis.</p></div>
<div class="ft"><span>mezzita.com · WhatsApp +591 62506518 · hola@mezzita.com</span><span>Mezzita · del equipo detrás de Levisoft · Bolivia</span></div>`, DOC_CSS);

const blank = (w) => `<span style="display:inline-block;width:${w}px;border-bottom:1.5px solid var(--ink)"></span>`;
const box = `<i style="display:inline-block;width:11px;height:11px;border:1.5px solid var(--ink);border-radius:2px;vertical-align:-1px;margin-right:5px"></i>`;
const CONTRATO = page(`
<div class="hd">${brand(19)}<small>Contrato modelo · Pedidos con QR · v4 · octubre 2026</small></div>
<h1 style="font-size:21pt;margin-bottom:12px">Contrato de servicio «Pedidos con QR por Mezzita»</h1>
<p style="background:#FFF6D6;border-left:4px solid var(--sun);padding:10px 14px;font-size:9.5pt">Este es el modelo que firmamos con cada local. Los datos entre líneas se completan con los tuyos. Si algo no está escrito aquí o en la página de planes del día de tu contratación, no está incluido. Léelo con calma: lo escribimos para que se entienda sin abogado.</p>
<h2>1. Partes</h2>
<p><b>El proveedor:</b> Mezzita, razón social ${blank(170)}, NIT ${blank(110)}, WhatsApp +591 62506518, hola@mezzita.com, mezzita.com.</p>
<p style="margin-top:8px"><b>El cliente:</b> ${blank(170)}, con NIT o CI ${blank(150)}, titular del local ${blank(150)}, en la ciudad de ${blank(150)}.</p>
<p style="margin-top:8px"><b>Plan:</b> ${box}Arranca ${box}Crece ${box}Escala &nbsp;&nbsp; <b>Modalidad:</b> ${box}Mes a mes ${box}Contrato de 12 meses</p>
<h2>2. Objeto</h2>
<p>Mezzita entrega y mantiene para el local un sistema de pedidos compuesto por:</p>
<ul><li>Menú web propio con fotos, variantes y notas, donde el cliente final arma su pedido.</li>
<li>Pedidos en el local por número o nombre; en Crece y Escala, además, un QR por mesa en PDF y control de mesas en el panel.</li>
<li>Delivery con zonas y costos de envío que carga el local, y recojo, cobrados con el QR del banco del propio local o en efectivo, con confirmación de la caja en el panel. Los repartidores son del local y el cliente final les paga el envío.</li>
<li>Panel de pedidos y caja en celular, tablet o computadora del cliente, con usuarios para cocina y caja, exportación a CSV y API propia.</li>
<li>Avisos de estado por WhatsApp para delivery y recojo, fidelización con sellos digitales y base de clientes exportable con permiso pedido al ordenar.</li>
<li>Reseñas: QR imprimible para el mostrador que lleva a las reseñas de Google del local, y mensaje por WhatsApp con el enlace después de la comida a todos los clientes finales que dieron permiso, sin premios ni filtros.</li>
<li>Cambios de carta ilimitados desde el panel, más los cambios hechos por Mezzita que indica el plan (sección 3), cada uno en 1 día hábil.</li>
<li>Reporte mensual de una página y soporte por WhatsApp con una persona.</li>
<li><b>Crece</b> suma que la mesa pague su cuenta desde el celular, con confirmación de la caja, y reservas desde un enlace en el menú web. <b>Escala</b> suma hasta 3 sucursales con menú central y caja consolidada, reporte avanzado, factura electrónica del SIN mediante un proveedor certificado que se cobra aparte al costo, y gerente de cuenta con revisión mensual de 30 minutos y soporte prioritario.</li></ul>
<p><b>No incluido:</b> gestión de la ficha de Google Maps del cliente (Mezzita no entra a su cuenta de Google ni la configura; entrega el QR de reseñas y el enlace del menú con un video de cómo ponerlos), impresora térmica, repartidores, impresión de QR y acrílicos, factura electrónica en Arranca y Crece (se cotiza aparte), conectores a POS o contabilidad (se cotizan aparte), fotos de estudio con IA (opcional, 585 Bs por 15 platos), anuncios y redes sociales.</p>
<h2>3. Precio</h2>
<table style="width:100%;border-collapse:collapse;font-size:9.5pt" border="1" cellpadding="8">
<tr style="background:var(--paper)"><th align="left">Concepto</th><th align="left">Arranca</th><th align="left">Crece</th><th align="left">Escala</th></tr>
<tr><td>Instalación (pago único, al firmar)</td><td colspan="3">${PRECIOS.install} Bs.</td></tr>
<tr><td>Mensualidad (por adelantado)</td><td>400 Bs</td><td>600 Bs</td><td>900 Bs</td></tr>
<tr><td>Comisión por pedido (mesa, mostrador, para llevar y a domicilio)</td><td>0 %</td><td>0 %</td><td>0 %</td></tr>
<tr><td>Saldo inicial de promociones por WhatsApp (vence a los ${PRECIOS.promo_days} días)</td><td>${PRECIOS.promo_arranca} Bs</td><td>${PRECIOS.promo_crece} Bs</td><td>${PRECIOS.promo_crece} Bs</td></tr>
<tr><td>Cambios de carta hechos por Mezzita, al mes</td><td>2</td><td>4</td><td>Ilimitados</td></tr></table>
<ul style="margin-top:6px"><li>Los precios son en bolivianos e incluyen IVA.</li>
<li>Mezzita no cobra comisión por pedido: 0 % en la mesa, en el mostrador, para llevar y a domicilio. El cliente final paga con el QR del banco del local o en efectivo; el dinero va directo a la cuenta del local y su caja confirma cada pago en el panel.</li>
<li>Promociones por WhatsApp: solo a clientes finales que dieron permiso al pedir. Recargas a ${PRECIOS.wa_msg} Bs por mensaje entregado, en paquetes de ${PRECIOS.wa_pack_msgs} (${PRECIOS.wa_pack} Bs). El saldo vencido o no usado no se devuelve.</li>
<li>Sucursales: en Arranca y Crece, cada sucursal adicional paga el 50 % de la instalación y su propia mensualidad. En Escala, cada sucursal extra sobre las 3 incluidas paga el 50 % de la instalación.</li></ul>
<h2>4. Contrato de 12 meses e «Instalación de vuelta»</h2>
<ul><li>Si el cliente elige la modalidad de 12 meses, el servicio incluye un dominio .com propio, registrado a nombre del cliente.</li>
<li>Desde el mes 13, Mezzita aplica un crédito de hasta ${PRECIOS.credit_month} Bs por mes en la mensualidad, hasta que la suma de los créditos cubra la instalación pagada. El último mes, el crédito es solo el saldo que falte.</li>
<li>El crédito es un descuento en la mensualidad; no se paga en efectivo ni se transfiere. Si el cliente cancela el contrato de 12 meses antes de cumplirlo, pierde el crédito. Si cancela después del mes 12, el crédito pendiente no se paga en efectivo.</li>
<li>En la modalidad mes a mes no hay crédito.</li></ul>
<h2>5. Garantía «7 Días o No Pagas el Mes»</h2>
<p>Mezzita se obliga a dejar activos el menú web, los QR y el Panel de pedidos y caja en 7 días hábiles desde la recepción del pago de instalación y de los datos del checklist (sección 6). Si no cumple, el primer mes es gratis: descuenta el 100 % de la primera mensualidad en el siguiente cobro, sin reclamo previo. Mezzita apunta a 72 horas hábiles. La garantía no cubre demoras por datos incompletos o aprobaciones pendientes del cliente (el plazo se pausa), los trámites del banco del cliente para su QR de cobro cuando dependen del titular, ni fuerza mayor.</p>
<h2>6. Obligaciones del cliente</h2>
<ul><li>Entregar los datos del checklist: datos del local (nombre, dirección, horarios, correo para el panel, zonas y costos de envío si hace delivery, cantidad de mesas en Crece y Escala), carta con precios, carnet o NIT del titular y comprobante de la cuenta bancaria.</li>
<li>Aprobar el menú web en un plazo razonable (máximo 2 días hábiles por revisión).</li>
<li>Pedir reseñas a todos sus clientes por igual, sin premios a cambio y sin filtrar a quién se le pide. No condicionar los sellos de fidelización a dejar una reseña.</li>
<li>Enviar promociones solo a clientes finales que dieron permiso.</li>
<li>Pagar la mensualidad por adelantado y ofrecer en su carta solo productos cuya venta esté permitida.</li></ul>
<h2>7. Duración y cancelación</h2>
<p>En la modalidad mes a mes no hay permanencia mínima: cualquiera de las partes puede cancelar con 30 días de aviso por escrito (WhatsApp o a hola@mezzita.com). En la modalidad de 12 meses, la cancelación anticipada hace perder el crédito de la sección 4. Al cancelar, Mezzita entrega al cliente su base de clientes en CSV dentro de los 10 días hábiles siguientes. El dominio queda a nombre del cliente si este paga su renovación. No se devuelven mensualidades ya iniciadas, la instalación una vez entregada ni el saldo de promociones, salvo aplicación de la garantía de la sección 5.</p>
<h2>8. Datos y propiedad</h2>
<p>Los datos de los clientes finales (nombre, teléfono, pedidos) son del cliente y se tratan según la política de privacidad publicada en mezzita.com/privacidad/. Mezzita los usa solo para operar el servicio: avisos de estado del pedido y, únicamente a los clientes finales que dieron su permiso al pedir, el mensaje de reseña y las promociones. Los mensajes van por la API oficial de WhatsApp. El software del sistema es de Mezzita y se licencia al cliente mientras el contrato esté vigente. El menú web lleva la mención «Pedidos con QR por Mezzita» en el pie.</p>
<h2>9. Responsabilidad</h2>
<p>Mezzita responde por el funcionamiento del sistema y por los plazos de la sección 5. No responde por la calidad de los productos, por los tiempos de preparación y entrega, por decisiones de Google, Meta, WhatsApp o CUCU sobre sus plataformas, ni por pérdidas de venta que no deriven de una falla del sistema. La responsabilidad total de Mezzita se limita al monto pagado por el cliente en los 3 meses anteriores al reclamo.</p>
<h2>10. Ley y conflictos</h2>
<p>Este contrato se rige por las leyes del Estado Plurinacional de Bolivia. Las partes intentarán resolver cualquier diferencia por conversación directa en un plazo de 15 días; de no lograrlo, se someten a los tribunales de la ciudad del cliente.</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;break-inside:avoid">
<div style="border-top:1.5px solid var(--ink);padding-top:8px;font-size:9.5pt">Por Mezzita<br>Nombre, firma y fecha</div>
<div style="border-top:1.5px solid var(--ink);padding-top:8px;font-size:9.5pt">Por el cliente<br>Nombre, firma y fecha</div></div>
<div class="ft"><span>Modelo publicado en mezzita.com/garantias/ · Las condiciones vigentes son las publicadas en mezzita.com/planes/ en la fecha de contratación.</span></div>`, DOC_CSS);

// ICO con un PNG embebido (formato válido desde Windows Vista y en todos los navegadores)
function ico(png) {
  const h = Buffer.alloc(22);
  h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
  h.writeUInt8(48, 6); h.writeUInt8(48, 7); h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12);
  h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18);
  return Buffer.concat([h, png]);
}

(async () => {
  const b = await chromium.launch();
  const shot = async (html, w, h, out, opts = {}) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: opts.scale || 1 });
    await p.setContent(html, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    const buf = await p.screenshot({ type: opts.type || "png", quality: opts.type == "jpeg" ? 88 : undefined, omitBackground: !!opts.transparent });
    if (out) fs.writeFileSync(out, buf);
    await p.close();
    return buf;
  };
  // PWA y favicon: cuadro crema redondeado (favicon.svg). Apple: cuadro completo, iOS redondea las esquinas.
  const icon = (full) => page(`<div style="width:100vw;height:100vh;display:grid;place-items:center;background:${full ? "#FFFBEF" : "transparent"}">${full
    ? `<div style="width:80%">${MARK.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>`
    : FAV.replace("<svg ", '<svg style="width:100%;height:100%" ')}</div>`, "html,body{background:transparent}");
  await shot(icon(false), 512, 512, A("icon-512.png"), { transparent: true });
  await shot(icon(false), 192, 192, A("icon-192.png"), { transparent: true });
  await shot(icon(true), 180, 180, A("apple-touch-icon.png"));
  fs.writeFileSync(A("favicon.ico"), ico(await shot(icon(false), 48, 48, null, { transparent: true })));
  await shot(OG, 1200, 630, A("og.png"));
  await shot(OG, 1200, 630, A("og.jpg"), { type: "jpeg" });
  await shot(LI_PERFIL, 1584, 396, A("linkedin-portada-perfil-1584x396.png"), { scale: 2 });
  await shot(LI_EMPRESA, 1128, 191, A("linkedin-portada-empresa-1128x191.png"), { scale: 2 });
  for (const [html, f] of [[CHECKLIST, "checklist-mezzita.pdf"], [CONTRATO, "contrato-modelo-mezzita.pdf"]]) {
    const p = await b.newPage();
    await p.setContent(html, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: A("docs/" + f), preferCSSPageSize: true, printBackground: true });
    await p.close();
  }
  await b.close();
  console.log("ok");
})();
