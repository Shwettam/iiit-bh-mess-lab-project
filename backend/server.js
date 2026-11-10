const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const multer = require('multer');
const app = express(); app.use(express.json());
const DATA = process.env.VERCEL ? '/tmp' : __dirname;   // Vercel's filesystem is read-only except /tmp
const DB = path.join(DATA, 'data.json');
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const STAFF = { 'admin@test.in': { pw: '@Admin123', role: 'admin' }, 'mess1@test.in': { pw: '@Mess001', role: 'mess' } };
const TIMES = { breakfast: '7:30am - 9:00am', lunch: '12:30pm - 2:30pm', dinner: '7:30pm - 9:00pm' };

const START = { breakfast: '07:30', lunch: '12:30', dinner: '19:30' };   // IST meal start
const CUTOFF = { breakfast: 7, lunch: 1, dinner: 1 };                         // hours before start that ordering closes
const closesAt = (date, meal) => Date.parse(`${date}T${START[meal]}:00+05:30`) - CUTOFF[meal] * 36e5;
// Menu text format: one dish per line. "A | B" = choose one. Add (NV) for non-veg.
const parseMeal = t => String(t || '').split('\n').map(l => l.trim()).filter(Boolean)
  .map(l => l.split('|').map(x => x.trim()).filter(Boolean).map(x => ({ n: x.replace(/\s*\(NV\)\s*/i, '').trim(), v: !/\(NV\)/i.test(x) })));

function seed() {
  const J = a => a.join('\n');
  const b = [['Poha + Matar Curry + Jalebi (1 pc)'],['Dahi Bara (4 pcs) + Aloo Dum'],['Veg Sandwich','Banana | Boiled Egg (NV)'],['Uttapam | Masala Chakuli','Sambar + Chutney'],['Upma + Matar Curry + 1 small cup tea'],['Khakra/Kakera + Aloo Chop + Matar Curry'],['Vada + Matar Curry']];
  const l = [['Rice + Roti','Arhar Dal + Lal Chana Masala','Alu Bharta'],['Rice + Roti','Rajma','Sambar','Dahi Boondi','Papad | Fryums','Alu Bhaja'],['Rice + Roti','Chicken Curry (NV) | Paneer Curry','Arhar Dal','Salad'],['Rice + Roti','Moong Dal','Veg Kolhapuri + Aloo Chips'],['Rice + Roti','Arhar Dal','Fish Curry (NV) | Palak Paneer','Salad'],['Rice + Roti','Egg Curry (NV) | Navaratna Korma','Salad | Papad'],['Chicken Biriyani (NV) | Veg Biriyani','Raita','Gulab Jamun']];
  const d = [['Roti','Bhindi Alu','Suji Kheer'],['Roti + Rice','Baby Corn Masala','Gulab Jamun'],['Rice + Roti','Gobi Masala | Egg Tadka (NV)','Gulab Jamun'],['Cholle Bhature','Curd','Achaar'],['Rice + Roti','Matar Paneer'],['Rice + Roti','Chana Masala'],['Rice + Roti','Chicken Kasa (NV) | Paneer Hyderabadi']];
  const menu = {}; DAYS.forEach((x, i) => menu[x] = { breakfast: J(b[i]), lunch: J(l[i]), dinner: J(d[i]) });
  return { menu, prices: { breakfast: 30, lunch: 65, dinner: 55 }, notices: [], orders: [], grievances: [] };
}
const src = [DB, path.join(__dirname, 'data.json')].find(fs.existsSync);   // on Vercel, start from the committed data.json
let db = src ? JSON.parse(fs.readFileSync(src)) : seed();
db.students = db.students || {};   // email -> { qr }  (one permanent QR code per student)
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));
const uid = p => p + crypto.randomBytes(4).toString('hex').toUpperCase();
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const dayOf = date => DAYS[(new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7];

const DEMO = process.env.STAFF_PASSWORD_LOGIN !== '1';   // demo mode: admin/mess enter without a password. Run with STAFF_PASSWORD_LOGIN=1 to turn passwords back on.
// Signed tokens instead of an in-memory session map: serverless instances don't share memory.
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
const verify = t => {
  const [p, g = ''] = String(t || '').split('.'), a = Buffer.from(g), b = Buffer.from(sign(p || ''));
  if (!p || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const s = JSON.parse(Buffer.from(p, 'base64url')); return s.exp > Date.now() ? s : null;
};
const auth = (...roles) => (req, res, next) => {
  const s = verify((req.headers.authorization || '').replace('Bearer ', '') || req.query.t);
  if (!s || (roles.length && !roles.includes(s.role))) return res.status(401).json({ error: 'Not authorised' });
  req.user = s; next();
};
const login = (res, user) => { const p = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 864e5 })).toString('base64url'); res.json({ token: p + '.' + sign(p), user }); };

