import { renderHook, act } from '@testing-library/react-native';
import { useDeepLink, __clearPendingDeepLink } from './useDeepLink';
import * as authStore from '../stores/authStore';

jest.mock('../stores/authStore', () => ({ useAuthStore: jest.fn() }));

const setAuth = (token: string | null) =>
  (authStore.useAuthStore as unknown as jest.Mock).mockReturnValue({ token });

describe('useDeepLink (auth-aware routing)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __clearPendingDeepLink();
  });

  it('navigates immediately when authenticated (warm start)', () => {
    setAuth('tok');
    const nav = { dispatch: jest.fn() } as never;
    const { result } = renderHook(() => useDeepLink());

    act(() => {
      result.current.handleUrl('https://amanavault.app/trades/T1', nav);
    });

    expect((nav as unknown as { dispatch: jest.Mock }).dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NAVIGATE', payload: { name: 'TradeDetail', params: { tradeId: 'T1' } } }),
    );
    expect(result.current.pendingDeepLink).toBeNull();
  });

  it('parks a link that needs auth while signed out, then resumes after login', () => {
    setAuth(null);
    const nav = { dispatch: jest.fn() } as never;
    const { result, rerender } = renderHook(() => useDeepLink());

    act(() => {
      result.current.handleUrl('amanavault://trades/T-789', nav);
    });

    expect((nav as unknown as { dispatch: jest.Mock }).dispatch).not.toHaveBeenCalled();
    expect(result.current.pendingDeepLink).toEqual({
      screen: 'TradeDetail',
      params: { tradeId: 'T-789' },
    });

    // user logs in
    setAuth('tok');
    rerender(undefined);

    act(() => {
      result.current.resumePendingDeepLink(nav);
    });

    expect((nav as unknown as { dispatch: jest.Mock }).dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NAVIGATE', payload: { name: 'TradeDetail', params: { tradeId: 'T-789' } } }),
    );
    expect(result.current.pendingDeepLink).toBeNull();
  });

  it('ignores malformed links without parking anything', () => {
    setAuth(null);
    const { result } = renderHook(() => useDeepLink());

    act(() => {
      result.current.handleUrl('https://amanavault.app/garbage');
    });

    expect(result.current.pendingDeepLink).toBeNull();
  });

  // issue #62 — invalid-link error state
  it('sets invalidLinkError for a non-empty unrecognised URL', () => {
    setAuth('tok');
    const { result } = renderHook(() => useDeepLink());

    act(() => { result.current.handleUrl('https://amanavault.app/not-a-real-path'); });

    expect(result.current.invalidLinkError).toEqual({ url: 'https://amanavault.app/not-a-real-path' });
  });

  it('dismissInvalidLink clears the error', () => {
    setAuth('tok');
    const { result } = renderHook(() => useDeepLink());

    act(() => { result.current.handleUrl('https://amanavault.app/bad-route'); });
    expect(result.current.invalidLinkError).not.toBeNull();

    act(() => { result.current.dismissInvalidLink(); });
    expect(result.current.invalidLinkError).toBeNull();
  });

  it('does not set invalidLinkError for null, empty, or undefined input', () => {
    setAuth('tok');
    const { result } = renderHook(() => useDeepLink());

    act(() => { result.current.handleUrl(null); });
    act(() => { result.current.handleUrl(''); });
    act(() => { result.current.handleUrl(undefined); });

    expect(result.current.invalidLinkError).toBeNull();
  });

  it('clears invalidLinkError when a valid URL is successfully routed', () => {
    setAuth('tok');
    const nav = { dispatch: jest.fn() } as never;
    const { result } = renderHook(() => useDeepLink());

    act(() => { result.current.handleUrl('https://amanavault.app/bad-route'); });
    expect(result.current.invalidLinkError).not.toBeNull();

    act(() => { result.current.handleUrl('https://amanavault.app/trades/T1', nav); });
    expect(result.current.invalidLinkError).toBeNull();
  });
});
