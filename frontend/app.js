const API = '/api', $ = s => document.querySelector(s), app = $('#app'), nav = $('#nav');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s[0].toUpperCase() + s.slice(1), MEALS = ['breakfast', 'lunch', 'dinner'];
let charts = [];
let S = { token: sessionStorage.token || '', user: JSON.parse(sessionStorage.user || 'null'), cfg: null, tab: '', scanner: null };

async function api(path, method = 'GET', body) {
  const fd = body instanceof FormData;
  const r = await fetch(API + path, { method, headers: { ...(fd ? {} : { 'Content-Type': 'application/json' }), Authorization: 'Bearer ' + S.token }, body: fd ? body : body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.user) { logout(); }
  if (!r.ok) { const e = new Error(j.error || 'Error'); e.data = j; throw e; }
  return j;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
function logout() { sessionStorage.clear(); S.token = ''; S.user = null; stopScan(); init(); }
function setSession(r) { S.token = r.token; S.user = r.user; sessionStorage.token = r.token; sessionStorage.user = JSON.stringify(r.user); init(); }

/* ---------- LOGIN ---------- */
const ROLE = document.body.dataset.role || 'student';   // each login lives on its own page: / , /mess , /admin
const LBL = { student: 'Student', mess: 'Mess Staff', admin: 'Admin' };
document.title = LBL[ROLE] + ' · IIIT Bhubaneswar Mess';
const HERO = {
  student: ['Fresh meals, <em>zero queues.</em>', 'Order a day ahead, pay once and walk in with a single QR.'],
  mess: ['Serve faster, <em>verify instantly.</em>', 'Scan a student QR, see exactly what they ordered and serve the right meal.'],
  admin: ['Run the mess with <em>clarity.</em>', 'Menus, prices, payments and live analytics in one calm dashboard.']
};
const ICON = {
  menu: '<path d="M4 3v8a3 3 0 0 0 3 3v7M7 3v6M10 3v8a3 3 0 0 1-3 3M18 3c-2.5 1.5-3.5 4-3.5 7H18v11"/>',
  notices: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  orders: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/>',
  help: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  scan: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  analytics: '<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>',
  payments: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'
};
const ic = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

function loginView() {
  document.body.classList.remove('in'); nav.classList.add('hidden'); $('#who').innerHTML = ''; $('#ph').innerHTML = '';
  const [head, sub] = HERO[ROLE];
  app.innerHTML = `<div class="auth">
    <section class="hero"><div class="hero-in">
      <div class="hbrand"><img class="logo" src="assets/logo.png" alt=""><div><b>IIIT Bhubaneswar</b><small>Mess Management System</small></div></div>
      <h1>${head}</h1><p>${sub}</p>
      <ul class="chips"><li>${ic('orders')}One QR for every meal</li><li>${ic('menu')}Veg / non-veg choices</li><li>${ic('notices')}Live notice board</li></ul>
    </div></section>
    <section class="panel"><div class="pbox"><span class="chip">${LBL[ROLE]} portal</span><h2>Welcome back</h2><div id="lbody"></div><p class="foot">© IIIT Bhubaneswar · Mess Management · build 10</p></div></section></div>`;
  if (ROLE === 'student') {
    $('#lbody').innerHTML = `<p class="sub">Enter your roll number to continue.</p>
      <div class="demo"><b>Demo access</b><span>Roll number format <b>BXYYZZZ</b>: B + branch code + joining year (2 digits) + your number (3 digits). Example: B522001</span></div>
      <form id="demoForm" autocomplete="off"><label for="demo">Roll number</label><input id="demo" name="roll" type="text" maxlength="7" placeholder="B522001" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.08em"><button type="submit" style="width:100%" id="demoGo">Continue →</button></form>`;
    if (window.innerWidth > 900) $('#demo').focus();
    $('#demoForm').addEventListener('submit', e => {
      e.preventDefault();
      const r = $('#demo').value.trim().toUpperCase();
      if (!/^B[A-Z0-9]\d{5}$/.test(r)) { toast('Enter a valid roll number: BXYYZZZ (e.g. B522001)'); return; }
      guard(async () => setSession(await api('/student/login', 'POST', { roll: r })))();
    });
  } else if (S.cfg.staffDemo) {
    $('#lbody').innerHTML = `<p class="sub">Open the ${ROLE === 'admin' ? 'admin dashboard' : 'mess counter'}.</p><div class="demo"><b>Demo access</b><span>Password login is switched off for now, just continue.</span></div><button style="width:100%" id="demoGo">Enter ${ROLE === 'admin' ? 'admin dashboard' : 'mess dashboard'} →</button>`;
    $('#demoGo').onclick = guard(async () => setSession(await api('/demo', 'POST', { role: ROLE })));
  } else {
    $('#lbody').innerHTML = `<label>Email</label><input id="em" type="email" autocomplete="username" autocapitalize="off" spellcheck="false"><label>Password</label><div style="position:relative"><input id="pw" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" style="padding-right:70px"><button type="button" class="sm sec" id="eye" style="position:absolute;right:6px;top:6px">Show</button></div><button style="width:100%" id="go">Login</button>`;
    $('#go').onclick = guard(async () => {
      const res = await api('/login', 'POST', { email: $('#em').value, password: $('#pw').value });
      if (res.user.role !== ROLE) throw new Error('Not a ' + (ROLE === 'mess' ? 'mess staff' : 'admin') + ' account');
      setSession(res);
    });
    $('#eye').onclick = () => { const p = $('#pw'), h = p.type === 'password'; p.type = h ? 'text' : 'password'; $('#eye').textContent = h ? 'Hide' : 'Show'; p.focus(); };
  }
}

/* ---------- SHELL ---------- */
const TABS = {
  student: [['menu', 'Menu & Order'], ['notices', 'Notice Board'], ['orders', 'My Orders & QR'], ['help', 'Grievance / Contact']],
  mess: [['menu', 'Menu'], ['scan', 'Verify QR'], ['edit', 'Update Menu'], ['notices', 'Notices'], ['help', 'Grievances']],
  admin: [['analytics', 'Analytics'], ['payments', 'Payments'], ['menu', 'Menu'], ['edit', 'Update Menu & Prices'], ['notices', 'Notices'], ['help', 'Grievances']]
};
function shell() {
  const role = S.user.role; S.tab = S.tab && TABS[role].some(t => t[0] === S.tab) ? S.tab : TABS[role][0][0];
  const name = S.user.roll || (role === 'admin' ? 'Admin' : 'Mess team'), label = TABS[role].find(t => t[0] === S.tab)[1];
  const hr = new Date(Date.now() + (S.skew || 0) + 5.5 * 36e5).getUTCHours(), hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  document.body.classList.add('in');
  $('#who').innerHTML = `<div class="av">${esc(name[0].toUpperCase())}</div><div class="wt"><b>${esc(name)}</b><small>${role}</small></div><button class="sm ghost" id="lo">Logout</button>`;
  $('#lo').onclick = logout; $('#lo2').onclick = logout;
  $('#ph').innerHTML = `<h1>${label}</h1><p>${hello}, <b>${esc(name)}</b> · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>`;
  nav.classList.remove('hidden');
  const SHORT = { menu: 'Menu', notices: 'Notices', orders: 'My QR', scan: 'Scan', edit: 'Edit', analytics: 'Stats', payments: 'Payments', help: role === 'student' ? 'Help' : 'Issues' };
  nav.innerHTML = TABS[role].map(([k, l]) => `<button data-k="${k}" class="${k === S.tab ? 'on' : ''}">${ic(k)}<span class="l">${l}</span><span class="s">${SHORT[k]}</span></button>`).join('');
  nav.querySelectorAll('button').forEach(b => b.onclick = () => { S.tab = b.dataset.k; shell(); window.scrollTo(0, 0); });
  stopScan(); guard(VIEWS[S.tab])();
}

/* ---------- SHARED VIEWS ---------- */
const vm = v => `<span class="vm ${v ? 'v' : 'n'}" title="${v ? 'Veg' : 'Non-veg'}"></span>`;
const groupsHtml = gs => gs.map(g => `<div>${g.map(o => vm(o.v) + esc(o.n)).join(' <span class="or">or</span> ')}</div>`).join('');
const mealCard = (m, groups, price) => `<div class="meal m-${m}"><span class="price">₹${price}</span><b>${cap(m)}</b> <small>${S.cfg.times[m]}</small>${groupsHtml(groups)}</div>`;
const VIEWS = {
  async menu() {
    const { parsed: menu, prices } = await api('/menu'), role = S.user.role;
    const todayName = S.cfg.days[(new Date(S.cfg.today + 'T00:00:00Z').getUTCDay() + 6) % 7];
    app.innerHTML = `<div class="card"><h2>Weekly Menu</h2><p style="color:var(--mut);margin:0">Breakfast ₹${prices.breakfast} · Lunch ₹${prices.lunch} · Dinner ₹${prices.dinner}</p></div>
    ${role === 'student' ? '<div id="orderBox"></div>' : ''}
    <div class="grid">${S.cfg.days.map(d => `<div class="card" ${d === todayName ? 'style="border:2px solid var(--or)"' : ''}><h3>${d} ${d === todayName ? '<span class="tag o">Today</span>' : ''}</h3>${MEALS.map(m => mealCard(m, menu[d][m], prices[m])).join('')}</div>`).join('')}</div>`;
    if (role === 'student') orderBox(prices, menu);
  },
  async notices() {
    const n = await api('/notices'), staff = S.user.role !== 'student';
    app.innerHTML = `${staff ? `<div class="card"><h2>Publish Notice</h2><input id="nt" placeholder="Title"><textarea id="nb" placeholder="Notice details"></textarea><button id="np">Publish</button></div>` : ''}
    <div class="card"><h2>Notice Board</h2>${n.map(x => `<div class="notice"><b>${esc(x.title)}</b><div>${esc(x.body)}</div><small>${new Date(x.at).toLocaleString()} · ${x.by}</small>${staff ? ` <button class="sm red" data-d="${x.id}">Delete</button>` : ''}</div>`).join('') || '<p>No notices yet.</p>'}</div>`;
    if (staff) {
      $('#np').onclick = guard(async () => { await api('/notices', 'POST', { title: $('#nt').value, body: $('#nb').value }); toast('Published'); VIEWS.notices(); });
      app.querySelectorAll('[data-d]').forEach(b => b.onclick = guard(async () => { await api('/notices/' + b.dataset.d, 'DELETE'); VIEWS.notices(); }));
    }
  },
  async help() {
    const g = await api('/grievances'), role = S.user.role;
    const media = x => (x.files || []).map(f => { const u = `${API}/files/${f.name}?t=${S.token}`; return f.type === 'video' ? `<video src="${u}" controls preload="metadata" style="max-width:170px;max-height:120px;border-radius:6px;margin:3px"></video>` : `<a href="${u}" target="_blank"><img src="${u}" alt="" style="max-width:110px;max-height:90px;border-radius:6px;margin:3px"></a>`; }).join('');
    app.innerHTML = `${role === 'student' ? `<div class="card"><h2>Raise a Grievance / Complaint</h2><label>Category</label><select id="gc"><option>Food quality</option><option>Hygiene</option><option>Billing / Payment</option><option>Staff behaviour</option><option>Other</option></select><textarea id="gm" placeholder="Describe the issue"></textarea>
    <label>Attach photos / videos (optional, up to 3 files, 25 MB each)</label><input id="gf" type="file" accept="image/*,video/*" multiple><div id="gp" style="font-size:12px;color:var(--mut);margin-bottom:10px"></div><button id="gs">Submit</button>
    <p style="font-size:13px;color:var(--mut)">Mess office: mess1@test.in · Admin: admin@test.in</p></div>` : ''}
    <div class="card"><h2>${role === 'student' ? 'My Grievances' : 'Grievances Received'}</h2><div class="wrap"><table><tr><th>Date</th>${role !== 'student' ? '<th>Student</th>' : ''}<th>Category</th><th>Message</th><th>Status</th></tr>
    ${g.map(x => `<tr><td>${new Date(x.at).toLocaleDateString()}</td>${role !== 'student' ? `<td>${esc(x.email.split('@')[0].toUpperCase())}</td>` : ''}<td>${esc(x.category)}</td><td style="white-space:normal;min-width:190px">${esc(x.message)}<div>${media(x)}</div></td><td>${x.status === 'open' ? (role !== 'student' ? `<button class="sm" data-r="${x.id}">Resolve</button>` : '<span class="tag o">open</span>') : '<span class="tag">resolved</span>'}</td></tr>`).join('') || '<tr><td colspan=5>None</td></tr>'}</table></div></div>`;
    if ($('#gs')) {
      $('#gf').onchange = () => $('#gp').textContent = [...$('#gf').files].map(f => f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)').join(' · ');
      $('#gs').onclick = guard(async () => {
        const fd = new FormData(), fl = [...$('#gf').files];
        if (fl.length > 3) throw new Error('Maximum 3 files');
        const big = fl.find(f => f.size > 25 * 1048576); if (big) throw new Error(big.name + ' is over 25 MB');
        fd.append('category', $('#gc').value); fd.append('message', $('#gm').value); fl.forEach(f => fd.append('files', f));
        $('#gs').disabled = true; $('#gs').textContent = 'Uploading...';
        try { await api('/grievances', 'POST', fd); } catch (e) { $('#gs').disabled = false; $('#gs').textContent = 'Submit'; throw e; }
        toast('Submitted'); VIEWS.help();
      });
    }
    app.querySelectorAll('[data-r]').forEach(b => b.onclick = guard(async () => { await api('/grievances/' + b.dataset.r, 'PUT'); VIEWS.help(); }));
  },
  async edit() {
    const { menu, prices } = await api('/menu');
    app.innerHTML = `<div class="grid"><div class="card"><h2>Update Menu</h2><label>Day</label><select id="ed">${S.cfg.days.map(d => `<option>${d}</option>`).join('')}</select>
    <label>Meal</label><select id="em2">${MEALS.map(m => `<option>${m}</option>`).join('')}</select><label>Dishes: one per line · use <b>|</b> for a choice (pick one) · add <b>(NV)</b> for non-veg</label><textarea id="ei" style="min-height:150px"></textarea><button id="eb">Save menu</button></div>
    <div class="card"><h2>Meal Prices (₹)</h2>${MEALS.map(m => `<label>${cap(m)}</label><input type="number" id="p_${m}" value="${prices[m]}">`).join('')}<button id="pb">Save prices</button></div></div>`;
    const fill = () => $('#ei').value = menu[$('#ed').value][$('#em2').value]; $('#ed').onchange = $('#em2').onchange = fill; fill();
    $('#eb').onclick = guard(async () => { await api('/menu', 'PUT', { day: $('#ed').value, meal: $('#em2').value, items: $('#ei').value }); menu[$('#ed').value][$('#em2').value] = $('#ei').value; toast('Menu updated'); });
    $('#pb').onclick = guard(async () => { await api('/prices', 'PUT', Object.fromEntries(MEALS.map(m => [m, $('#p_' + m).value]))); toast('Prices updated'); });
  },
  /* ---------- STUDENT ---------- */
  async orders() {
    const [{ orders, total }, me] = await Promise.all([api('/orders/mine'), api('/me/qr')]), t = S.cfg.today;
    const up = orders.filter(o => o.status === 'paid' && o.date >= t).sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
    const st = o => o.status === 'served' ? ['served', ''] : o.date < t ? ['expired', 'r'] : ['pending', 'o'];
    app.innerHTML = `<div class="grid"><div class="card qrbox"><h2>My Meal QR</h2><div id="myqr" style="margin:6px 0"></div><br><b>${esc(me.roll)}</b><br><small>One QR for all your orders. Show it at the mess counter.</small></div>
    <div class="card"><h2>Total Bill</h2><div class="stat">₹${total}</div><small>${orders.length} meal orders (paid)</small>
    <h3 style="margin-top:14px">Upcoming meals</h3>${up.map(o => `<div class="meal"><b>${vm(o.diet !== 'nonveg')}${cap(o.meal)}</b> · ${o.date} <small>${S.cfg.times[o.meal]}</small>${o.payment === 'pending' ? ` <span class="tag o">Cash due ₹${o.amount}</span>` : ''}<div style="font-size:13px">${(o.dishes || []).map(d => vm(d.v) + esc(d.n)).join(', ')}</div></div>`).join('') || '<p style="color:var(--mut)">No upcoming orders</p>'}</div></div>
    <div class="card"><h2>Order History</h2><div class="wrap"><table><tr><th>Order</th><th>Date</th><th>Meal</th><th>Paid via</th><th>₹</th><th>Status</th></tr>${orders.map(o => `<tr><td>${o.id}</td><td>${o.date}</td><td>${vm(o.diet !== 'nonveg')}${cap(o.meal)}</td><td>${o.method}${o.payment === 'pending' ? ' <span class="tag o">due</span>' : ''}</td><td>${o.amount}</td><td><span class="tag ${st(o)[1]}">${st(o)[0]}</span></td></tr>`).join('') || '<tr><td colspan=6>No orders yet</td></tr>'}</table></div></div>`;
    new QRCode($('#myqr'), { text: me.code, width: 200, height: 200 });
  },
  /* ---------- MESS ---------- */
  async scan() {
    app.innerHTML = `<div class="card"><h2>Verify Student QR</h2><div id="reader"></div><button id="st" style="margin-top:10px">Start camera</button><p style="font-size:12px;color:var(--mut)">Camera needs HTTPS or localhost.</p>
    <label>Or enter student QR code / roll number manually</label><input id="mc" placeholder="STU-XXXXXXXX or B522001"><button class="sec" id="mv">Verify</button><div id="vr"></div></div>`;
    $('#mv').onclick = () => verify($('#mc').value);
    $('#st').onclick = async () => {
      try {
        S.scanner = new Html5Qrcode('reader');
        await S.scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, async code => { if (S.busy) return; S.busy = true; try { S.scanner.pause(true); } catch { } await verify(code); });
      } catch { toast('Camera unavailable - allow access or use manual entry'); }
    };
  },
  /* ---------- ADMIN ---------- */
  async payments() {
    const o = await api('/orders');
    app.innerHTML = `<div class="card"><h2>Student Payments</h2><div class="wrap"><table><tr><th>Time</th><th>Roll no</th><th>Order</th><th>Meal / Date</th><th>Method</th><th>₹</th><th>Payment</th><th>Status</th></tr>${o.map(x => `<tr><td>${new Date(x.createdAt).toLocaleString()}</td><td>${esc(x.email.split('@')[0].toUpperCase())}</td><td>${x.id}</td><td>${cap(x.meal)} · ${x.date}</td><td>${x.method}</td><td>${x.amount}</td><td><span class="tag ${x.payment === 'pending' ? 'o' : ''}">${x.payment === 'pending' ? 'cash due' : 'paid'}</span></td><td><span class="tag ${x.status === 'served' ? '' : 'o'}">${x.status}</span></td></tr>`).join('') || '<tr><td colspan=8>No payments yet</td></tr>'}</table></div></div>`;
  },
  async analytics() {
    const a = await api('/analytics');
    if (typeof Chart === 'undefined') { app.innerHTML = '<div class="card">Charts library failed to load - check your internet connection.</div>'; return; }
    charts.forEach(c => c.destroy()); charts = [];
    const box = (id, t) => `<div class="card"><h3>${t}</h3><div class="chartbox"><canvas id="${id}"></canvas></div></div>`;
    app.innerHTML = `<div class="grid">${[['Revenue collected', '₹' + a.revenue], ['Cash to collect', '₹' + (a.cashDue || 0)], ['Orders', a.orders], ['Served', a.served], ['Pending', a.pending], ['Students', a.students]].map(([l, v]) => `<div class="card"><small>${l}</small><div class="stat">${v}</div></div>`).join('')}</div>
    <div class="grid wide">${box('c1', 'Revenue by date (₹)')}${box('c2', 'Revenue share by meal')}${box('c3', 'Veg vs Non-veg orders')}${box('c4', 'Served vs pending by meal')}${box('c5', 'Payments by method (₹)')}${box('c6', 'Grievances by category')}</div>`;
    const G = '#3E9B63', O = '#F28C28', B = '#2c7be5', R = '#d32f2f', P = '#8e6bbf', base = { responsive: true, maintainAspectRatio: false };
    const mk = (id, cfg) => charts.push(new Chart($('#' + id), cfg));
    const pie = (id, labels, data, colors) => mk(id, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors }] }, options: { ...base, plugins: { legend: { position: 'bottom' } } } });
    const dates = Object.keys(a.daily).sort(), stack = { ...base, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } };
    mk('c1', { type: 'line', data: { labels: dates, datasets: [{ label: 'Revenue (₹)', data: dates.map(d => a.daily[d]), borderColor: O, backgroundColor: '#F28C2833', fill: true, tension: .3 }] }, options: { ...base, scales: { y: { beginAtZero: true } } } });
    pie('c2', MEALS.map(cap), MEALS.map(m => a.meal[m]?.revenue || 0), [O, G, B]);
    pie('c3', ['Veg', 'Non-veg'], [a.diet.veg, a.diet.nonveg], [G, R]);
    mk('c4', { type: 'bar', data: { labels: MEALS.map(cap), datasets: [{ label: 'Served', data: MEALS.map(m => a.ms[m]?.served || 0), backgroundColor: G }, { label: 'Pending', data: MEALS.map(m => a.ms[m]?.pending || 0), backgroundColor: O }] }, options: stack });
    const pm = Object.keys(a.methods); pie('c5', pm, pm.map(k => a.methods[k]), [B, P, O, G]);
    const gc = Object.keys(a.gr); mk('c6', { type: 'bar', data: { labels: gc, datasets: [{ label: 'Open', data: gc.map(k => a.gr[k].open), backgroundColor: R }, { label: 'Resolved', data: gc.map(k => a.gr[k].resolved), backgroundColor: G }] }, options: stack });
  }
};

