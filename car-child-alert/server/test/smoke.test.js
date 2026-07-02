// Smoke test: chạy server với provider mock + API_KEY, kiểm tra /health, auth, /call, /sms,
// và đồng bộ đa thiết bị (/register, /notify-family) ở chế độ dry-run.
const os = require('os');
const path = require('path');
process.env.PROVIDER = 'mock';
process.env.VEHICLE_PROVIDER = 'mock';
process.env.API_KEY = 'test-key';
process.env.PUSH_DRY_RUN = 'true';
// Dùng file tạm để không đụng dữ liệu thật.
process.env.FAMILY_STORE = path.join(os.tmpdir(), `antoanbe-families-${Date.now()}.json`);

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

    // Đăng ký 2 thiết bị vào cùng gia đình.
    const authHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' };
    for (const [token, name] of [
      ['ExponentPushToken[me]', 'Điện thoại Bố'],
      ['ExponentPushToken[wife]', 'Điện thoại Mẹ'],
    ]) {
      r = await fetch(`${base}/register`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ familyId: 'fam1', pushToken: token, deviceName: name }),
      });
    }
    j = await r.json();
    check(r.status === 200 && j.devices === 2, 'POST /register -> gia đình có 2 thiết bị');

    // notify-family loại trừ thiết bị gửi -> chỉ còn 1 thiết bị nhận.
    r = await fetch(`${base}/notify-family`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        familyId: 'fam1',
        title: 'Cảnh báo bé trên xe',
        body: 'Kiểm tra ngay',
        excludeToken: 'ExponentPushToken[me]',
      }),
    });
    j = await r.json();
    check(r.status === 200 && j.sent === 1 && j.dryRun === true, 'POST /notify-family -> gửi 1 (loại trừ người gửi)');

    // Dữ liệu xe (mock): auth-url → exchange → state.
    r = await fetch(`${base}/vehicle/auth-url`, { headers: authHeaders });
    j = await r.json();
    check(r.status === 200 && typeof j.url === 'string', 'GET /vehicle/auth-url -> có url');

    r = await fetch(`${base}/vehicle/exchange`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ familyId: 'fam1', code: 'mock-code' }),
    });
    j = await r.json();
    check(r.status === 200 && j.vehicleId === 'mock-vehicle', 'POST /vehicle/exchange -> lưu token');

    r = await fetch(`${base}/vehicle/state?familyId=fam1`, { headers: authHeaders });
    j = await r.json();
    check(r.status === 200 && !!j.location && j.cabinTempC === 33, 'GET /vehicle/state -> có vị trí + nhiệt độ');
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
