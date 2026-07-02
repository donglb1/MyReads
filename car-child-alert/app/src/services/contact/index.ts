import { Child, Contact, GeoPoint } from '@/models';
import { mapsLink } from '@/services/location';
import { AlertProvider, CallResult } from './types';
import { MockProvider } from './mockProvider';
import { DeviceProvider } from './deviceProvider';
import { BackendProvider, BackendConfig } from './backendProvider';

export type ProviderKind = 'mock' | 'device' | 'backend';

/**
 * contactService — chọn provider và điều phối gọi/SMS.
 *
 * Ưu tiên: nếu đã cấu hình backend hợp lệ → dùng backend (gọi/SMS tự động).
 * Nếu không → dùng thiết bị (mở màn hình gọi / soạn SMS).
 * `mock` dùng khi chạy thử luồng cảnh báo mà không muốn gọi/nhắn thật.
 */
class ContactService {
  private mock = new MockProvider();
  private device = new DeviceProvider();
  private backend: BackendProvider | null = null;
  private active: ProviderKind = 'mock';

  /** Đặt cấu hình backend. Truyền baseUrl rỗng để tắt backend. */
  configureBackend(config?: BackendConfig): void {
    if (config?.baseUrl) {
      this.backend = new BackendProvider(config);
    } else {
      this.backend = null;
    }
  }

  setProvider(kind: ProviderKind): void {
    this.active = kind;
  }

  getProviderName(): string {
    return this.resolve().name;
  }

  private resolve(): AlertProvider {
    if (this.active === 'backend' && this.backend) return this.backend;
    if (this.active === 'device') return this.device;
    if (this.active === 'backend' && !this.backend) return this.device; // backend chưa sẵn → fallback
    return this.mock;
  }

  getMockLog(): string[] {
    return this.mock.getLog();
  }

  buildMessage(child: Child | undefined, location?: GeoPoint): string {
    const who = child?.name ? `bé ${child.name}` : 'trẻ nhỏ';
    const link = mapsLink(location);
    const base = `⚠️ CẢNH BÁO AnToànBé: Có thể ${who} đang bị bỏ quên trong xe! Vui lòng kiểm tra NGAY.`;
    return link ? `${base}\nVị trí xe: ${link}` : base;
  }

  async call(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult> {
    return this.resolve().call(contact, message, location);
  }

  async sms(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult> {
    return this.resolve().sms(contact, message, location);
  }
}

export const contactService = new ContactService();
export type { CallResult };
