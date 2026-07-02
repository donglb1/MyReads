// Smoke test: chạy server với provider mock + API_KEY, kiểm tra /health, auth, /call, /sms.
process.env.PROVIDER = 'mock';
process.env.API_KEY = 'test-key';

const app = require('../src/index');

const PORT = 3999;
const base = `http://127.0.0.1:${PORT}`;
let failures = 0;

function check(cond, msg) {
  if (cond) {
    console.log('  ✓', msg);
  } else {
    failures += 1;
    console.error('  ✗', msg);
  }
}

async function run() {
  const server = app.listen(PORT);
  try {
    // /health
    let r = await fetch(`${base}/health`);
    let j = await r.json();
    check(r.status === 200 && j.provider === 'mock', 'GET /health trả provider=mock');

    // /call thiếu auth -> 401
    r = await fetch(`${base}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '+84900000000', message: 'test' }),
    });
    check(r.status === 401, 'POST /call không token -> 401');

    // /call thiếu tham số -> 400
    r = await fetch(`${base}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
      body: JSON.stringify({}),
    });
    check(r.status === 400, 'POST /call thiếu to/message -> 400');

    // /call hợp lệ -> ok
    r = await fetch(`${base}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
      body: JSON.stringify({ to: '+84900000000', message: 'Canh bao be tren xe' }),
    });
    j = await r.json();
    check(r.status === 200 && j.ok === true, 'POST /call hợp lệ -> ok');

    // /sms hợp lệ -> ok
    r = await fetch(`${base}/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
      body: JSON.stringify({ to: '+84900000000', message: 'Canh bao' }),
    });
    j = await r.json();
    check(r.status === 200 && j.ok === true, 'POST /sms hợp lệ -> ok');
  } finally {
    server.close();
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} kiểm tra thất bại.`);
    process.exit(1);
  }
  console.log('\n✅ Tất cả smoke test của server đều PASS.');
}

run();
