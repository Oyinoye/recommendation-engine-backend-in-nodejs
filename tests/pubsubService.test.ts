import { initializePubSub, publishUserEventMessage } from '../src/services/pubsubService';

describe('pubsubService', () => {
  test('initializePubSub is safe when mocked', async () => {
    await expect(initializePubSub()).resolves.toBeUndefined();
  });

  test('publishUserEventMessage is a no-op when mocked', async () => {
    await expect(publishUserEventMessage({ hello: 'world' })).resolves.toBeNull();
  });
});
