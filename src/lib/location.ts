import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type PickedLocation = {
  latitude: number;
  longitude: number;
  /** Best-effort address for the coordinates (not available on web). */
  address?: { line: string; city: string; state: string; postalCode: string; country: string };
};

export class LocationError extends Error {}

/**
 * Asks for location permission and reads where the phone is now, plus the address there
 * when the platform can look it up. Throws LocationError with a message to show the user.
 */
export async function getCurrentLocation(): Promise<PickedLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new LocationError(
      permission.canAskAgain
        ? 'Allow location access so we can pin your car wash on the map.'
        : 'Location access is turned off for Vahanly. Turn it on in your phone settings, then try again.',
    );
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new LocationError('Turn on location (GPS) on your phone, then try again.');
  }

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    throw new LocationError('Couldn’t get your location. Step outside or near a window and try again.');
  }
  const { latitude, longitude } = position.coords;

  // reverseGeocodeAsync isn't supported on web.
  if (Platform.OS === 'web') return { latitude, longitude };
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return { latitude, longitude };
    const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
    const line = [place.name !== street ? place.name : null, street, place.district].filter(Boolean).join(', ');
    return {
      latitude,
      longitude,
      address: {
        line,
        city: place.city ?? place.subregion ?? '',
        state: place.region ?? '',
        postalCode: place.postalCode ?? '',
        country: place.country ?? '',
      },
    };
  } catch {
    // The coordinates are what matter; the owner can type the address.
    return { latitude, longitude };
  }
}
