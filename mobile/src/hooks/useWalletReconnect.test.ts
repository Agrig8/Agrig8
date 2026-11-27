import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWalletReconnect } from './useWalletReconnect';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';

jest.mock('../api/auth', () => ({
  authApi: {
    generateChallenge: jest.fn(),
    verifyChallenge: jest.fn(),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('../stores/authStore', () => {
  const store: { token: string | null; walletAddress: string | null } = {
    token: 'tok',
    walletAddress: 'GADDR',
  };
  return {
    useAuthStore: jest.fn(() => ({
      ...store,
      setToken: jest.fn(async (t: string) => { store.token = t; }),
      clearAuth: jest.fn(async () => { store.token = null; }),
    })),
  };
});

const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

describe('useWalletReconnect (issue #63)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports connected when token is present', () => {
    const { result } = renderHook(() => useWalletReconnect());
    expect(result.current.status).toBe('connected');
  });

  it('calls generateChallenge and verifyChallenge on reconnect', async () => {
    mockedAuthApi.generateChallenge.mockResolvedValue({ challenge: 'ch' } as never);
    mockedAuthApi.verifyChallenge.mockResolvedValue({ token: 'new-tok' } as never);

    const { result } = renderHook(() => useWalletReconnect());
    await act(async () => { await result.current.reconnect(); });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });
    expect(mockedAuthApi.generateChallenge).toHaveBeenCalledWith('GADDR');
    expect(mockedAuthApi.verifyChallenge).toHaveBeenCalledWith('GADDR', 'ch');
  });

  it('sets error status when reconnect API call fails', async () => {
    mockedAuthApi.generateChallenge.mockRejectedValue(new Error('timeout'));

    const { result } = renderHook(() => useWalletReconnect());
    await act(async () => { await result.current.reconnect(); });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
  });

  it('clears auth and sets disconnected when no walletAddress', async () => {
    (useAuthStore as jest.Mock).mockReturnValueOnce({
      token: null,
      walletAddress: null,
      setToken: jest.fn(),
      clearAuth: jest.fn(),
    });

    const { result } = renderHook(() => useWalletReconnect());
    await act(async () => { await result.current.reconnect(); });

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });
  });
});
