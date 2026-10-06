/* HardwareVS — печеньки и VIP (Supabase). Подключается после auth.js. */
(function () {
    'use strict';
    var A = window.HW_AUTH;
    if (!A || !A.client) { window.HW_COOKIES = null; return; }

    var sb = A.client, wallet, offset = 0, listeners = [];
    // wallet: undefined — ещё не загружен или ошибка, null — не вошли, объект — данные с сервера

    function rpc(name) {
        return sb.rpc(name).then(function (r) { if (r.error) throw r.error; return r.data; });
    }
    function set(w) {
        wallet = w;
        if (w && w.server_now) offset = Date.parse(w.server_now) - Date.now();   // время берём с сервера, а не с часов пользователя
        listeners.slice().forEach(function (f) { try { f(w); } catch (e) { console.error(e); } });
    }
    function nowMs() { return Date.now() + offset; }

    function refresh() {
        return A.getUser().then(function (u) {
            if (!u) { set(null); return null; }
            return rpc('get_wallet').then(function (w) { set(w); return w; });
        }).catch(function (e) { console.error('HW_COOKIES:', e); set(undefined); return undefined; });
    }
    function claim() { return rpc('claim_cookies').then(function (w) { set(w); return w; }); }
    function buyVip() { return rpc('buy_vip').then(function (w) { set(w); return w; }); }
    function onChange(f) { listeners.push(f); }

    function ruError(e) {
        var m = (e && e.message) || '';
        if (m.indexOf('not_enough_cookies') !== -1) return 'Не хватает печенек.';
        if (m.indexOf('already_claimed') !== -1) return 'Сегодняшняя печенька уже получена.';
        if (m.indexOf('not_authenticated') !== -1) return 'Войдите в аккаунт.';
        if (/failed to fetch|network/i.test(m)) return 'Нет соединения с сервером.';
        return 'Ошибка: ' + (m || 'неизвестная');
    }

    // Вход/выход на другой вкладке или после возврата на страницу
    sb.auth.onAuthStateChange(function (ev, session) {
        if (ev === 'SIGNED_OUT') set(null);
        else if (ev === 'SIGNED_IN') setTimeout(refresh, 0);
    });

    /* ---------- Счётчик печенек (слева снизу) ---------- */
    function mountCounter() {
        if (document.getElementById('hwc')) return;
        var st = document.createElement('style');
        st.textContent =
            '.hwc{position:fixed;left:20px;bottom:20px;z-index:50;display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:calc(100% - 40px);padding:8px 14px;' +
            'background:var(--panel-bg,rgba(19,13,51,.92));border:1px solid var(--panel-border,#442a7a);border-radius:22px;color:var(--panel-text,#e9d5ff);font-size:13px;' +
            'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:opacity .3s ease}' +
            '.hwc[hidden]{display:none}html.leaving .hwc{opacity:0;pointer-events:none}' +
            '.hwc-num{font-weight:700;font-size:15px}.hwc-timer{color:var(--panel-muted,#9aa0a6)}' +
            '.hwc-link{color:var(--panel-text,#e9d5ff);font-weight:600}.hwc-link:hover{color:#a855f7}' +
            '.hwc-btn{border:0;border-radius:14px;padding:6px 12px;cursor:pointer;font:inherit;font-weight:700;color:#fff;background:linear-gradient(135deg,#f59e0b,#b45309)}' +
            '.hwc-btn:disabled{opacity:.5;cursor:not-allowed}.hwc-btn:focus-visible{outline:2px solid #a855f7;outline-offset:2px}' +
            '.hwc-msg.ok{color:#4ade80}.hwc-msg.bad{color:#f87171}' +
            '@media(max-width:480px){.hwc{left:16px;bottom:16px}}';
        document.head.appendChild(st);

        var box = document.createElement('div');
        box.id = 'hwc'; box.className = 'hwc'; box.hidden = true;
        document.body.appendChild(box);

        var tick = null, timerEl = null, msgEl = null, msgTimer = null;
        function mk(tag, cls, text) { var n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; box.appendChild(n); return n; }
        function pad(n) { return n < 10 ? '0' + n : '' + n; }
        function stop() { if (tick) { clearInterval(tick); tick = null; } }
        function flash(text, bad) {
            if (!msgEl) return;
            msgEl.textContent = text; msgEl.className = 'hwc-msg ' + (bad ? 'bad' : 'ok');
            clearTimeout(msgTimer); msgTimer = setTimeout(function () { if (msgEl) msgEl.textContent = ''; }, 3500);
        }
        function update(w) {
            var s = Math.floor((Date.parse(w.next_claim_at) - nowMs()) / 1000);
            if (s <= 0) { stop(); refresh(); return; }
            timerEl.textContent = 'Следующая через ' + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
        }

        onChange(function (w) {
            stop(); box.textContent = ''; box.hidden = false; timerEl = msgEl = null;
            if (w === undefined) { mk('span', 'hwc-num', '🍪 —').title = 'Не удалось загрузить печеньки'; return; }
            if (w === null) {
                mk('span', 'hwc-num', '🍪');
                var a = mk('a', 'hwc-link', 'Войдите, чтобы получать печеньки');
                a.href = 'login.html?next=' + (location.pathname.split('/').pop() || 'index.html');
                return;
            }
            mk('span', 'hwc-num', '🍪 ' + w.cookies);
            if (w.can_claim) {
                var b = mk('button', 'hwc-btn', 'Забрать +' + w.claim_amount);
                b.type = 'button';
                b.addEventListener('click', function () {
                    b.disabled = true;
                    claim().then(function (r) { flash('+' + r.claimed + ' 🍪', false); })
                        .catch(function (e) { b.disabled = false; flash(ruError(e), true); if (/already_claimed/.test(e && e.message)) refresh(); });
                });
            } else {
                timerEl = mk('span', 'hwc-timer');
                update(w); tick = setInterval(function () { update(w); }, 1000);
            }
            msgEl = mk('span', 'hwc-msg');
        });
    }

    window.HW_COOKIES = { refresh: refresh, claim: claim, buyVip: buyVip, onChange: onChange, get: function () { return wallet; }, ruError: ruError, mountCounter: mountCounter };
})();
