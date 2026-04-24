import { computeBackoffMs, sleep, withExponentialBackoff } from '../src/utils/backoff';

describe('backoff', () => {
  test('computeBackoffMs grows and caps', () => {
    expect(computeBackoffMs(1, 100, 10_000)).toBeGreaterThanOrEqual(100);
    expect(computeBackoffMs(10, 500, 2000)).toBeLessThanOrEqual(2000);
  });

  test('sleep resolves', async () => {
    const t = Date.now();
    await sleep(5);
    expect(Date.now() - t).toBeGreaterThanOrEqual(4);
  });

  test('withExponentialBackoff retries then succeeds', async () => {
    let n = 0;
    const out = await withExponentialBackoff(
      async () => {
        n += 1;
        if (n < 3) throw new Error('429 too many requests');
        return 'ok';
      },
      { maxRetries: 5, isRetryable: () => true },
    );
    expect(out).toBe('ok');
    expect(n).toBe(3);
  });

  test('withExponentialBackoff stops on non-retryable', async () => {
    await expect(
      withExponentialBackoff(
        async () => {
          throw new Error('nope');
        },
        { maxRetries: 3, isRetryable: () => false },
      ),
    ).rejects.toThrow('nope');
  });
});
