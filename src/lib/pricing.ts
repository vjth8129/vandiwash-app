import { DEFAULT_CATEGORY_CODE, type Booking, type BookingItem, type Service, type VehicleCategory } from '@/api';

type Priced = Pick<Service, 'price' | 'rates'>;

/** A service's rate for a vehicle type: its own rate for that type, else the base price. */
export function rateFor(service: Priced, categoryId: string | null | undefined) {
  const rate = categoryId ? service.rates?.find((r) => r.categoryId === categoryId) : undefined;
  return rate ? rate.price : service.price;
}

/** True when this vehicle type is charged something other than the base price. */
export function hasOwnRate(service: Priced, categoryId: string) {
  return Number(rateFor(service, categoryId)) !== Number(service.price);
}

/** The services in a booking; bookings made before multi-service have just their one service. */
export function bookingItems(b: Pick<Booking, 'items' | 'service' | 'serviceId' | 'price'>): BookingItem[] {
  if (b.items?.length) return b.items;
  if (!b.service) return [];
  return [
    {
      id: b.serviceId,
      serviceId: b.serviceId,
      name: b.service.name,
      price: b.price ?? b.service.price,
      durationMinutes: b.service.durationMinutes ?? 0,
    },
  ];
}

/** "Basic Wash + Polish". */
export const serviceNames = (b: Pick<Booking, 'items' | 'service' | 'serviceId' | 'price'>) =>
  bookingItems(b).map((i) => i.name).join(' + ') || 'Service';

/** What a booking was charged: its recorded total, else the sum of its services. */
export function bookingAmount(b: Pick<Booking, 'price' | 'items' | 'service' | 'serviceId'>) {
  if (b.price !== undefined && b.price !== null) return b.price;
  const items = bookingItems(b);
  return items.length ? items.reduce((sum, i) => sum + Number(i.price), 0) : undefined;
}

/** The vehicle type a booking was charged as. */
export function bookingCategory(b: Pick<Booking, 'category' | 'vehicleCategory'>) {
  if (b.category) return b.category;
  return b.vehicleCategory === 'TAXI'
    ? { id: '', code: 'TAXI', name: 'Taxi' }
    : { id: '', code: DEFAULT_CATEGORY_CODE, name: 'Private' };
}

export const isDefaultCategory = (c: Pick<VehicleCategory, 'code'>) => c.code === DEFAULT_CATEGORY_CODE;
