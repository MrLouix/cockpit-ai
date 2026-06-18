import { jest } from '@jest/globals';

// Mock connectDB before server.js is imported so it never touches MongoDB
jest.unstable_mockModule('../config/db.js', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

// Dynamic import after the mock is registered
const { default: app } = await import('../server.js');

// supertest must also be dynamically imported in ESM context
const { default: request } = await import('supertest');

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns a timestamp field', async () => {
    const res = await request(app).get('/health');
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });
});

describe('Unknown routes', () => {
  it('returns 404 for an unknown GET route', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for an unknown POST route', async () => {
    const res = await request(app).post('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
