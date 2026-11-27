import { renderHook, act } from '@testing-library/react-native';
import { useDeepLinkValidation } from './useDeepLinkValidation';

describe('useDeepLinkValidation (issue #62)', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useDeepLinkValidation());
    expect(result.current.validation.status).toBe('idle');
  });

  it('sets invalid status for a malformed URL', () => {
    const { result } = renderHook(() => useDeepLinkValidation());
    act(() => {
      result.current.validateAndNavigate('amanavault://not-a-real-route', null);
    });
    expect(result.current.validation.status).toBe('invalid');
    if (result.current.validation.status === 'invalid') {
      expect(result.current.validation.rawUrl).toBe('amanavault://not-a-real-route');
    }
  });

  it('sets valid status and calls onValid for a known route', () => {
    const { result } = renderHook(() => useDeepLinkValidation());
    const onValid = jest.fn();
    act(() => {
      result.current.validateAndNavigate('amanavault://trades/abc123', null, onValid);
    });
    expect(result.current.validation.status).toBe('valid');
    expect(onValid).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'TradeDetail', params: { tradeId: 'abc123' } }),
    );
  });

  it('dismissInvalidLink resets state to idle', () => {
    const { result } = renderHook(() => useDeepLinkValidation());
    act(() => {
      result.current.validateAndNavigate('bad-url', null);
    });
    expect(result.current.validation.status).toBe('invalid');
    act(() => {
      result.current.dismissInvalidLink();
    });
    expect(result.current.validation.status).toBe('idle');
  });

  it('returns false for invalid URLs and true for valid ones', () => {
    const { result } = renderHook(() => useDeepLinkValidation());
    let valid: boolean;
    act(() => {
      valid = result.current.validateAndNavigate(null, null);
    });
    expect(valid!).toBe(false);
    act(() => {
      valid = result.current.validateAndNavigate('amanavault://trades', null, () => {});
    });
    expect(valid!).toBe(true);
  });
});
