// Live E2E smoke test against a running backend (Task #11). Run: node smoke.mjs
const BASE = 'http://localhost:4000/v1';
let pass = 0, fail = 0;
const log = [];
const check = (name, cond, detail = '') => {
  if (cond) { pass++; log.push(`  PASS  ${name}`); }
  else { fail++; log.push(`  FAIL  ${name}  ${detail}`); }
};
const j = async (r) => { try { return await r.json(); } catch { return {}; } };

async function main() {
  let r, b;

  r = await fetch(`${BASE}/health`);
  check('GET /health 200', r.status === 200, `status=${r.status}`);

  // ---- auth ----
  r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'aba1234' }) });
  b = await j(r);
  check('POST /auth/login -> token+user', r.status >= 200 && r.status < 300 && !!b.token && !!b.user, `status=${r.status} ${JSON.stringify(b).slice(0, 140)}`);
  const token = b.token;
  const auth = { Authorization: `Bearer ${token}` };

  r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
  b = await j(r);
  check('POST /auth/login bad pw -> 401', r.status === 401 && b.error?.code === 'INVALID_CREDENTIALS', `status=${r.status} ${JSON.stringify(b)}`);

  r = await fetch(`${BASE}/auth/me`, { headers: auth }); b = await j(r);
  check('GET /auth/me -> admin', r.status === 200 && b.username === 'admin', `status=${r.status} ${JSON.stringify(b)}`);

  r = await fetch(`${BASE}/auth/me`);
  check('GET /auth/me no-token -> 401', r.status === 401, `status=${r.status}`);

  // ---- site / content ----
  r = await fetch(`${BASE}/site`); b = await j(r);
  check('GET /site -> brand+nav+sections', r.status === 200 && !!b.brand && Array.isArray(b.nav) && !!b.sections, `status=${r.status} keys=${Object.keys(b)}`);

  r = await fetch(`${BASE}/programs`); b = await j(r);
  check('GET /programs -> envelope {items,total}', r.status === 200 && Array.isArray(b.items) && typeof b.total === 'number', `status=${r.status} keys=${Object.keys(b)}`);
  check('GET /programs -> seeded total=6', b.total === 6, `total=${b.total}`);
  if (b.items?.[0]) check('program uses `photo` (frontend SSOT, not photoUrl)', 'photo' in b.items[0] && !('photoUrl' in b.items[0]), `keys=${Object.keys(b.items[0])}`);

  r = await fetch(`${BASE}/director`); b = await j(r);
  check('GET /director -> societies+organizations both present', r.status === 200 && 'societies' in b && 'organizations' in b, `status=${r.status} keys=${Object.keys(b)}`);

  r = await fetch(`${BASE}/popups/active`); b = await j(r);
  check('GET /popups/active -> array', r.status === 200 && Array.isArray(b), `status=${r.status} body=${JSON.stringify(b).slice(0,120)}`);

  // ---- consultations ----
  r = await fetch(`${BASE}/consultations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parent: '테스트', phone: '010-0000-0000' }) });
  b = await j(r);
  check('POST /consultations no-consent -> 422 PRIVACY_CONSENT_REQUIRED', r.status === 422 && b.error?.code === 'PRIVACY_CONSENT_REQUIRED', `status=${r.status} ${JSON.stringify(b)}`);

  r = await fetch(`${BASE}/consultations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parent: '홍길동', phone: '010-1234-5678', age: '만 4세', topic: '언어치료', note: '상담 희망합니다', privacyConsent: true }) });
  b = await j(r);
  check('POST /consultations consent -> created', (r.status === 201 || r.status === 200) && !!b.id, `status=${r.status} ${JSON.stringify(b).slice(0, 160)}`);
  check('consultation view has frontend aliases age/note/read/ts', 'age' in b && 'note' in b && 'read' in b && 'ts' in b, `keys=${Object.keys(b)}`);

  // ---- stats ----
  r = await fetch(`${BASE}/stats/hit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/', session: 'smoke-1' }) });
  check('POST /stats/hit -> 202', r.status === 202, `status=${r.status}`);

  r = await fetch(`${BASE}/stats/summary`, { headers: auth }); b = await j(r);
  check('GET /stats/summary admin -> today/total', r.status === 200 && !!b.today && !!b.total && typeof b.online === 'number', `status=${r.status} ${JSON.stringify(b)}`);

  r = await fetch(`${BASE}/stats/summary`);
  check('GET /stats/summary no-token -> 401', r.status === 401, `status=${r.status}`);

  // ---- privacy ----
  r = await fetch(`${BASE}/privacy/policy`); b = await j(r);
  check('GET /privacy/policy -> body', r.status === 200 && !!b.body, `status=${r.status} keys=${Object.keys(b)}`);

  // ---- uploads ----
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  let fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'test.png');
  r = await fetch(`${BASE}/uploads`, { method: 'POST', headers: auth, body: fd }); b = await j(r);
  check('POST /uploads image -> {url,...}', (r.status === 201 || r.status === 200) && typeof b.url === 'string' && b.url.startsWith('/uploads/'), `status=${r.status} ${JSON.stringify(b)}`);
  const uploadedUrl = b.url;

  if (uploadedUrl) {
    r = await fetch(`http://localhost:4000${uploadedUrl}`);
    check('GET uploaded file -> served 200', r.status === 200, `status=${r.status}`);
  }

  fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
  r = await fetch(`${BASE}/uploads`, { method: 'POST', body: fd });
  check('POST /uploads no-token -> 401', r.status === 401, `status=${r.status}`);

  fd = new FormData(); fd.append('file', new Blob([Buffer.from('hello world')], { type: 'text/plain' }), 'x.txt');
  r = await fetch(`${BASE}/uploads`, { method: 'POST', headers: auth, body: fd }); b = await j(r);
  check('POST /uploads non-image -> 422', r.status === 422, `status=${r.status} ${JSON.stringify(b)}`);

  console.log(log.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error('SMOKE_ERROR', e); process.exit(2); });
