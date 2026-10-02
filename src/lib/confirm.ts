import { Alert, Platform } from 'react-native';

import { toast } from '@/components/Toast';

/** Cross-platform yes/no confirmation (Alert buttons are not supported on web). */
export function confirm(title: string, message: string, confirmText = 'Confirm', destructive = false) {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'No', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

const LOOKS_LIKE_ERROR = /could ?n[o'’]?t|can[’']?t|cannot|failed|error|unable|not allowed/i;

/** Error/info message as a toast (errors are recognised from the title, e.g. "Could not update job"). */
export function notify(title: string, message: string) {
  if (LOOKS_LIKE_ERROR.test(title)) toast.error(message, { title });
  else toast.info(message, { title });
}