app.get('/api/config', (_, res) => res.json({ times: TIMES, days: DAYS, today: today(), staffDemo: DEMO, starts: START, cutoff: CUTOFF, now: Date.now() }));

app.post('/api/demo', (req, res) => {
  const r = req.body.role;
  if (!DEMO) return res.status(403).json({ error: 'Demo login is switched off' });
  if (r !== 'admin' && r !== 'mess') return res.status(400).json({ error: 'Bad role' });
  login(res, { email: r === 'admin' ? 'admin@test.in' : 'mess1@test.in', role: r });
});
app.post('/api/login', (req, res) => {
  const { email = '', password = '' } = req.body, u = STAFF[email.toLowerCase()];
  if (!u || u.pw !== password) return res.status(401).json({ error: 'Invalid email or password' });
  login(res, { email: email.toLowerCase(), role: u.role });
});

// Student demo login: roll number only. Format BXYYZZZ = B + branch code + 2-digit joining year + 3-digit number (e.g. B522001)
const ROLL = /^B[A-Z0-9]\d{5}$/;
app.post('/api/student/login', (req, res) => {
  const roll = String(req.body.roll || '').trim().toUpperCase();
  if (!ROLL.test(roll)) return res.status(400).json({ error: 'Enter a valid roll number in the format BXYYZZZ (e.g. B522001)' });
  login(res, { email: roll.toLowerCase() + '@iiit-bh.ac.in', role: 'student', roll });
});

app.get('/api/menu', auth(), (_, res) => {
  const parsed = {}; for (const d of DAYS) { parsed[d] = {}; for (const m of Object.keys(TIMES)) parsed[d][m] = parseMeal(db.menu[d][m]); }
  res.json({ menu: db.menu, parsed, prices: db.prices });
});
app.put('/api/menu', auth('admin', 'mess'), (req, res) => {
  const { day, meal, items } = req.body;
  if (!db.menu[day] || !TIMES[meal] || !items) return res.status(400).json({ error: 'Bad request' });
  db.menu[day][meal] = items; save(); res.json({ ok: true });
});
app.put('/api/prices', auth('admin', 'mess'), (req, res) => {
  for (const m of Object.keys(TIMES)) { const v = Number(req.body[m]); if (v > 0) db.prices[m] = v; }
  save(); res.json(db.prices);
});

app.get('/api/notices', auth(), (_, res) => res.json(db.notices));
app.post('/api/notices', auth('admin', 'mess'), (req, res) => {
  db.notices.unshift({ id: uid('N'), title: req.body.title, body: req.body.body, by: req.user.role, at: new Date().toISOString() });
  save(); res.json({ ok: true });
});
app.delete('/api/notices/:id', auth('admin', 'mess'), (req, res) => { db.notices = db.notices.filter(n => n.id !== req.params.id); save(); res.json({ ok: true }); });

