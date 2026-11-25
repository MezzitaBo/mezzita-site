/* Mezzita · demo vivo · phone.js
   The guest's WhatsApp in the shell, read-only (owner decision D2, demo-whatsapp-addendum.md §6): it shows one of the
   12 scripted conversations from the guest's side, conversation 1 by default, and a selector «Viendo el chat de»
   lists the guests that have written, with a dot on chats with new messages. Links in the venue's messages open in
   the phone. No chips, no typing: «En la demo, tus clientes escriben solos.» */
(function (root, factory) {
  var mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.MezzitaDemo = root.MezzitaDemo || {}).phone = mod;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hhmm(at) {
    var d = at ? new Date(at) : new Date();
    if (isNaN(d)) d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /** Escaped text with http(s) links made clickable (trailing punctuation stays outside the link). */
  function linkify(text) {
    var out = '', last = 0, re = /https?:\/\/[^\s<>"']+/g, m;
    var s = String(text == null ? '' : text);
    while ((m = re.exec(s))) {
      var url = m[0].replace(/[.,;:!?)»]+$/, '');
      out += esc(s.slice(last, m.index)) + '<a href="' + esc(url) + '" data-link target="_blank" rel="noopener">' + esc(url) + '</a>';
      last = m.index + url.length;
      re.lastIndex = last;
    }
    return (out + esc(s.slice(last))).replace(/\n/g, '<br>');
  }

  /** Chats with news: the last message is newer than what the visitor saw, and it is not the chat on screen. */
  function unread(chats, seen, current) {
    var out = {};
    (chats || []).forEach(function (c) {
      out[c.conv] = c.conv !== current && Boolean(c.last_at) && (!seen[c.conv] || c.last_at > seen[c.conv]);
    });
    return out;
  }

  /** new Phone(el, {venue, onPick(conv), onLink(url, event)}) */
  function Phone(el, opts) {
    var self = this;
    this.el = el;
    this.opts = opts || {};
    this.current = 1;
    this.seen = {};
    this.ids = {};
    this.chats = [];
    var venue = this.opts.venue || 'El local';
    el.classList.add('mzp');
    el.innerHTML =
      '<div class="mzp-hd"><span class="mzp-av" aria-hidden="true">' + esc(venue.trim().charAt(0).toUpperCase()) + '</span>' +
      '<span class="mzp-who"><b>' + esc(venue) + '</b><small>en línea</small></span></div>' +
      '<label class="mzp-pick" hidden><span>Viendo el chat de:</span><select></select><i class="mzp-new" hidden title="Hay chats con mensajes nuevos"></i></label>' +
      '<div class="mzp-chat" role="log" aria-live="polite" aria-label="Conversación de WhatsApp con ' + esc(venue) + '"></div>' +
      '<div class="mzp-in"><input type="text" disabled aria-label="En la demo, tus clientes escriben solos." placeholder="En la demo, tus clientes escriben solos."></div>';
    this.chat = el.querySelector('.mzp-chat');
    this.pick = el.querySelector('.mzp-pick');
    this.select = el.querySelector('select');
    this.dot = el.querySelector('.mzp-new');
    this.select.addEventListener('change', function () {
      var c = Number(self.select.value);
      if (c && self.opts.onPick) self.opts.onPick(c);
    });
    this.chat.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-link]');
      if (a && self.opts.onLink) self.opts.onLink(a.getAttribute('href'), e);
    });
    this.show(1, []);
  }

  Phone.prototype.intro = function () {
    return '<p class="mzp-day">Hoy</p><p class="mzp-sys">Chats de ejemplo, en vivo: tus clientes escriben solos. Nada sale a ningún número.</p>';
  };

  /** The chats that have written so far ([{conv, guest_name, stage, last_at}]). */
  Phone.prototype.setChats = function (chats) {
    this.chats = (chats || []).slice().sort(function (a, b) { return a.conv - b.conv; });
    var news = unread(this.chats, this.seen, this.current);
    var cur = this.current;
    var html = this.chats.map(function (c) {
      return '<option value="' + c.conv + '"' + (c.conv === cur ? ' selected' : '') + '>' + (news[c.conv] ? '● ' : '') + esc(c.guest_name) + '</option>';
    }).join('');
    if (!this.chats.some(function (c) { return c.conv === cur; })) {
      var name = (this.opts.names || {})[cur];
      html = '<option value="' + cur + '" selected>' + (name ? esc(name) + ' · todavía no escribe' : 'Elige un chat') + '</option>' + html;
    }
    if (this.select.innerHTML !== html) this.select.innerHTML = html;
    this.pick.hidden = !this.chats.length;
    this.dot.hidden = !Object.keys(news).some(function (k) { return news[k]; });
    this.markSeen();
  };

  Phone.prototype.markSeen = function () {
    var cur = this.current;
    var c = this.chats.filter(function (x) { return x.conv === cur; })[0];
    if (c && c.last_at) this.seen[cur] = c.last_at;
  };

  /** Shows conversation `conv` with the messages known so far. */
  Phone.prototype.show = function (conv, messages) {
    this.current = conv;
    this.ids = {};
    this.chat.innerHTML = this.intro();
    var wait = root.document.createElement('p');
    wait.className = 'mzp-sys mzp-wait';
    wait.textContent = 'Tus clientes empiezan a escribir en unos segundos.';
    this.chat.appendChild(wait);
    this.add(messages);
    this.markSeen();
    if (this.chats.length) this.setChats(this.chats);
  };

  /** Adds messages of the conversation on screen, once each, in order. */
  Phone.prototype.add = function (messages) {
    var self = this;
    var added = 0;
    (messages || []).forEach(function (m) {
      if (!m || !m.text) return;
      var id = m.id || m.from + ':' + m.text + ':' + m.at;
      if (self.ids[id]) return;
      self.ids[id] = true;
      var out = m.from === 'guest';
      var d = root.document.createElement('div');
      d.className = 'mzp-msg ' + (out ? 'mzp-out' : 'mzp-inb') + (m.from === 'staff' ? ' mzp-staff' : '');
      d.innerHTML = (m.from === 'staff' ? '<small>Equipo del local</small>' : '') + '<p>' + linkify(m.text) + '</p><time>' +
        hhmm(m.at) + (out ? ' <span aria-hidden="true">✓✓</span>' : '') + '</time>';
      self.chat.appendChild(d);
      added++;
    });
    if (added) {
      var w = this.chat.querySelector('.mzp-wait');
      if (w) w.remove();
      this.chat.scrollTop = this.chat.scrollHeight;
    }
    return added;
  };

  return { Phone: Phone, linkify: linkify, unread: unread };
});
