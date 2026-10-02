import type { Booking, Service, VehicleCategory } from '@/api';

// Separate taxi / private rates. The backend change is described in
// docs/backend-taxi-rates.md; until it ships, services come back without a
// `taxiPrice` key and everything falls back to the single (private) price.

type Priced = Pick<Service, 'price' | 'taxiPrice'>;

/** True once the server returns the taxiPrice field on services. */
export function supportsTaxiRates(services: Priced[] | undefined | null) {
  return !!services?.some((s) => s && 'taxiPrice' in s);
}

/** Rate for a vehicle category; taxis fall back to the private price when no taxi rate is set. */
export function rateFor(service: Priced, category: VehicleCategory) {
  if (category === 'TAXI' && service.taxiPrice !== null && service.taxiPrice !== undefined && service.taxiPrice !== '') {
    return service.taxiPrice;
  }
  return service.price;
}

export function hasDifferentTaxiRate(service: Priced) {
  return rateFor(service, 'TAXI') !== service.price && Number(rateFor(service, 'TAXI')) !== Number(service.price);
}

/** What a booking was charged: the server's recorded price if present, else the service's rate. */
export function bookingAmount(b: Pick<Booking, 'price' | 'vehicleCategory' | 'service'>) {
  if (b.price !== undefined && b.price !== null) return b.price;
  if (!b.service) return undefined;
  return rateFor(b.service, b.vehicleCategory === 'TAXI' ? 'TAXI' : 'PRIVATE');
}

/** Before backend support, taxi washes are flagged in the booking notes instead. */
export const TAXI_NOTE = 'Taxi';

export function isTaxiBooking(b: Pick<Booking, 'vehicleCategory' | 'notes'>) {
  if (b.vehicleCategory) return b.vehicleCategory === 'TAXI';
  return !!b.notes && new RegExp(`^${TAXI_NOTE}\\b`).test(b.notes);
}
