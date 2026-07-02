// Lưu token xe kết nối theo familyId (file JSON). Prototype — bản thật nên mã hoá.
const fs = require('fs');
const path = require('path');

const FILE = process.env.VEHICLE_STORE || path.join(__dirname, '..', '..', 'data', 'vehicles.json');

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(obj) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

function saveToken(familyId, token) {
  const all = readAll();
  all[familyId] = { ...token, updatedAt: Date.now() };
  writeAll(all);
}

function getToken(familyId) {
  return readAll()[familyId] || null;
}

module.exports = { saveToken, getToken };