// Student orders (payment simulated: method is recorded, status set to paid)
app.post('/api/orders', auth('student'), (req, res) => {
  const { date, orders, method } = req.body;
  if (!date || date < today() || date > new Date(Date.parse(today()) + 6 * 864e5).toISOString().slice(0, 10)) return res.status(400).json({ error: 'Choose a date within the next 7 days' });
  if (!Array.isArray(orders) || !orders.length) return res.status(400).json({ error: 'Select at least one meal' });
  if (method && !['UPI', 'Card', 'Cash'].includes(method)) return res.status(400).json({ error: 'Unknown payment method' });
  const made = [], now = Date.now();
  for (const { meal, picks = {} } of orders) {
    if (!TIMES[meal]) continue;
    const name = meal[0].toUpperCase() + meal.slice(1);
    if (now >= closesAt(date, meal)) return res.status(403).json({ error: `${name} orders for ${date} are closed` });
    if (db.orders.some(o => o.email === req.user.email && o.date === date && o.meal === meal)) return res.status(409).json({ error: `${name} already ordered for ${date}` });
    const dishes = parseMeal(db.menu[dayOf(date)][meal]).map((g, i) => g[Math.min(Math.max(parseInt(picks[i]) || 0, 0), g.length - 1)]);
    made.push({ id: uid('ORD-'), email: req.user.email, date, day: dayOf(date), meal, items: dishes.map(d => d.n).join(', '), dishes, diet: dishes.some(d => !d.v) ? 'nonveg' : 'veg', amount: db.prices[meal], method: method || 'UPI', payment: method === 'Cash' ? 'pending' : 'paid', status: 'paid', createdAt: new Date().toISOString(), servedAt: null });
  }
  db.orders.push(...made); save(); res.json(made);
});
app.get('/api/orders/mine', auth('student'), (req, res) => {
  const o = db.orders.filter(x => x.email === req.user.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ orders: o, total: o.reduce((s, x) => s + x.amount, 0) });
});

// ---- One QR per student. Scanning lists their orders, nearest meal first ----
const END = { breakfast: '09:00', lunch: '14:30', dinner: '21:00' }, GRACE_MIN = 30;   // serving window = start-30min .. end+30min
const at = (o, t) => Date.parse(`${o.date}T${t}:00+05:30`);
function studentOrders(email) {
  const now = Date.now(), t = today();
  return db.orders.filter(o => o.email === email && o.date >= t && (o.status === 'paid' || (o.status === 'served' && o.date === t))).map(o => {
    const st = at(o, START[o.meal]), en = at(o, END[o.meal]);
    const state = o.status === 'served' ? 'served' : now > en + GRACE_MIN * 6e4 ? 'expired' : now >= st - GRACE_MIN * 6e4 ? 'now' : 'upcoming';
    return { ...o, state, servable: state === 'now', _s: st };
  }).sort((a, b) => ({ now: 0, upcoming: 0, expired: 1, served: 2 }[a.state] - { now: 0, upcoming: 0, expired: 1, served: 2 }[b.state]) || a._s - b._s);
}
const qrFor = email => (db.students[email] = db.students[email] || { qr: 'STU-' + crypto.randomBytes(4).toString('hex').toUpperCase() }).qr;
function resolveStudent(code) {
  const c = String(code || '').trim(), up = c.toUpperCase();
  const hit = Object.entries(db.students).find(([, v]) => v.qr === up); if (hit) return hit[0];
  const ord = db.orders.find(o => o.id === up); if (ord) return ord.email;                      // old per-order codes still work
  const em = c.toLowerCase() + '@iiit-bh.ac.in'; return db.orders.some(o => o.email === em) ? em : null;   // roll number typed manually
}
app.get('/api/me/qr', auth('student'), (req, res) => { const code = qrFor(req.user.email); save(); res.json({ code, roll: req.user.roll }); });
app.post('/api/verify', auth('mess'), (req, res) => {
  const email = resolveStudent(req.body.code);
  if (!email) return res.status(404).json({ error: 'Invalid QR - student not found' });
  res.json({ roll: email.split('@')[0], orders: studentOrders(email).map(({ _s, ...o }) => o) });
});
app.post('/api/serve', auth('mess'), (req, res) => {
  const o = db.orders.find(x => x.id === req.body.id); if (!o) return res.status(404).json({ error: 'Order not found' });
  const v = studentOrders(o.email).find(x => x.id === o.id);
  if (!v) return res.status(409).json({ error: 'This order is not valid today' });
  if (v.state === 'served') return res.status(409).json({ error: 'Already served at ' + new Date(o.servedAt).toLocaleTimeString() });
  if (!v.servable) return res.status(409).json({ error: `Not serving time for ${o.meal} (${TIMES[o.meal]})` });
  o.status = 'served'; o.servedAt = new Date().toISOString();
  if (o.payment === 'pending') { o.payment = 'paid'; o.paidAt = o.servedAt; }   // cash is collected at the counter when the meal is handed over
  save(); res.json({ ok: true });
});

