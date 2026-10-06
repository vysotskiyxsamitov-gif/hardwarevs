/* HardwareVS — общий модуль входа (Supabase). Подключается после supabase-js. */
(function () {
    'use strict';
    var SUPABASE_URL = 'https://qvytoxgqpygzonrwqyak.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_xdJOoVGNUkeA8M3VN_JNTQ_R3kLTxXj'; // публичный ключ, его можно держать в коде

    if (!window.supabase || !window.supabase.createClient) { window.HW_AUTH = null; return; }

    var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    // Папка сайта: .../hardwarevs/
    var BASE = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '');
    var NEXT_OK = ['index.html', 'builder.html', 'cpu.html', 'gpu.html', 'guide.html'];

    // Куда вернуться после входа (только свои страницы, чтобы нельзя было увести пользователя на чужой сайт)
    function safeNext() {
        var n = new URLSearchParams(location.search).get('next');
        return NEXT_OK.indexOf(n) !== -1 ? n : 'index.html';
    }

    function ruError(e) {
        var m = ((e && e.message) || '').toLowerCase(), c = (e && e.code) || '';
        if (m.indexOf('invalid login') !== -1) return 'Неверная почта или пароль.';
        if (m.indexOf('email not confirmed') !== -1) return 'Почта не подтверждена. Откройте письмо со ссылкой.';
        if (m.indexOf('already registered') !== -1) return 'Эта почта уже зарегистрирована.';
        if (m.indexOf('same password') !== -1) return 'Новый пароль должен отличаться от старого.';
        if (m.indexOf('password should be') !== -1 || m.indexOf('weak') !== -1) return 'Пароль слишком короткий или простой.';
        if (m.indexOf('rate limit') !== -1 || c === 'over_email_send_rate_limit' || (e && e.status === 429)) return 'Слишком много попыток. Подождите немного и повторите.';
        if (m.indexOf('valid email') !== -1 || m.indexOf('invalid format') !== -1) return 'Проверьте адрес почты.';
        if (m.indexOf('failed to fetch') !== -1 || m.indexOf('network') !== -1) return 'Нет соединения с сервером. Проверьте интернет.';
        return 'Ошибка: ' + ((e && e.message) || 'неизвестная');
    }

    function getUser() {
        return client.auth.getSession().then(function (r) {
            return r && r.data && r.data.session ? r.data.session.user : null;
        }).catch(function () { return null; });
    }

    // Рисует в элементе блок «Войти / Регистрация» или «почта · Выйти»
    function mountAccount(el) {
        function draw(user) {
            el.textContent = '';
            if (user) {
                var mail = document.createElement('span');
                mail.className = 'acc-mail';
                mail.textContent = user.email || 'Аккаунт';
                var out = document.createElement('button');
                out.type = 'button'; out.className = 'acc-link'; out.textContent = 'Выйти';
                out.addEventListener('click', function () { client.auth.signOut(); });
                el.appendChild(mail); el.appendChild(out);
            } else {
                var a = document.createElement('a');
                a.className = 'acc-link'; a.href = 'login.html'; a.textContent = 'Войти';
                var b = document.createElement('a');
                b.className = 'acc-link'; b.href = 'register.html'; b.textContent = 'Регистрация';
                el.appendChild(a); el.appendChild(b);
            }
        }
        getUser().then(draw);
        client.auth.onAuthStateChange(function (ev, session) { draw(session ? session.user : null); });
    }

    window.HW_AUTH = { client: client, base: BASE, safeNext: safeNext, ruError: ruError, getUser: getUser, mountAccount: mountAccount };
})();
