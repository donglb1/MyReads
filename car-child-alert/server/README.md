# AnToànBé — Backend gọi/SMS cảnh báo

Server nhỏ (Node/Express) nhận yêu cầu từ app và thực hiện **gọi điện + gửi SMS** qua
nhà cung cấp thật. Giữ khoá bí mật ở đây, app **không** chứa khoá.

Hỗ trợ 3 provider chung một interface `{ call, sms }`:
- `mock` — không gọi thật, chỉ log (mặc định, để chạy thử).
- `twilio` — gọi (đọc TwiML tiếng Việt) + SMS.
- `stringee` — gọi ra (callout + SCCO "talk"); SMS cần brandname được duyệt.

## Chạy

```bash
cd car-child-alert/server
cp .env.example .env      # rồi điền cấu hình
npm install
npm start                 # mặc định cổng 3000
npm test                  # smoke test với provider mock
```

## API

Tất cả yêu cầu cần header `Authorization: Bearer <API_KEY>` (nếu đặt `API_KEY`).

```
GET  /health           -> { ok, provider }
POST /call  { to, message, name?, location? }  -> { ok, id }
POST /sms   { to, message, name?, location? }  -> { ok, id }
```

`to` là số điện thoại (E.164, vd `+8490xxxxxxx`). `message` là nội dung cảnh báo.

## Chọn provider

Đặt biến môi trường `PROVIDER=mock|twilio|stringee` trong `.env`.

- **Twilio:** cần `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- **Stringee:** cần `STRINGEE_API_SID`, `STRINGEE_API_SECRET`, `STRINGEE_FROM_NUMBER`;
  bật `STRINGEE_SMS_ENABLED=true` khi đã có brandname SMS.

## Deploy

Deploy lên Render / Railway / Fly / Cloud Run... rồi lấy URL công khai, ví dụ
`https://antoanbe.onrender.com`. Trong app, cấu hình:

```ts
// src/state/store.tsx (chỗ nạp dữ liệu ban đầu)
contactService.configureBackend({
  baseUrl: 'https://antoanbe.onrender.com',
  apiKey: '<API_KEY trùng với server>',
});
contactService.setProvider('backend');
```

## Lưu ý pháp lý & chi phí

- Gọi/SMS tự động phát sinh cước theo nhà cung cấp.
- Ở Việt Nam, gọi/nhắn nội địa nên ưu tiên **Stringee**; SMS brandname cần đăng ký.
- Tôn trọng quy định về gọi tự động; chỉ dùng cho mục đích an toàn của chính người dùng.
