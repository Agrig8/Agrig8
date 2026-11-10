import type { ForwardedRef, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import { AppNavigator } from './AppNavigator';
import * as useDeepLinkHook from '../hooks/useDeepLink';

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: jest.requireActual<typeof import('react')>('react').forwardRef(
    ({ children }: { children: ReactNode }, _ref: ForwardedRef<unknown>) => children,
  ),
  useFocusEffect: jest.fn(),
  useNavigation: jest.fn(),
}));

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }: { children: ReactNode }) => children,
    Screen: ({ name }: { name: string }) => {
      const React = jest.requireActual<typeof import('react')>('react');
      const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
      return React.createElement(Text, null, name);
    },
  }),
}));

// Mock screens
jest.mock('../screens/WalletConnectScreen', () => 'WalletConnectScreen');
jest.mock('../screens/TradeListScreen', () => 'TradeListScreen');
jest.mock('../screens/TradeDetailScreen', () => 'TradeDetailScreen');
jest.mock('../screens/DisputeDetailScreen', () => 'DisputeDetailScreen');
jest.mock('../screens/CreateTradeScreen', () => 'CreateTradeScreen');
jest.mock('../screens/EvidenceCaptureScreen', () => 'EvidenceCaptureScreen');
jest.mock('../screens/VaultDashboard', () => 'VaultDashboard');
jest.mock('../screens/AdminStreamsOverviewScreen', () => ({ default: 'AdminStreamsOverviewScreen' }));
jest.mock('../screens/AdminTradesBatchScreen', () => ({ default: 'AdminTradesBatchScreen' }));
jest.mock('../screens/AdminContractScreen', () => ({ default: 'AdminContractScreen' }));
jest.mock('../screens/AdminFeaturesScreen', () => ({ default: 'AdminFeaturesScreen' }));
jest.mock('../screens/AdminActionSuccessScreen', () => ({ default: 'AdminActionSuccessScreen' }));

// Mock useDeepLink
jest.mock('../hooks/useDeepLink', () => ({
  useDeepLink: jest.fn(),
}));

describe('AppNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with authenticated user', () => {
    (useDeepLinkHook.useDeepLink as jest.Mock).mockReturnValue({
      pendingDeepLink: null,
      handleUrl: jest.fn(),
      handleDeepLink: jest.fn(),
      resumePendingDeepLink: jest.fn(),
      navigateToDeepLink: jest.fn(),
    });

    const { toJSON } = render(<AppNavigator isAuthenticated={true} />);

    expect(toJSON()).toBeTruthy();
  });

  it('should render with unauthenticated user', () => {
    (useDeepLinkHook.useDeepLink as jest.Mock).mockReturnValue({
      pendingDeepLink: null,
      handleUrl: jest.fn(),
      handleDeepLink: jest.fn(),
      resumePendingDeepLink: jest.fn(),
      navigateToDeepLink: jest.fn(),
    });

    const { toJSON } = render(<AppNavigator isAuthenticated={false} />);

    expect(toJSON()).toBeTruthy();
  });

  it('resumes a pending deep link when the user is authenticated', () => {
    const resumePendingDeepLinkMock = jest.fn();
    (useDeepLinkHook.useDeepLink as jest.Mock).mockReturnValue({
      pendingDeepLink: { screen: 'TradeDetail', params: { id: 'trade-123' } },
      handleUrl: jest.fn(),
      handleDeepLink: jest.fn(),
      resumePendingDeepLink: resumePendingDeepLinkMock,
      navigateToDeepLink: jest.fn(),
    });

    render(<AppNavigator isAuthenticated={true} />);

    expect(resumePendingDeepLinkMock).toHaveBeenCalled();
  });

  it('does not resume a pending deep link while unauthenticated', () => {
    const resumePendingDeepLinkMock = jest.fn();
    (useDeepLinkHook.useDeepLink as jest.Mock).mockReturnValue({
      pendingDeepLink: { screen: 'DisputeDetail', params: { id: 'dispute-456' } },
      handleUrl: jest.fn(),
      handleDeepLink: jest.fn(),
      resumePendingDeepLink: resumePendingDeepLinkMock,
      navigateToDeepLink: jest.fn(),
    });

    render(<AppNavigator isAuthenticated={false} />);

    expect(resumePendingDeepLinkMock).not.toHaveBeenCalled();
  });

  it('should render all non-admin screens in stack', () => {
    (useDeepLinkHook.useDeepLink as jest.Mock).mockReturnValue({
      pendingDeepLink: null,
      handleUrl: jest.fn(),
      handleDeepLink: jest.fn(),
      resumePendingDeepLink: jest.fn(),
      navigateToDeepLink: jest.fn(),
    });

    const { getByText } = render(<AppNavigator isAuthenticated={true} />);

    // Core screens should be rendered
    expect(getByText('TradeList')).toBeTruthy();
    expect(getByText('TradeDetail')).toBeTruthy();
    expect(getByText('DisputeDetail')).toBeTruthy();
  });

  // Issue #100: admin screens are only registered for admin users
  it('does not register admin screens for non-admin users', () => {
    (useDeepLinkHook.useDeepLink as jest.Mock).mockReturnValue({
      pendingDeepLink: null,
      handleUrl: jest.fn(),
      handleDeepLink: jest.fn(),
      resumePendingDeepLink: jest.fn(),
      navigateToDeepLink: jest.fn(),
    });

    const { queryByText } = render(<AppNavigator isAuthenticated={true} isAdmin={false} />);

    expect(queryByText('AdminStreamsOverview')).toBeNull();
    expect(queryByText('AdminTradesBatch')).toBeNull();
  });

  it('registers admin screens for admin users', async () => {
    (useDeepLinkHook.useDeepLink as jest.Mock).mockReturnValue({
      pendingDeepLink: null,
      handleUrl: jest.fn(),
      handleDeepLink: jest.fn(),
      resumePendingDeepLink: jest.fn(),
      navigateToDeepLink: jest.fn(),
    });

    const { findByText } = render(<AppNavigator isAuthenticated={true} isAdmin={true} />);

    expect(await findByText('AdminStreamsOverview')).toBeTruthy();
    expect(await findByText('AdminTradesBatch')).toBeTruthy();
  });
});
