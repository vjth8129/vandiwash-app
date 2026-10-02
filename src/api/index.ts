import { http } from './client';
import type {
  AccountIdentifier,
  AppConfig,
  Booking,
  BookingStatus,
  Customer,
  LoginResult,
  Me,
  Order,
  PaymentQr,
  OrderStatus,
  Permission,
  Role,
  Service,
  ServiceStatus,
  TokenPair,
  User,
  UserStatus,
  Vehicle,
  VehicleCategory,
  VehicleType,
} from './types';

export * from './types';
export { ApiError, errorMessage } from './client';

// Auth ------------------------------------------------------------------------
export const authApi = {
  login: (account: AccountIdentifier, password: string) =>
    http.post<LoginResult>('/auth/login', { ...account, password }, { auth: false }),
  refresh: (refreshToken: string) =>
    http.post<TokenPair>('/auth/refresh', { refreshToken }, { auth: false }),
  logout: (refreshToken: string) =>
    http.post<unknown>('/auth/logout', { refreshToken }, { auth: false }),
  me: () => http.get<Me>('/auth/me'),
  forgotPassword: (account: AccountIdentifier) =>
    http.post<unknown>('/auth/forgot-password', account, { auth: false }),
  /** Redeem the code from forgotPassword. */
  resetPassword: (account: AccountIdentifier, code: string, newPassword: string) =>
    http.post<unknown>('/auth/reset-password', { ...account, code, newPassword }, { auth: false }),
  /** Change your own password; returns a fresh token pair (other sessions are signed out). */
  changePassword: (currentPassword: string, newPassword: string) =>
    http.post<TokenPair & { message: string }>('/auth/change-password', { currentPassword, newPassword }),
};

// Payment QR (the signed-in user's own car wash) --------------------------------
export const paymentQrApi = {
  get: () => http.get<PaymentQr | null>('/app/payment-qr'),
  /** Owners (CAR_WASH_UPDATE) only. */
  set: (image: string, note?: string) => http.put<PaymentQr>('/app/payment-qr', { image, note }),
  remove: () => http.delete<unknown>('/app/payment-qr'),
};

// App -------------------------------------------------------------------------
export const appApi = {
  config: () => http.get<AppConfig>('/app/config'),
};

// Services --------------------------------------------------------------------
export type ServiceInput = {
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  /** Only send once the backend supports it (see lib/pricing.ts). */
  taxiPrice?: number | null;
  status?: ServiceStatus;
};

export const servicesApi = {
  list: (q: { page?: number; limit?: number; search?: string; status?: ServiceStatus } = {}) =>
    http.list<Service>('/services', q),
  get: (id: string) => http.get<Service>(`/services/${id}`),
  create: (body: ServiceInput) => http.post<Service>('/services', body),
  update: (id: string, body: Partial<ServiceInput>) => http.patch<Service>(`/services/${id}`, body),
  /** Permanent removal from listings. Use update({ status }) to deactivate/reactivate. */
  remove: (id: string) => http.delete<unknown>(`/services/${id}`),
};

// Customers -------------------------------------------------------------------
export type NewCustomer = { name: string; phone: string; email?: string; address?: string };

export const customersApi = {
  list: (q: { page?: number; limit?: number; search?: string } = {}) =>
    http.list<Customer>('/customers', q),
  get: (id: string) => http.get<Customer>(`/customers/${id}`),
  create: (body: NewCustomer) => http.post<Customer>('/customers', body),
};

// Vehicles --------------------------------------------------------------------
export type NewVehicle = {
  customerId: string;
  registrationNumber: string;
  brand?: string;
  model?: string;
  vehicleType?: VehicleType;
};

export const vehiclesApi = {
  list: (q: { customerId?: string; search?: string; page?: number; limit?: number } = {}) =>
    http.list<Vehicle>('/vehicles', q),
  get: (id: string) => http.get<Vehicle>(`/vehicles/${id}`),
  create: (body: NewVehicle) => http.post<Vehicle>('/vehicles', body),
};

// Bookings --------------------------------------------------------------------
export type NewBooking = {
  customerId: string;
  vehicleId: string;
  serviceId: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  notes?: string;
  /** Only send once the backend supports it (see lib/pricing.ts). */
  vehicleCategory?: VehicleCategory;
};

export const bookingsApi = {
  list: (q: {
    status?: BookingStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}) => http.list<Booking>('/bookings', q),
  get: (id: string) => http.get<Booking>(`/bookings/${id}`),
  create: (body: NewBooking) => http.post<Booking>('/bookings', body),
  cancel: (id: string) => http.post<Booking>(`/bookings/${id}/cancel`),
};

// Orders (jobs) ---------------------------------------------------------------
export const ordersApi = {
  list: (q: { status?: OrderStatus; page?: number; limit?: number } = {}) =>
    http.list<Order>('/orders', q),
  get: (id: string) => http.get<Order>(`/orders/${id}`),
  /** Check a booking in — creates the order/job and confirms the booking. */
  checkIn: (bookingId: string) => http.post<Order>('/orders', { bookingId }),
  setStatus: (id: string, status: Exclude<OrderStatus, 'CREATED'>) =>
    http.patch<Order>(`/orders/${id}`, { status }),
};

// Users (team) ----------------------------------------------------------------
export type NewUser = {
  username: string;
  password: string;
  name: string;
  roleId: string;
  email?: string;
  /** The number they sign in with. */
  phone: string;
};
export type UserUpdate = Partial<Pick<User, 'name' | 'email' | 'phone' | 'roleId'>>;

export const usersApi = {
  list: (q: { page?: number; limit?: number; search?: string; status?: UserStatus } = {}) =>
    http.list<User>('/users', q),
  get: (id: string) => http.get<User>(`/users/${id}`),
  create: (body: NewUser) => http.post<User>('/users', body),
  update: (id: string, body: UserUpdate) => http.patch<User>(`/users/${id}`, body),
  setStatus: (id: string, status: UserStatus) => http.patch<User>(`/users/${id}/status`, { status }),
  resetPassword: (id: string, newPassword: string) =>
    http.post<unknown>(`/users/${id}/reset-password`, { newPassword }),
  remove: (id: string) => http.delete<unknown>(`/users/${id}`),
};

// Roles & permissions ---------------------------------------------------------
export type RoleInput = { name: string; description?: string; permissionIds: string[] };

export const rolesApi = {
  list: () => http.list<Role>('/roles'),
  get: (id: string) => http.get<Role>(`/roles/${id}`),
  create: (body: RoleInput) => http.post<Role>('/roles', body),
  /** For built-in roles only permissionIds may change, and only for this car wash. */
  update: (id: string, body: Partial<RoleInput>) => http.patch<Role>(`/roles/${id}`, body),
  /** Put a built-in role back to its default permissions for this car wash. */
  reset: (id: string) => http.post<Role>(`/roles/${id}/reset`),
  remove: (id: string) => http.delete<unknown>(`/roles/${id}`),
};

export const permissionsApi = {
  list: () => http.list<Permission>('/permissions'),
};
