jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
  })),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    withTransactionAsync: jest.fn(async (callback) => callback()),
  }),
}));
