/**
 * Tests for HomeScreen (issue #250).
 * Covers rendered content and navigation from the Help & FAQ card.
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import HomeScreen from '../HomeScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const mockOpenURL = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: mockOpenURL,
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  getInitialURL: jest.fn().mockResolvedValue(null),
  canOpenURL: jest.fn().mockResolvedValue(true),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenURL.mockResolvedValue(undefined);
});

test('renders title and subtitle', async () => {
  const { getByText } = render(<HomeScreen />);
  await waitFor(() => {
    expect(getByText('Stellar Mobile')).toBeTruthy();
    expect(getByText('Trust as a Service for Agricultural Products')).toBeTruthy();
  });
});

test('renders Getting Started section', async () => {
  const { getByText } = render(<HomeScreen />);
  await waitFor(() => expect(getByText('Getting Started')).toBeTruthy());
});

test('renders About & Help section with FAQ link', async () => {
  const { getByText } = render(<HomeScreen />);
  await waitFor(() => {
    expect(getByText('About & Help')).toBeTruthy();
    expect(getByText('Help & FAQ')).toBeTruthy();
  });
});

test('tapping Help & FAQ link opens external URL', async () => {
  const { getByTestId } = render(<HomeScreen />);
  await waitFor(() => expect(getByTestId('help-faq-link')).toBeTruthy());
  fireEvent.press(getByTestId('help-faq-link'));
  await waitFor(() => {
    expect(mockOpenURL).toHaveBeenCalledWith(expect.stringContaining('help'));
  });
});

test('notification listener is registered and cleaned up on unmount', () => {
  const removeMock = jest.fn();
  jest.mocked(Notifications.addNotificationResponseReceivedListener).mockReturnValue({
    remove: removeMock,
  });

  const { unmount } = render(<HomeScreen />);
  expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
  unmount();
  expect(removeMock).toHaveBeenCalled();
});