app.get('/api/orders', auth('admin'), (_, res) => res.json(db.orders.slice().reverse()));
app.get('/api/analytics', auth('admin'), (_, res) => {
  const meal = {}, daily = {}, diet = { veg: 0, nonveg: 0 }, methods = {}, ms = {}, gr = {}; let revenue = 0, served = 0, cashDue = 0;
  for (const o of db.orders) {
    const amt = o.payment === 'pending' ? 0 : o.amount; if (!amt) cashDue += o.amount;
    revenue += amt; if (o.status === 'served') served++;
    meal[o.meal] = meal[o.meal] || { orders: 0, revenue: 0 }; meal[o.meal].orders++; meal[o.meal].revenue += amt;
    daily[o.date] = (daily[o.date] || 0) + amt;
    diet[o.diet || 'veg']++; methods[o.method] = (methods[o.method] || 0) + amt;
    ms[o.meal] = ms[o.meal] || { served: 0, pending: 0 }; ms[o.meal][o.status === 'served' ? 'served' : 'pending']++;
  }
  for (const g of db.grievances) { gr[g.category] = gr[g.category] || { open: 0, resolved: 0 }; gr[g.category][g.status === 'resolved' ? 'resolved' : 'open']++; }
  res.json({ revenue, cashDue, orders: db.orders.length, served, pending: db.orders.length - served, students: new Set(db.orders.map(o => o.email)).size, meal, daily, diet, methods, ms, gr });
});

// ---- Grievances with photo/video evidence (stored in backend/uploads) ----
const UP = path.join(DATA, 'uploads'); fs.mkdirSync(UP, { recursive: true });
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/heic': '.heic', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const upload = multer({
  storage: multer.diskStorage({ destination: UP, filename: (_, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[f.mimetype]) }),
  limits: { fileSize: 25 * 1024 * 1024, files: 3 },
  fileFilter: (_, f, cb) => cb(EXT[f.mimetype] ? null : new Error('Only JPG/PNG/GIF/WEBP/HEIC images and MP4/WEBM/MOV videos are allowed'), !!EXT[f.mimetype])
});
const uploadMw = (req, res, next) => upload.array('files', 3)(req, res, e => e ? res.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 25 MB each)' : e.code === 'LIMIT_UNEXPECTED_FILE' ? 'Maximum 3 files' : e.message }) : next());
app.post('/api/grievances', auth('student'), uploadMw, (req, res) => {
  const { category, message } = req.body;
  if (!message || message.trim().length < 3) { (req.files || []).forEach(f => fs.unlink(f.path, () => { })); return res.status(400).json({ error: 'Please describe the issue' }); }
  const files = (req.files || []).map(f => ({ name: f.filename, type: f.mimetype.startsWith('video') ? 'video' : 'image', orig: f.originalname }));
  db.grievances.unshift({ id: uid('G'), email: req.user.email, category, message: message.trim(), files, status: 'open', at: new Date().toISOString() });
  save(); res.json({ ok: true });
});
app.get('/api/files/:name', auth('admin', 'mess', 'student'), (req, res) => {
  const n = path.basename(req.params.name), g = db.grievances.find(x => (x.files || []).some(f => f.name === n));
  if (!g || (req.user.role === 'student' && g.email !== req.user.email)) return res.status(404).end();
  res.set('X-Content-Type-Options', 'nosniff'); res.sendFile(path.join(UP, n));
});
app.get('/api/grievances', auth('admin', 'mess', 'student'), (req, res) =>
  res.json(req.user.role === 'student' ? db.grievances.filter(g => g.email === req.user.email) : db.grievances));
app.put('/api/grievances/:id', auth('admin', 'mess'), (req, res) => {
  const g = db.grievances.find(x => x.id === req.params.id); if (g) g.status = 'resolved'; save(); res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, '..', 'frontend'), { extensions: ['html'], etag: false, lastModified: false, setHeaders: r => r.setHeader('Cache-Control', 'no-store') })); // never serve a stale copy of the pages // /mess and /admin resolve to mess.html / admin.html
const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, '0.0.0.0', () => {   // local `npm start`; on Vercel the app is exported instead
  console.log('IIIT-BH Mess running on http://localhost:' + PORT);
  for (const list of Object.values(require('os').networkInterfaces())) for (const i of list) if (i.family === 'IPv4' && !i.internal) console.log('Open on your phone (same Wi-Fi): http://' + i.address + ':' + PORT);
});
module.exports = app;
