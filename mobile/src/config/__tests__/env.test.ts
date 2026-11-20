/**
 * Tests for mobile env validation (issue #132).
 */
import { collectMobileEnvIssues, validateMobileEnv } from '../env';

const REQUIRED_KEYS = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_STELLAR_NETWORK'];

describe('collectMobileEnvIssues', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns no issues when all required vars are set', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4000';
    process.env.EXPO_PUBLIC_STELLAR_NETWORK = 'testnet';
    expect(collectMobileEnvIssues()).toHaveLength(0);
  });

  it('reports all missing required vars', () => {
    for (const key of REQUIRED_KEYS) delete process.env[key];
    const issues = collectMobileEnvIssues();
    const keys = issues.map((i) => i.key);
    for (const key of REQUIRED_KEYS) {
      expect(keys).toContain(key);
    }
  });

  it('reports an empty string var as missing', () => {
    process.env.EXPO_PUBLIC_STELLAR_NETWORK = 'testnet';
    process.env.EXPO_PUBLIC_API_URL = '';
    const issues = collectMobileEnvIssues();
    expect(issues.map((i) => i.key)).toContain('EXPO_PUBLIC_API_URL');
  });

  it('reports a whitespace-only var as missing', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4000';
    process.env.EXPO_PUBLIC_STELLAR_NETWORK = '  ';
    const issues = collectMobileEnvIssues();
    expect(issues.map((i) => i.key)).toContain('EXPO_PUBLIC_STELLAR_NETWORK');
  });
});

describe('validateMobileEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns true when all required vars are present', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4000';
    process.env.EXPO_PUBLIC_STELLAR_NETWORK = 'testnet';
    expect(validateMobileEnv()).toBe(true);
  });

  it('returns false and logs when vars are missing', () => {
    for (const key of REQUIRED_KEYS) delete process.env[key];
    const result = validateMobileEnv();
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Missing required environment variables'),
    );
  });

  it('error message references .env.example', () => {
    for (const key of REQUIRED_KEYS) delete process.env[key];
    validateMobileEnv();
    const message = (console.error as jest.Mock).mock.calls[0][0] as string;
    expect(message).toMatch(/\.env\.example/);
  });

  it('never throws even with a fully empty environment', () => {
    for (const key of REQUIRED_KEYS) delete process.env[key];
    expect(() => validateMobileEnv()).not.toThrow();
  });
});