/* ---------- STUDENT ORDER BOX ---------- */
function orderBox(prices, parsed) {
  const dates = [...Array(7)].map((_, i) => new Date(Date.parse(S.cfg.today) + i * 864e5).toISOString().slice(0, 10));
  const dayName = d => S.cfg.days[(new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7];
  const closeAt = (d, m) => Date.parse(`${d}T${S.cfg.starts[m]}:00+05:30`) - S.cfg.cutoff[m] * 36e5;
  const left = ms => { const m = Math.max(1, Math.floor(ms / 6e4)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
  const sel = { date: dates[0], on: {}, picks: {}, method: 'UPI' };
  const chosen = () => MEALS.filter(m => document.querySelector(`.mc[value=${m}]:checked`));
  const total = () => $('#tot').textContent = '₹' + chosen().reduce((s, m) => s + prices[m], 0);
  const draw = () => {
    const now = Date.now() + S.skew, cd = dayName(sel.date);
    $('#orderBox').innerHTML = `<div class="card"><h2>Order Food</h2>
    <div class="grid"><div><label>Date</label><select id="od">${dates.map(d => `<option ${d === sel.date ? 'selected' : ''} value="${d}">${d} · ${dayName(d).slice(0, 3)}</option>`).join('')}</select></div>
    <div><label>Payment method</label><select id="om">${['UPI', 'Card', 'Cash'].map(x => `<option ${x === sel.method ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
    <p style="font-size:12px;color:var(--mut)">Orders close 1 hr before lunch &amp; dinner, and 7 hrs before breakfast. <span class="vm v"></span>Veg <span class="vm n" style="margin-left:8px"></span>Non-veg</p>
    <div class="grid">${MEALS.map(m => {
      const ca = closeAt(sel.date, m), closed = now >= ca, key = sel.date + m;
      return `<div class="card" style="margin:0;${closed ? 'opacity:.65' : ''}"><label style="font-size:15px;color:var(--ink)"><input type="checkbox" class="mc" value="${m}" ${closed ? 'disabled' : ''} ${sel.on[key] && !closed ? 'checked' : ''} style="width:auto;margin-right:8px"><b>${cap(m)}</b> <span class="price">₹${prices[m]}</span></label>
      <small>${S.cfg.times[m]} · ${closed ? '<span class="tag r">Closed</span>' : 'closes in ' + left(ca - now)}</small>
      <div style="margin-top:8px;font-size:14px">${parsed[cd][m].map((g, i) => g.length === 1 ? `<div>${vm(g[0].v)}${esc(g[0].n)}</div>` :
        `<div style="margin:4px 0;padding:4px 8px;background:#f7f9f7;border-radius:6px"><small>Choose one</small>${g.map((o, j) => `<label style="font-size:14px;color:var(--ink);margin:2px 0"><input type="radio" style="width:auto;margin:0 6px 0 0" name="g_${m}_${i}" data-k="${key + i}" value="${j}" ${(sel.picks[key + i] || 0) === j ? 'checked' : ''} ${closed ? 'disabled' : ''}>${vm(o.v)}${esc(o.n)}</label>`).join('')}</div>`).join('')}</div></div>`;
    }).join('')}</div>
    <div style="margin-top:12px"><label>Amount payable</label><div class="stat" id="tot">₹0</div><button id="pay">${sel.method === 'Cash' ? 'Place order' : 'Pay &amp; place order'}</button> <small>${sel.method === 'Cash' ? 'Pay in cash at the mess counter when you collect your meal.' : 'Payment is simulated in this demo.'}</small></div></div>`;
    $('#od').onchange = e => { sel.date = e.target.value; draw(); };
    $('#om').onchange = e => { sel.method = e.target.value; draw(); };
    document.querySelectorAll('.mc').forEach(c => c.onchange = () => { sel.on[sel.date + c.value] = c.checked; total(); });
    document.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => sel.picks[r.dataset.k] = +r.value);
    total();
    $('#pay').onclick = guard(async () => {
      const orders = chosen().map(m => ({ meal: m, picks: Object.fromEntries(parsed[cd][m].map((g, i) => [i, sel.picks[sel.date + m + i] || 0])) }));
      if (!orders.length) throw new Error('Tick at least one meal');
      await api('/orders', 'POST', { date: sel.date, orders, method: sel.method });
      clearInterval(S.timer); toast(sel.method === 'Cash' ? 'Order placed - pay cash at the counter' : 'Payment successful'); S.tab = 'orders'; shell();
    });
  };
  clearInterval(S.timer);
  S.timer = setInterval(() => { if ($('#orderBox')) { chosen().forEach(c => sel.on[sel.date + c.value] = true); draw(); } else clearInterval(S.timer); }, 30000);
  draw();
}

async function verify(code) {
  if (!code) return;
  const next = () => { S.busy = false; $('#vr').innerHTML = ''; $('#mc').value = ''; try { S.scanner && S.scanner.resume(); } catch { } };
  let r;
  try { r = await api('/verify', 'POST', { code }); }
  catch (e) { $('#vr').innerHTML = `<div class="res no"><b>✖ ${esc(e.message)}</b></div><button class="sec" id="nx" style="margin-top:10px">Scan next student</button>`; $('#nx').onclick = next; return; }
  S.lastCode = code;
  const L = { now: ['Serve now', ''], upcoming: ['Upcoming', 'o'], expired: ['Time over', 'r'], served: ['Served', ''] };
  const first = r.orders.findIndex(o => o.state === 'now' || o.state === 'upcoming');
  $('#vr').innerHTML = `<div class="res ok"><b>✔ Student: ${esc(r.roll)}</b> · ${r.orders.length} order(s) · nearest meal first</div>` +
    (r.orders.map((o, i) => `<div class="card" style="margin:10px 0 0;${i === first ? 'border:2px solid var(--or);' : ''}${o.state === 'expired' ? 'opacity:.6' : o.state === 'served' ? 'opacity:.9' : ''}">
      <span class="tag ${L[o.state][1]}" style="float:right">${i === first ? 'NEXT · ' : ''}${L[o.state][0]}</span>
      <b>${vm(o.diet !== 'nonveg')}${cap(o.meal)}</b> · ${o.date} <small>${S.cfg.times[o.meal]}</small> <span class="tag ${o.diet === 'nonveg' ? 'r' : ''}">${o.diet === 'nonveg' ? 'NON-VEG' : 'VEG'}</span>
      <div style="font-size:14px;margin:6px 0">${(o.dishes || []).map(d => vm(d.v) + esc(d.n)).join('<br>')}</div>${o.method === 'Cash' ? (o.payment === 'pending' ? `<div class="cash">💵 Collect ₹${o.amount} cash</div>` : '<span class="tag">Cash collected ✔</span>') : ''}
      <label class="ful ${o.state === 'served' ? 'done' : o.servable ? '' : 'off'}"><input type="checkbox" data-s="${o.id}" ${o.state === 'served' ? 'checked disabled' : o.servable ? '' : 'disabled'}>${o.state === 'served' ? 'Order fulfilled ✔' : o.servable ? 'Tick when this meal is handed over' : o.state === 'expired' ? 'Serving time is over' : 'Not serving time yet'}</label></div>`).join('') || '<div class="res no"><b>No active orders for this student</b></div>') +
    `<button class="sec" id="nx" style="margin-top:12px;width:100%">Scan next student</button>`;
  $('#nx').onclick = next;
  $('#vr').querySelectorAll('input[data-s]').forEach(c => c.addEventListener('change', guard(async () => {
    try { await api('/serve', 'POST', { id: c.dataset.s }); } catch (e) { c.checked = false; throw e; }
    toast('Order marked as fulfilled'); await verify(S.lastCode);
  })));
}
function stopScan() { if (S.scanner) { S.scanner.stop().catch(() => { }); S.scanner = null; } }

async function init() {
  if (!S.cfg) { S.cfg = await fetch(API + '/config').then(r => r.json()); S.skew = S.cfg.now - Date.now(); }
  if (S.user && S.user.role !== ROLE) { sessionStorage.clear(); S.token = ''; S.user = null; }  // a different role's session can't be used on this login page
  S.user ? shell() : loginView();
}
init();
