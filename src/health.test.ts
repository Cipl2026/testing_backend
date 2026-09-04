import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';

describe('GET /api/v1/health', () => {
  it('returns the Phase 1 health payload', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'GhaarFix API is running',
      environment: 'test',
    });
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('returns a structured 404 for unknown routes', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      code: 'NOT_FOUND',
      data: null,
    });
  });
});
