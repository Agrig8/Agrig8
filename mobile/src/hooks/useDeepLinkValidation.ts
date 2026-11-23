import { useCallback, useState } from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import { parseDeepLink, type DeepLinkTarget } from '../constants/links';
import type { RootStackParamList } from '../types/navigation';

export type DeepLinkValidationState =
  | { status: 'idle' }
  | { status: 'valid'; target: DeepLinkTarget }
  | { status: 'invalid'; rawUrl: string };

/**
 * Deep-link validation hook (issue #62).
 *
 * Validates an incoming URL before navigation and exposes a recoverable
 * invalid-link state so the UI can show a user-facing error without crashing.
 *
 * Usage:
 *   const { validation, validateAndNavigate, dismissInvalidLink } = useDeepLinkValidation();
 *   if (validation.status === 'invalid') { <InvalidLinkBanner url={validation.rawUrl} onDismiss={dismissInvalidLink} /> }
 */
export function useDeepLinkValidation() {
  const [validation, setValidation] = useState<DeepLinkValidationState>({ status: 'idle' });

  const validateAndNavigate = useCallback(
    (
      rawUrl: string | null | undefined,
      navigation: NavigationContainerRef<RootStackParamList> | null | undefined,
      onValid?: (target: DeepLinkTarget) => void,
    ): boolean => {
      const target = parseDeepLink(rawUrl);
      if (!target) {
        setValidation({ status: 'invalid', rawUrl: rawUrl ?? '' });
        return false;
      }
      setValidation({ status: 'valid', target });
      if (onValid) {
        onValid(target);
      } else if (navigation) {
        navigation.navigate(target.screen as never, (target.params ?? {}) as never);
      }
      return true;
    },
    [],
  );

  const dismissInvalidLink = useCallback(() => {
    setValidation({ status: 'idle' });
  }, []);

  return { validation, validateAndNavigate, dismissInvalidLink };
}
