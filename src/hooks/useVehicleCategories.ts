import { DEFAULT_CATEGORY_CODE, vehicleCategoriesApi } from '@/api';
import { useQuery } from './useQuery';

/** Active vehicle types (Private, Taxi, ...), plus the default one (Private). */
export function useVehicleCategories() {
  const query = useQuery(() => vehicleCategoriesApi.list(), [], { staleMs: 10 * 60_000 });
  const categories = query.data ?? [];
  const defaultCategory = categories.find((c) => c.code === DEFAULT_CATEGORY_CODE) ?? categories[0];
  return { ...query, categories, defaultCategory };
}
