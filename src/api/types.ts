// Shapes returned by the Car Wash Management API (/api/v1).

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  pagination?: Pagination;
};

export type Paged<T> = {
  items: T[];
  pagination?: Pagination;
};

/** How a person identifies their account when signing in or resetting a password. */
export type AccountIdentifier = { phone: string } | { username: string };

/** The QR (e.g. UPI) staff show customers to pay; one per car wash. */
export type PaymentQr = {
  /** data:image/...;base64,... */
  image: string;
  /** Shown under the QR, e.g. the UPI ID. */
  note: string | null;
  updatedAt: string;
};

export type LoginUser = {
  id: string;
  username: string;
  phone: string | null;
  name: string;
  role: string;
  carWashId: string | null;
  /** An admin set this password; the user must change it before doing anything else. */
  mustChangePassword?: boolean;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: LoginUser;
};

/** A car wash owner signing up from the app; the car wash starts out pending review. */
export type SignupInput = {
  name: string;
  description?: string;
  /** Business phone. */
  phone?: string;
  email?: string;
  gstNumber: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  owner: { name: string; phone: string; email?: string; password: string };
};

export type SignupResult = {
  carWash: { id: string; name: string; code: string; status: 'PENDING' };
  owner: { name: string; phone: string };
  message: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type Me = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: { id: string; name: string };
  permissions: string[];
  carWash: { id: string; name: string } | null;
  mustChangePassword?: boolean;
};

export type AppConfig = {
  appName: string;
  currency: string;
  timezone: string;
  environment: string;
  features: Record<string, boolean>;
};

export type ServiceStatus = 'ACTIVE' | 'INACTIVE';

export type Service = {
  id: string;
  name: string;
  description: string | null;
  /** Base rate: charged for every vehicle type that has no rate of its own (e.g. Private). */
  price: string | number;
  /** Legacy mirror of the Taxi rate (older app builds); use `rates`. */
  taxiPrice?: string | number | null;
  /** Rate per vehicle type; types not listed are charged `price`. */
  rates?: ServiceRate[];
  durationMinutes: number;
  status: ServiceStatus;
  sortOrder?: number;
};

export type ServiceRate = { categoryId: string; price: string | number };

/** How a vehicle is used (Private, Taxi, ...) — decides the rate. Managed in the admin portal. */
export type VehicleCategory = {
  id: string;
  /** Stable key, e.g. PRIVATE / TAXI. PRIVATE is the default. */
  code: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
};

export const DEFAULT_CATEGORY_CODE = 'PRIVATE';

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
};

export const VEHICLE_TYPES = [
  'SEDAN',
  'SUV',
  'HATCHBACK',
  'TRUCK',
  'VAN',
  'MOTORCYCLE',
  'OTHER',
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export type Vehicle = {
  id: string;
  customerId: string;
  registrationNumber: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  color: string | null;
  year: number | null;
  vehicleType: VehicleType | null;
  /** The vehicle type it was last washed as; pre-selected on the next wash. */
  categoryId?: string | null;
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
};

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type Booking = {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes: string | null;
  /** Legacy PRIVATE/TAXI flag; `category` is the source of truth. */
  vehicleCategory?: 'PRIVATE' | 'TAXI' | null;
  categoryId?: string | null;
  category?: Pick<VehicleCategory, 'id' | 'code' | 'name'> | null;
  /** Total charged: the sum of `items`. */
  price?: string | number | null;
  /** The services in this wash, with the price charged for each. */
  items?: BookingItem[];
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
  /** Body type and model aren't sent yet; the reports use them once the API includes them. */
  vehicle?: Pick<Vehicle, 'id' | 'registrationNumber'> & Partial<Pick<Vehicle, 'vehicleType' | 'brand' | 'model'>>;
  service?: { id: string; name: string; price: number | string; taxiPrice?: number | string | null; durationMinutes?: number };
};

export type BookingItem = {
  id: string;
  serviceId: string;
  name: string;
  price: string | number;
  durationMinutes: number;
};

/** CREATED is shown as "Waiting". */
export type OrderStatus =
  | 'CREATED'
  | 'WASHING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type Order = {
  id: string;
  bookingId: string;
  status: OrderStatus;
  /** Only on orders from before the "checked in" step was removed. */
  checkedInAt: string | null;
  washStartedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  totalAmount: string | number | null;
  /** When staff noted the customer paid. */
  paidAt?: string | null;
  paymentMethod?: PaymentMethod | null;
  createdAt: string;
  updatedAt: string;
  booking?: Booking;
};

