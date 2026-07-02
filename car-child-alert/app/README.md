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
- **iOS:** hệ điều hành không cho app thấy kết nối/ngắt của loa xe thường (giới hạn MFi).
  Thay vào đó iOS dùng **`iosMotionDetector`** (Core Motion *automotive* + Visits) để phát
  hiện "vừa xuống xe" — **không cần CarPlay entitlement** — cộng **tốc độ GPS** và nút mô
  phỏng. Phần Core Motion/Visits cần **dev build + native module** (xem dưới); nếu không có,
  tự bỏ qua an toàn.

### iOS: Core Motion + Visits (thay cho CarPlay)

`src/services/iosMotionDetector.ts` phát hiện kết thúc chuyến bằng API iOS gốc:
- **Core Motion** (`CMMotionActivityManager`): `automotive → stationary/walking` = xuống xe.
- **Visits** (`startMonitoringVisits`): xác nhận "vừa đỗ tại một nơi".

Cần **dev build** và một **native module** cầu nối Core Motion/Visits sang JS (interface kỳ
vọng ghi trong đầu file `iosMotionDetector.ts`). Quyền: **Motion & Fitness** + **Location
(Always)** — đã khai báo trong `app.json` (`NSMotionUsageDescription`, background location).
Lưu ý: các tín hiệu này có **độ trễ** (Core Motion vài chục giây; Visits vài phút) nên dùng
kèm GPS + nút thủ công; đáng tin cậy nhất vẫn là phần cứng (Phase 3).
- Nếu chạy trong Expo Go (không có module), phần Bluetooth **tự bỏ qua an toàn**, app vẫn
  chạy bình thường với GPS/activity + mô phỏng.

## Phase 2 — Đồng bộ bố + mẹ & địa điểm an toàn

- **Cảnh báo cả bố + mẹ:** vào **Cài đặt → Gia đình**, nhập **cùng một mã gia đình** trên
  điện thoại của bố và mẹ. Khi một máy bắt đầu báo động, máy kia nhận **thông báo đẩy** ngay.
  (Cần đã cấu hình backend — xem phần dưới.)
- **Địa điểm an toàn:** vào **Cài đặt → Địa điểm an toàn**, đặt tên (Nhà/Trường) và lưu
  vị trí hiện tại. Cảnh báo/SMS sẽ ghi **tên nơi đỗ** thay vì chỉ toạ độ.
- **Học thói quen (giảm báo nhầm):** app ghi nhận nơi/giờ bạn hay kết thúc chuyến và cách
  bạn xử lý (xác nhận ngay hay để báo động). Nơi bạn **thường xuống xe an toàn** → app
  **nới dài** thời gian xác nhận (ít báo nhầm hơn); nơi từng **để leo thang** → **rút ngắn**
  để bảo vệ nhanh hơn. Có giới hạn min/max và **không bao giờ tắt chuông/gọi**. Bật/tắt ở
  **Cài đặt → Cảnh báo → Học thói quen**.

Đồng bộ đa thiết bị dùng **Expo push** qua backend (`../server/`: `/register`,
`/notify-family`). Push token lấy tự động khi có mã gia đình + backend đã cấu hình.

## Phase 3 (bắt đầu) — dùng dữ liệu sẵn có của xe

Không thêm cảm biến mới; đọc trạng thái xe qua **OBD-II dongle Bluetooth (ELM327)**:
- `src/services/obdReader.ts` — đọc trạng thái **máy** (nổ/tắt) và **cửa** qua BLE (cần dev
  build + `react-native-ble-plx`); **no-op an toàn trong Expo Go** và có hàm **mô phỏng**.
- `src/services/rearSeatReminder.ts` — logic **"nhắc ghế sau"** thuần: nếu **cửa sau mở** lúc
  lên xe và **tắt máy chưa mở lại** → nghi **còn bé ở ghế sau** → app **không nới dài** thời
  gian xác nhận và hiện cảnh báo **"KIỂM TRA GHẾ SAU"**.

- `src/services/presenceModel.ts` — **hợp nhất nhiều tín hiệu** để tăng chính xác: cảm biến
  chiếm chỗ ghế sau (nếu xe có, đáng tin nhất), **đai an toàn ghế sau**, logic cửa, và hồ sơ
  bé trên chuyến → điểm khả năng có bé (low/medium/high). **Nhiệt độ cabin** rút ngắn thời
  gian xác nhận khi nóng. Chỉ hạ mức khi cảm biến ghế sau báo TRỐNG; còn lại thiên về cảnh báo.

**Thử không cần dongle:** ở **Trang chủ → OBD (thử nghiệm)** bấm lần lượt *Nổ máy → Mở cửa
sau → (Cài đai / Nhiệt độ 40°C) → Tắt máy*; màn hình cảnh báo hiện mức nghi ngờ + lý do.

Còn lại (cần tài nguyên thật): hoàn thiện parse CAN theo hãng trong `obdReader` (cần dongle),
và/hoặc tích hợp **API xe kết nối** (Smartcar/API hãng) ở server để đọc cửa/nhiệt độ cabin.

## ✅ Việc cần làm để Phase 1 chạy thật (bạn thực hiện)

Phần code đã xong; các việc dưới đây cần tài nguyên/thiết bị của bạn:

- [ ] **Cuộc gọi/SMS thật**
  - [ ] Tạo tài khoản **Twilio** hoặc **Stringee**, lấy khoá + số gửi đi.
  - [ ] Điền vào `../server/.env` (theo `.env.example`), đặt `PROVIDER=twilio|stringee`.
  - [ ] **Deploy** `../server/` (Render / Railway / Fly / Cloud Run...), lấy URL công khai.
  - [ ] Trong `src/state/store.tsx`: `contactService.configureBackend({ baseUrl, apiKey })`
        và `contactService.setProvider('backend')`.
- [ ] **Bluetooth xe thật (Android)**
  - [ ] `npx expo prebuild && npx expo run:android` để tạo **dev build** (không dùng Expo Go).
  - [ ] Ghép đôi điện thoại với Bluetooth xe, rồi vào **Cài đặt → Xe** nhập tên/địa chỉ BT.
  - [ ] Thử một chuyến thật: lên xe (kết nối BT) → xuống xe (ngắt BT) để kiểm tra cảnh báo.
- [ ] **Kiểm thử trên thiết bị thật**
  - [ ] Chạy thử luồng cảnh báo end-to-end với số điện thoại thật (chỉnh T1/T2/T3 ngắn khi test).
  - [ ] Kiểm tra hoạt động khi app chạy nền / màn hình khoá.

## Giới hạn hiện tại (Phase 1)

- Provider gọi/SMS mặc định là **mock**. Để gọi/SMS thật: dựng & deploy `../server/`
  (Twilio hoặc Stringee), rồi `contactService.configureBackend(...)` + `setProvider('backend')`.
- Bluetooth thật cần **dev build** + điện thoại Android + xe (xem mục trên).
- Chạy nền liên tục trên iOS bị hạn chế; bản production nên bổ sung foreground service
  (Android) và cân nhắc thiết bị phần cứng (xem DESIGN.md — Phase 3).
