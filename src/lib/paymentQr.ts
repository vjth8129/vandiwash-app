import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Big enough to scan from a phone held up to a customer, small enough to upload quickly. */
const MAX_SIDE = 1000;
/** Keep well under the API's limit (~750k base64 characters). */
const MAX_BASE64 = 600_000;

/**
 * Lets the owner pick a QR image (typically a screenshot from their UPI / bank app), crop it
 * to the code, and returns it as a resized JPEG data URI. Resolves null if they cancel.
 */
export async function pickQrImage(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];

  for (const [side, compress] of [
    [MAX_SIDE, 0.9],
    [800, 0.8],
    [600, 0.75],
  ] as const) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > side) {
      context.resize(asset.width >= asset.height ? { width: side } : { height: side });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (saved.base64 && saved.base64.length <= MAX_BASE64) return `data:image/jpeg;base64,${saved.base64}`;
  }
  throw new Error('That picture is too large. Try a screenshot of just the QR code.');
}