export type PaymentMethod = 'UPI' | 'CASH';

export type Permission = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  module?: string;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  carWashId: string | null;
  isSystem: boolean;
  /** A built-in role whose permissions this car wash has changed from the defaults. */
  isCustomized?: boolean;
  permissions: Pick<Permission, 'id' | 'key' | 'name'>[];
};

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type User = {
  id: string;
  roleId: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  role?: { id: string; name: string };
};

// ---- Sales report (GET /reports/sales) ----------------------------------------

export type SalesBucket = 'hour' | 'day' | 'week' | 'month';

export type SalesTotals = {
  revenue: number;
  washes: number;
  average: number;
  customers: number;
  /** Revenue with a payment noted, and what's still owed. */
  collected: number;
  unpaid: number;
  unpaidWashes: number;
};

/** One bucket or slice: `key` is a date/hour/id, `label` is display text. */
export type SalesRow = { key: string; label: string; washes: number; revenue: number };

export type SalesTransaction = {
  id: string;
  completedAt: string;
  amount: number;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  registrationNumber: string;
  vehicleType: VehicleType;
  category: { id: string; code: string; name: string } | null;
  customer: { id: string; name: string; phone: string | null };
  services: { serviceId: string; name: string; price: number }[];
};

export type SalesReport = {
  range: { from: string; to: string; days: number };
  timezone: string;
  groupBy: SalesBucket;
  totals: SalesTotals;
  /** The period just before, cut at the same point when the range runs up to now. */
  previous: SalesTotals & { from: string; to: string };
  /** Oldest first, with empty buckets filled in. */
  series: SalesRow[];
  byHour: SalesRow[];
  byService: SalesRow[];
  byCategory: SalesRow[];
  byVehicleType: SalesRow[];
  /** Keys UPI, CASH, NONE (not paid). */
  byPayment: SalesRow[];
  transactions: SalesTransaction[];
  options: { services: { id: string; name: string }[]; categories: { id: string; code: string; name: string }[] };
};

export type SalesQuery = {
  from: string;
  to: string;
  groupBy?: SalesBucket;
  serviceId?: string | null;
  categoryId?: string | null;
  vehicleType?: VehicleType | null;
  paymentStatus?: 'PAID' | 'UNPAID' | null;
  limit?: number;
};

// ---- Promotions ----------------------------------------------------------------

/** SCHEDULED → SENDING → SENT (or FAILED when nothing went out); CANCELLED only before sending. */
export type PromotionStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type PromotionChannel = 'WHATSAPP' | 'SMS';
export type RecipientStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export type Promotion = {
  id: string;
  title: string;
  /** {name} is replaced with each customer's first name. */
  message: string;
  channel: PromotionChannel;
  status: PromotionStatus;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  audienceLabel: string | null;
  audience: Record<string, unknown> | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  /** "console" = the server only logged the messages (no SMS/WhatsApp provider connected). */
  deliveryMode: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
};

export type PromotionRecipient = {
  id: string;
  customerId: string | null;
  name: string;
  phone: string | null;
  status: RecipientStatus;
  sentAt: string | null;
  error: string | null;
};

export type PromotionDetail = Promotion & { recipients: PromotionRecipient[] };

export type NewPromotion = {
  title: string;
  message: string;
  channel: PromotionChannel;
  customerIds: string[];
  /** ISO time; left out sends it now. */
  sendAt?: string | null;
  audienceLabel?: string;
  audience?: Record<string, unknown>;
};

/** A customer behind a slice of sales (GET /reports/customers). */
export type AudienceCustomer = {
  id: string;
  name: string;
  phone: string | null;
  visits: number;
  spent: number;
  firstVisit: string;
  lastVisit: string;
  returned: boolean;
  vehicles: { registrationNumber: string; vehicleType: VehicleType; category: string | null }[];
  services: string[];
};

export type AudienceQuery = Omit<SalesQuery, 'groupBy' | 'limit'> & { minVisits?: number; notReturned?: boolean };

/** A short-lived download link for the sales report; `path` is relative to the API base URL. */
export type SalesExportLink = { path: string; filename: string; expiresAt: string };
export type SalesExportFormat = 'pdf' | 'xlsx';
