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

## Bluetooth xe thật (Android) — cần dev build

Phát hiện tự động khi bạn **xuống xe** dựa trên việc điện thoại **ngắt kết nối Bluetooth**
với head-unit của xe. Vì đây là native module (`react-native-bluetooth-classic`), app
**không chạy trong Expo Go** khi bật tính năng này — phải tạo **dev build**:

```bash
cd car-child-alert/app
npm install
npx expo prebuild                 # sinh thư mục android/ (và ios/)
npx expo run:android              # cài lên máy Android thật
```

Sau đó vào **Cài đặt → Xe**, nhập **tên/địa chỉ Bluetooth** của xe (vd "Car Multimedia"
hoặc `00:11:22:33:44:55`) để app biết thiết bị nào là xe.

- **Android:** nghe sự kiện kết nối/ngắt Bluetooth Classic (rảnh tay) của xe.
- **iOS:** hệ điều hành không cho app thấy kết nối/ngắt của loa xe thường (giới hạn MFi),
  nên iOS tự động dựa trên **tốc độ GPS** (đang lái → dừng hẳn). Vẫn dùng được nút mô phỏng.
- Nếu chạy trong Expo Go (không có module), phần Bluetooth **tự bỏ qua an toàn**, app vẫn
  chạy bình thường với GPS/activity + mô phỏng.

## Giới hạn hiện tại (Phase 1)

- Provider gọi/SMS mặc định là **mock**. Để gọi/SMS thật: dựng & deploy `../server/`
  (Twilio hoặc Stringee), rồi `contactService.configureBackend(...)` + `setProvider('backend')`.
- Bluetooth thật cần **dev build** + điện thoại Android + xe (xem mục trên).
- Chạy nền liên tục trên iOS bị hạn chế; bản production nên bổ sung foreground service
  (Android) và cân nhắc thiết bị phần cứng (xem DESIGN.md — Phase 3).
