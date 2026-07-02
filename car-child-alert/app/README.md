# AnToànBé — App cảnh báo quên trẻ trên ô tô (Phase 1 prototype)

Ứng dụng di động (Expo / React Native, chạy cả **iOS & Android**) giúp cảnh báo khi
có nguy cơ bỏ quên trẻ nhỏ trên ô tô. Khi kết thúc chuyến đi mà bố/mẹ không xác nhận đã
đưa bé ra, app sẽ **báo động → gọi & nhắn tin cho người thân kèm vị trí xe**.

> Xem tài liệu thiết kế đầy đủ ở [`../DESIGN.md`](../DESIGN.md).

## Chạy thử

```bash
cd car-child-alert/app
npm install
npm start          # rồi mở bằng Expo Go (quét QR) hoặc:
npm run android    # / npm run ios
```

Yêu cầu: Node 18+, [Expo CLI](https://docs.expo.dev/) (đi kèm khi `npm install`),
và app **Expo Go** trên điện thoại (hoặc simulator/emulator).

## Cách test luồng cảnh báo (không cần thiết bị thật)

1. Mở app → qua bước Onboarding (cấp quyền thông báo/vị trí).
2. Tab **Cài đặt**: thêm 1 **bé**. Có thể chỉnh T1/T2/T3 xuống ~5–10s cho nhanh.
3. Tab **Liên hệ**: thêm ít nhất 1 số điện thoại khẩn cấp.
4. Tab **Trang chủ**: bấm **“Bắt đầu chở bé”** → rồi **“Mô phỏng: quên bé trên xe”**.
5. Màn hình cảnh báo hiện ra, đếm ngược → nếu không bấm **“TÔI ĐÃ ĐƯA BÉ RA”** sẽ
   leo thang: báo động (chuông/rung) → gọi/SMS người thân → khẩn cấp.

Ở chế độ mặc định, việc gọi/SMS dùng **provider `mock`** (chỉ ghi log ra console, không
gọi/nhắn thật) để test an toàn.

## Cấu trúc

```
app/
├─ App.tsx                     Điều hướng (tab) + overlay cảnh báo
├─ src/
│  ├─ models/                  Kiểu dữ liệu (Child, Vehicle, Contact, Trip, AlertEvent, Settings)
│  ├─ state/store.tsx          Store trung tâm (dữ liệu + runtime + nối engine/detector)
│  ├─ services/
│  │  ├─ alertEngine.ts        Máy trạng thái leo thang cảnh báo (T1→T2→T3)
│  │  ├─ tripDetector.ts       Phát hiện bắt đầu/kết thúc chuyến (thủ công/activity/BT/mô phỏng)
│  │  ├─ notifier.ts           Chuông + rung + thông báo đẩy
│  │  ├─ location.ts           Vị trí GPS + link Google Maps
│  │  ├─ storage.ts            Lưu trữ cục bộ (AsyncStorage)
│  │  └─ contact/              Gọi & SMS qua provider cắm-được
│  │     ├─ types.ts           Interface AlertProvider
│  │     ├─ mockProvider.ts    Giả lập (chạy thử)
│  │     ├─ deviceProvider.ts  Mở màn hình gọi tel: / SMS trên máy (fallback)
│  │     ├─ backendProvider.ts Gọi/SMS tự động qua backend (Twilio/Stringee)
│  │     └─ index.ts           Điều phối & chọn provider
│  ├─ screens/                 Onboarding, Home, Contacts, Settings, History, AlertOverlay
│  └─ components/ui.tsx        Thành phần UI dùng chung
```

## Gọi & SMS tự động qua backend (Twilio / Stringee)

⚠️ **KHÔNG** đặt khoá bí mật Twilio/Stringee trong app di động — sẽ bị lộ. Hãy dựng một
backend nhỏ giữ khoá, app chỉ gọi tới đó. Backend cần 2 route:

```
POST {baseUrl}/call  body: { to, name, message, location }
POST {baseUrl}/sms   body: { to, name, message, location }
```

Rồi cấu hình trong `src/state/store.tsx` (chỗ nạp dữ liệu ban đầu):

```ts
contactService.configureBackend({ baseUrl: 'https://your-server/api/alert', apiKey: '...' });
contactService.setProvider('backend'); // thay cho 'mock'
```

Xem `src/services/contact/backendProvider.ts` để biết chi tiết interface.

## Giới hạn hiện tại (Phase 1)

- Provider gọi/SMS mặc định là **mock**; backend thật cần bạn tự dựng & cấu hình khoá.
- **Bluetooth xe**: đã có khung (`tripDetector.onBluetoothDisconnected()`) nhưng phát hiện
  BLE cần thư viện native ngoài Expo Go; hiện tự động phát hiện dựa trên **tốc độ GPS**
  (đang lái → dừng hẳn) và **nút mô phỏng**.
- Chạy nền liên tục trên iOS bị hạn chế; bản production nên bổ sung foreground service
  (Android) và cân nhắc thiết bị phần cứng (xem DESIGN.md — Phase 3).
