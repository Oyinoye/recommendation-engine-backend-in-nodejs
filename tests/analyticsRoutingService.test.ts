import { routeRawEventToBigQuery } from '../src/services/analyticsRoutingService';

describe('analyticsRoutingService', () => {
  test('no-ops when BIGQUERY_DATASET is unset', async () => {
    await expect(routeRawEventToBigQuery({ event_id: 'x' })).resolves.toBeUndefined();
  });
});
