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
  /** Rate for private vehicles (the default rate). */
  price: string | number;
  /**
   * Rate for taxis. Requires the backend change in docs/backend-taxi-rates.md —
   * absent from responses until then; null means "same as price".
   */
  taxiPrice?: string | number | null;
  durationMinutes: number;
  status: ServiceStatus;
  sortOrder?: number;
};

export const VEHICLE_CATEGORIES = ['PRIVATE', 'TAXI'] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

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
  /** Private or taxi (backend change pending — see docs/backend-taxi-rates.md). */
  vehicleCategory?: VehicleCategory | null;
  /** Amount charged for this booking, if the backend records it. */
  price?: string | number | null;
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>;
  vehicle?: Pick<Vehicle, 'id' | 'registrationNumber'>;
  service?: { id: string; name: string; price: number | string; taxiPrice?: number | string | null; durationMinutes?: number };
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
  createdAt: string;
  updatedAt: string;
  booking?: Booking;
};

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
