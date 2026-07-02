require('dotenv').config();
const express = require('express');
const { createMockProvider } = require('./providers/mock');
const { createTwilioProvider } = require('./providers/twilio');
const { createStringeeProvider } = require('./providers/stringee');

const PROVIDER = (process.env.PROVIDER || 'mock').toLowerCase();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || '';

// Chọn provider theo biến môi trường (cùng một interface { call, sms }).
function buildProvider() {
  switch (PROVIDER) {
    case 'twilio':
      return createTwilioProvider(process.env);
    case 'stringee':
      return createStringeeProvider(process.env);
    case 'mock':
    default:
      return createMockProvider();
  }
}

const provider = buildProvider();

const app = express();
app.use(express.json());

// Xác thực đơn giản bằng Bearer token (API_KEY do backend cấp cho app).
function auth(req, res, next) {
  if (!API_KEY) return next(); // Không đặt API_KEY => bỏ qua (chỉ nên dùng khi dev).
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== API_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, provider: provider.name });
});

app.post('/call', auth, async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ ok: false, error: 'thiếu to/message' });
  try {
    const result = await provider.call({ to, message });
    res.json(result);
  } catch (e) {
    console.error('[call] lỗi:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.post('/sms', auth, async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ ok: false, error: 'thiếu to/message' });
  try {
    const result = await provider.sms({ to, message });
    res.json(result);
  } catch (e) {
    console.error('[sms] lỗi:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Chỉ tự chạy khi gọi trực tiếp (để test import được app).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AnToànBé server (provider=${provider.name}) đang chạy tại cổng ${PORT}`);
  });
}

module.exports = app;
