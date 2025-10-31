import { Platform, Pressable } from 'react-native';
import { Text } from '@/components/nativewindui/Text';
import { cn } from '@/lib/cn';

type SkipLinkProps = {
  href: string;
  label?: string;
  className?: string;
};

export function SkipLink({ href, label = 'Skip to main content', className }: SkipLinkProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const handlePress = () => {
    if (typeof document === 'undefined') {
      return;
    }
    // Extract the target ID from the href (e.g., "#main-content" -> "main-content")
    const targetId = href.startsWith('#') ? href.slice(1) : href;
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      // Focus the target element for keyboard users and scroll it into view
      // Make focusable if needed (for divs without native focus support)
      if (!targetElement.hasAttribute('tabindex')) {
        targetElement.setAttribute('tabindex', '-1');
      }
      targetElement.focus();
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        'skip-link focus:top-0',
        'absolute -top-10 left-0 z-[100] rounded-md bg-primary px-4 py-2',
        'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        className
      )}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text className="font-semibold text-primary-foreground">{label}</Text>
    </Pressable>
  );
}
