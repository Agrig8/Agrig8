/**
 * Tests for frontend env validation (issue #132).
 */
import { collectFrontendEnvIssues, validateFrontendEnv } from '../validate';

const REQUIRED_KEYS = ['NEXT_PUBLIC_STELLAR_NETWORK', 'NEXT_PUBLIC_API_URL'];

describe('collectFrontendEnvIssues', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns no issues when all required vars are set', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
    expect(collectFrontendEnvIssues()).toHaveLength(0);
  });

  it('reports all missing required vars', () => {
    for (const key of REQUIRED_KEYS) delete process.env[key];
    const issues = collectFrontendEnvIssues();
    const keys = issues.map((i) => i.key);
    for (const key of REQUIRED_KEYS) {
      expect(keys).toContain(key);
    }
  });

  it('reports a var set to an empty string as missing', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    process.env.NEXT_PUBLIC_API_URL = '';
    const issues = collectFrontendEnvIssues();
    expect(issues.map((i) => i.key)).toContain('NEXT_PUBLIC_API_URL');
  });

  it('reports a var set to whitespace as missing', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = '   ';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
    const issues = collectFrontendEnvIssues();
    expect(issues.map((i) => i.key)).toContain('NEXT_PUBLIC_STELLAR_NETWORK');
  });
});

describe('validateFrontendEnv', () => {
  const originalEnv = process.env;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, writable: true });
  });

  it('does not throw in development when vars are missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
    for (const key of REQUIRED_KEYS) delete process.env[key];
    expect(() => validateFrontendEnv()).not.toThrow();
  });

  it('throws in production when vars are missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
    for (const key of REQUIRED_KEYS) delete process.env[key];
    expect(() => validateFrontendEnv()).toThrow(/Missing required environment variables/);
  });

  it('does not throw when all required vars are present', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
    expect(() => validateFrontendEnv()).not.toThrow();
  });

  it('error message references .env.example', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
    for (const key of REQUIRED_KEYS) delete process.env[key];
    try {
      validateFrontendEnv();
    } catch (err) {
      expect((err as Error).message).toMatch(/\.env\.example/);
    }
  });
});
