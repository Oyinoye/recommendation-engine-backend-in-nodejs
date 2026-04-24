jest.mock('redis', () => {
  const client = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    isOpen: true,
  };
  return {
    createClient: jest.fn(() => client),
  };
});

describe('redis config', () => {
  test('getRedis returns singleton', async () => {
    const { getRedis, closeRedis } = await import('../src/config/redis');
    const a = await getRedis();
    const b = await getRedis();
    expect(a).toBe(b);
    await closeRedis();
  });
});
