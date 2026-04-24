export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export function computeBackoffMs(attempt: number, baseMs = 500, capMs = 30_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(capMs, exp + jitter);
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; isRetryable: (err: unknown) => boolean; label?: string },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!options.isRetryable(err) || attempt === options.maxRetries) {
        throw err;
      }
      const wait = computeBackoffMs(attempt);
      await sleep(wait);
    }
  }
  throw lastError;
}

export function isVertexRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes('429')) return true;
  if (msg.includes('resource exhausted')) return true;
  if (msg.includes('unavailable')) return true;
  if (msg.includes('503')) return true;
  if (msg.includes('500')) return true;
  if (msg.includes('deadline')) return true;
  return false;
}
