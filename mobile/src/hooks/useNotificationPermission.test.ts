import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useNotificationPermission } from './useNotificationPermission';
import * as Notifications from 'expo-notifications';
import * as notificationService from '../services/notification.service';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('react-native', () => ({
  Linking: { openSettings: jest.fn() },
  Platform: { OS: 'ios' },
}));
jest.mock('../services/notification.service', () => ({
  registerForPushNotifications: jest.fn(),
}));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockedService = notificationService as jest.Mocked<typeof notificationService>;

describe('useNotificationPermission (issue #67)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
  });

  it('starts in unknown status', async () => {
    const { result } = renderHook(() => useNotificationPermission());
    await waitFor(() => expect(result.current.permissionStatus).toBe('unknown'));
  });

  it('showRationale transitions unknown → rationale', async () => {
    const { result } = renderHook(() => useNotificationPermission());
    await waitFor(() => expect(result.current.permissionStatus).toBe('unknown'));
    act(() => { result.current.showRationale(); });
    expect(result.current.permissionStatus).toBe('rationale');
  });

  it('requestPermission transitions to granted when token is returned', async () => {
    mockedService.registerForPushNotifications.mockResolvedValue('ExponentPushToken[abc]');
    const { result } = renderHook(() => useNotificationPermission());
    await act(async () => { await result.current.requestPermission(); });
    await waitFor(() => expect(result.current.permissionStatus).toBe('granted'));
    expect(result.current.pushToken).toBe('ExponentPushToken[abc]');
  });

  it('requestPermission transitions to denied when token is null', async () => {
    mockedService.registerForPushNotifications.mockResolvedValue(null);
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    const { result } = renderHook(() => useNotificationPermission());
    await act(async () => { await result.current.requestPermission(); });
    await waitFor(() => expect(result.current.permissionStatus).toBe('denied'));
  });

  it('seeds granted status from OS on mount', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    const { result } = renderHook(() => useNotificationPermission());
    await waitFor(() => expect(result.current.permissionStatus).toBe('granted'));
  });
});
