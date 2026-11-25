/* Mezzita · demo vivo · phone.js
   The guest's WhatsApp in the shell (docs/demo-vivo.md §4 «WhatsApp, live»). The visitor plays the guest: each chip
   is the next guest line of a template script; tapping it runs demo-play, which drives the real pipeline, and the
   venue's answers (and later «listo» notices from demo-pulse) land here. */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.MezzitaDemo = root.MezzitaDemo || {}).phone = mod;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var ORDER = ['wa_order', 'wa_reservation', 'wa_handoff'];

  function nextGuest(steps, from) {
    for (var i = from || 0; steps && i < steps.length; i++) if (steps[i] && typeof steps[i].guest === 'string') return i;
    return null;
  }

  /** The chips to show: the running script's next line only, else the first line of every script not done. */
  function chipsFor(scripts, flows, active) {
    var out = [];
    function chip(name) {
      var f = flows[name];
      if (!f || f.next == null || !scripts[name] || !scripts[name][f.next]) return;
      out.push({ script: name, step: f.next, text: scripts[name][f.next].guest });
    }
    if (active && flows[active] && flows[active].next != null) chip(active);
    else ORDER.forEach(chip);
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function hhmm(at) {
    var d = at ? new Date(at) : new Date();
    if (isNaN(d)) d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /**
   * new Phone(el, {venue, scripts, freeText, send(script, step) → Promise<{messages, next}>, text(t) → Promise,
   * onChange(counts)}). The element is filled; call add(messages) with what demo-pulse returns.
   */
  function Phone(el, opts) {
    var self = this;
    this.el = el;
    this.opts = opts || {};
    this.scripts = this.opts.scripts || {};
    this.flows = {};
    ORDER.forEach(function (n) {
      if (self.scripts[n]) self.flows[n] = { next: nextGuest(self.scripts[n], 0) };
    });
    this.active = null;
    this.busy = false;
    this.seen = {};
    this.queue = [];
    this.revealing = false;
    this.out = 0;
    this.in = 0;
    var venue = this.opts.venue || 'El local';
    el.classList.add('mzp');
    el.innerHTML =
      '<div class="mzp-hd"><span class="mzp-av" aria-hidden="true">' + esc(venue.trim().charAt(0).toUpperCase()) + '</span>' +
      '<span class="mzp-who"><b>' + esc(venue) + '</b><small class="mzp-status">en línea</small></span></div>' +
      '<div class="mzp-chat" role="log" aria-live="polite" aria-label="Conversación de WhatsApp con ' + esc(venue) + '">' +
      '<p class="mzp-day">Hoy</p><p class="mzp-sys">Demo: estos mensajes no salen a ningún número.</p></div>' +
      '<div class="mzp-chips" role="group" aria-label="Mensajes para enviar"></div>' +
      '<form class="mzp-in" autocomplete="off"><input type="text" maxlength="300" aria-label="Escribe un mensaje" ' +
      (this.opts.freeText ? 'placeholder="Escribe un mensaje"' : 'placeholder="Toca un mensaje de arriba" disabled') +
      '><button type="submit" aria-label="Enviar"' + (this.opts.freeText ? '' : ' disabled') + '>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" fill="currentColor"/></svg></button></form>';
    this.chat = el.querySelector('.mzp-chat');
    this.chipsEl = el.querySelector('.mzp-chips');
    this.status = el.querySelector('.mzp-status');
    this.form = el.querySelector('.mzp-in');
    this.chipsEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-script]');
      if (b && !b.disabled) self.tap(b.getAttribute('data-script'), Number(b.getAttribute('data-step')));
    });
    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = self.form.querySelector('input');
      var t = input.value.trim();
      if (!t || !self.opts.freeText || self.busy) return;
      input.value = '';
      self.typed(t);
    });
    this.drawChips();
  }

  Phone.prototype.counts = function () { return { phone_out: this.out, phone_in: this.in }; };

  Phone.prototype.changed = function () { if (this.opts.onChange) this.opts.onChange(this.counts()); };

  Phone.prototype.drawChips = function () {
    var list = chipsFor(this.scripts, this.flows, this.active);
    var busy = this.busy;
    this.chipsEl.innerHTML = list.map(function (c) {
      return '<button type="button" data-script="' + c.script + '" data-step="' + c.step + '"' + (busy ? ' disabled' : '') + '>' + esc(c.text) + '</button>';
    }).join('');
    this.chipsEl.hidden = !list.length;
  };

  Phone.prototype.bubble = function (m, local) {
    var out = m.from === 'guest';
    var d = root.document.createElement('div');
    d.className = 'mzp-msg ' + (out ? 'mzp-out' : 'mzp-inb') + (m.from === 'staff' ? ' mzp-staff' : '');
    if (local) d.setAttribute('data-local', '1');
    d.innerHTML = (m.from === 'staff' ? '<small>Equipo del local</small>' : '') + '<p>' + esc(m.text).replace(/\n/g, '<br>') +
      '</p><time>' + hhmm(m.at) + (out ? ' <span aria-hidden="true">✓✓</span>' : '') + '</time>';
    this.chat.appendChild(d);
    this.chat.scrollTop = this.chat.scrollHeight;
    return d;
  };

  Phone.prototype.typing = function (on) {
    var t = this.chat.querySelector('.mzp-typing');
    this.status.textContent = on ? 'escribiendo…' : 'en línea';
    if (on && !t) {
      t = root.document.createElement('div');
      t.className = 'mzp-msg mzp-inb mzp-typing';
      t.setAttribute('aria-label', 'Escribiendo');
      t.innerHTML = '<i></i><i></i><i></i>';
      this.chat.appendChild(t);
      this.chat.scrollTop = this.chat.scrollHeight;
    } else if (!on && t) {
      t.remove();
    }
  };

  /** Adds server messages (from demo-play or demo-pulse), once each, venue replies one by one. */
  Phone.prototype.add = function (messages) {
    var self = this;
    (messages || []).forEach(function (m) {
      if (!m || !m.text) return;
      var id = m.id || m.from + ':' + m.text + ':' + m.at;
      if (self.seen[id]) return;
      self.seen[id] = true;
      if (m.from === 'guest') {
        var local = [].slice.call(self.chat.querySelectorAll('[data-local]')).filter(function (d) {
          return d.querySelector('p').textContent === m.text;
        })[0];
        if (local) { local.removeAttribute('data-local'); return; }
        self.out++;
        self.bubble(m);
        self.changed();
      } else {
        self.queue.push(m);
      }
    });
    this.reveal();
  };

  Phone.prototype.reveal = function () {
    var self = this;
    if (this.revealing || !this.queue.length) return;
    this.revealing = true;
    this.typing(true);
    var wait = this.opts.instant ? 0 : 650 + Math.min(900, this.queue[0].text.length * 8);
    setTimeout(function () {
      var m = self.queue.shift();
      self.typing(false);
      self.in++;
      self.bubble(m);
      self.revealing = false;
      self.changed();
      self.reveal();
    }, wait);
  };

  Phone.prototype.tap = function (script, step) {
    var self = this;
    var steps = this.scripts[script];
    if (!steps || !steps[step] || this.busy || !this.opts.send) return Promise.resolve(false);
    this.busy = true;
    this.active = script;
    var local = this.bubble({ from: 'guest', text: steps[step].guest }, true);
    this.out++;
    this.changed();
    this.drawChips();
    this.typing(true);
    return this.opts.send(script, step).then(function (r) {
      self.busy = false;
      self.typing(false);
      self.flows[script].next = r && r.next != null ? r.next : null;
      if (self.flows[script].next == null) self.active = null;
      self.add(r && r.messages);
      self.drawChips();
      return true;
    }, function (err) {
      self.busy = false;
      self.typing(false);
      if (local.hasAttribute('data-local')) { local.remove(); self.out--; self.changed(); }
      // A first line that failed leaves the script unstarted, so every script's chip shows again.
      if (self.flows[script].next === step && step === nextGuest(steps, 0)) self.active = null;
      self.drawChips();
      self.error(err && err.message);
      if (err && err.expired && self.opts.onExpired) self.opts.onExpired(err);
      return false;
    });
  };

  Phone.prototype.typed = function (t) {
    var self = this;
    if (!this.opts.text) return;
    this.busy = true;
    this.bubble({ from: 'guest', text: t }, true);
    this.out++;
    this.changed();
    this.drawChips();
    this.typing(true);
    this.opts.text(t).then(function (r) {
      self.busy = false;
      self.typing(false);
      self.add(r && r.messages);
      self.drawChips();
    }, function (err) {
      self.busy = false;
      self.typing(false);
      self.drawChips();
      self.error(err && err.message);
    });
  };

  Phone.prototype.error = function (text) {
    var p = root.document.createElement('p');
    p.className = 'mzp-sys mzp-err';
    p.textContent = text || 'No se envió. Prueba de nuevo.';
    this.chat.appendChild(p);
    this.chat.scrollTop = this.chat.scrollHeight;
    setTimeout(function () { p.remove(); }, 6000);
  };

  return { Phone: Phone, chipsFor: chipsFor, nextGuest: nextGuest };
});
