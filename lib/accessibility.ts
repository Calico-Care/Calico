import { Platform } from 'react-native';

/**
 * Announce a message to screen readers
 * @param message - The message to announce
 * @param level - The priority level (polite or assertive)
 */
export function announceToScreenReader(message: string, level: 'polite' | 'assertive' = 'polite') {
  if (Platform.OS !== 'web') {
    return;
  }

  const liveRegion = document.getElementById('screen-reader-announcements');
  if (liveRegion) {
    liveRegion.setAttribute('aria-live', level);
    liveRegion.textContent = message;
    // Clear after announcement to allow re-announcement
    setTimeout(() => {
      liveRegion.textContent = '';
    }, 1000);
  }
}

/**
 * Focus an element by ID
 * @param id - The ID of the element to focus
 */
export function focusElement(id: string) {
  if (Platform.OS !== 'web') {
    return;
  }

  const element = document.getElementById(id);
  if (element) {
    element.focus();
  }
}

/**
 * Get a descriptive label for an icon
 * @param iconName - The name of the icon
 * @param context - Optional context for the icon usage
 */
export function getIconLabel(iconName: string, context?: string): string {
  const iconLabels: Record<string, string> = {
    'shield-check': 'Secure',
    'heart-pulse': 'Health monitoring',
    'account-group': 'Care team',
    stethoscope: 'Clinician',
    'account-heart-outline': 'Patient',
    'bell-badge': 'Alert',
    'phone-alert': 'Escalation',
    'alert-circle': 'Alert',
    'check-circle': 'Resolved',
    gearshape: 'Settings',
  };

  const baseLabel = iconLabels[iconName] || iconName;
  return context ? `${baseLabel} ${context}` : baseLabel;
}
