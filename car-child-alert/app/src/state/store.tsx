import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  AppData,
  AlertEvent,
  AlertLevel,
  Child,
  Contact,
  GeoPoint,
  Settings,
  Trip,
  TripEndReason,
  Vehicle,
  emptyData,
} from '@/models';
import { loadData, saveData, newId } from '@/services/storage';
import { AlertEngine, EngineState } from '@/services/alertEngine';
import { tripDetector } from '@/services/tripDetector';
import { contactService } from '@/services/contact';
import { getCurrentLocation } from '@/services/location';
import {
  startAlarm as fireAlarm,
  stopAlarm as silenceAlarm,
  pushLocalNotification,
} from '@/services/notifier';

interface StoreValue {
  data: AppData;
  ready: boolean;
  engineState: EngineState;
  activeTrip: Trip | null;
  // Hồ sơ
  addChild: (c: Omit<Child, 'id'>) => void;
  removeChild: (id: string) => void;
  addVehicle: (v: Omit<Vehicle, 'id'>) => void;
  removeVehicle: (id: string) => void;
  addContact: (c: Omit<Contact, 'id'>) => void;
  updateContact: (c: Contact) => void;
  removeContact: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  setOnboarded: (v: boolean) => void;
  // Chuyến & cảnh báo
  startTrip: () => void;
  endTripManually: () => void;
  simulateTripEnd: () => void;
  acknowledge: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  // Dùng ref để hooks của engine luôn thấy dữ liệu mới nhất mà không tạo lại engine.
  const dataRef = useRef(data);
  dataRef.current = data;
  // activeTripRef được cập nhật ĐỒNG BỘ trong listener (không chờ re-render),
  // để chuỗi start→end đồng bộ (vd nút mô phỏng) vẫn kích hoạt được engine.
  const activeTripRef = useRef<Trip | null>(null);

  const setTrip = useCallback((t: Trip | null) => {
    activeTripRef.current = t;
    setActiveTrip(t);
  }, []);

  const engineRef = useRef<AlertEngine | null>(null);

  const persist = useCallback((updater: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  const recordAlert = useCallback(
    (level: AlertLevel, location?: GeoPoint) => {
      const trip = activeTripRef.current;
      if (!trip) return;
      const event: AlertEvent = {
        id: newId(),
        tripId: trip.id,
        level,
        firedAt: Date.now(),
        location,
      };
      persist((d) => ({ ...d, alerts: [event, ...d.alerts] }));
    },
    [persist],
  );

  // Khởi tạo engine một lần.
  if (!engineRef.current) {
    engineRef.current = new AlertEngine(
      {
        onState: (s) => setEngineState(s),
        startAlarm: () => {
          fireAlarm(dataRef.current.settings.alarmSound);
          pushLocalNotification(
            'CẢNH BÁO: kiểm tra trẻ trong xe!',
            'Chưa xác nhận đã đưa bé ra khỏi xe. Nhấn để mở app.',
          );
        },
        stopAlarm: () => silenceAlarm(),
        call: async (contact, location) => {
          const msg = contactService.buildMessage(dataRef.current.children[0], location);
          const r = await contactService.call(contact, msg, location);
          return r.ok;
        },
        sms: async (contact, location) => {
          const msg = contactService.buildMessage(dataRef.current.children[0], location);
          const r = await contactService.sms(contact, msg, location);
          return r.ok;
        },
        getLocation: () => getCurrentLocation(),
        onAlertEvent: (level, location) => recordAlert(level, location),
      },
      emptyData.settings,
    );
  }
  const engine = engineRef.current;

  // Nạp dữ liệu ban đầu.
  useEffect(() => {
    (async () => {
      const loaded = await loadData();
      setData(loaded);
      engine.updateSettings(loaded.settings);
      // Prototype mặc định dùng provider mock (không gọi/nhắn thật).
      // Cấu hình backend thật ở đây: contactService.configureBackend({ baseUrl, apiKey }).
      contactService.setProvider('mock');
      setReady(true);
    })();
  }, [engine]);

  // Đồng bộ settings sang engine khi đổi.
  useEffect(() => {
    engine.updateSettings(data.settings);
  }, [data.settings, engine]);

  // Bật/tắt tự động phát hiện kết thúc chuyến theo cài đặt.
  useEffect(() => {
    if (!ready) return;
    if (data.settings.autoDetect) {
      tripDetector.enableAutoDetect();
    } else {
      tripDetector.disableAutoDetect();
    }
  }, [ready, data.settings.autoDetect]);

  const beginConfirm = useCallback(
    (reason: TripEndReason) => {
      const trip = activeTripRef.current;
      if (!trip) return;
      // Đóng thời điểm kết thúc chuyến.
      persist((d) => ({
        ...d,
        trips: d.trips.map((t) =>
          t.id === trip.id ? { ...t, endedAt: Date.now(), endReason: reason } : t,
        ),
      }));
      engine.armConfirm(dataRef.current.contacts);
    },
    [engine, persist],
  );

  // Lắng nghe sự kiện từ tripDetector.
  useEffect(() => {
    const unsub = tripDetector.subscribe((e) => {
      if (e.type === 'start') {
        const trip: Trip = {
          id: newId(),
          childId: dataRef.current.children[0]?.id,
          vehicleId: dataRef.current.vehicles[0]?.id,
          startedAt: Date.now(),
        };
        setTrip(trip);
        persist((d) => ({ ...d, trips: [trip, ...d.trips] }));
      } else if (e.type === 'end') {
        beginConfirm(e.reason);
      }
    });
    return unsub;
  }, [beginConfirm, persist, setTrip]);

  const startTrip = useCallback(() => tripDetector.startManual(), []);
  const endTripManually = useCallback(() => tripDetector.endManual(), []);
  const simulateTripEnd = useCallback(() => {
    if (!tripDetector.isTripActive()) tripDetector.startManual();
    tripDetector.endManual();
  }, []);

  const acknowledge = useCallback(() => {
    engine.acknowledge();
    setTrip(null);
  }, [engine, setTrip]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      ready,
      engineState,
      activeTrip,
      addChild: (c) => persist((d) => ({ ...d, children: [...d.children, { ...c, id: newId() }] })),
      removeChild: (id) =>
        persist((d) => ({ ...d, children: d.children.filter((x) => x.id !== id) })),
      addVehicle: (v) =>
        persist((d) => ({ ...d, vehicles: [...d.vehicles, { ...v, id: newId() }] })),
      removeVehicle: (id) =>
        persist((d) => ({ ...d, vehicles: d.vehicles.filter((x) => x.id !== id) })),
      addContact: (c) =>
        persist((d) => ({ ...d, contacts: [...d.contacts, { ...c, id: newId() }] })),
      updateContact: (c) =>
        persist((d) => ({ ...d, contacts: d.contacts.map((x) => (x.id === c.id ? c : x)) })),
      removeContact: (id) =>
        persist((d) => ({ ...d, contacts: d.contacts.filter((x) => x.id !== id) })),
      updateSettings: (s) => persist((d) => ({ ...d, settings: { ...d.settings, ...s } })),
      setOnboarded: (v) => persist((d) => ({ ...d, onboarded: v })),
      startTrip,
      endTripManually,
      simulateTripEnd,
      acknowledge,
    }),
    [
      data,
      ready,
      engineState,
      activeTrip,
      persist,
      startTrip,
      endTripManually,
      simulateTripEnd,
      acknowledge,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore phải nằm trong <StoreProvider>');
  return ctx;
}
