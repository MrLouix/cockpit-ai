import { jest } from '@jest/globals';

// Mock connectDB before server.js is loaded
jest.unstable_mockModule('../config/db.js', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

// ---------------------------------------------------------------------------
// HTTP route tests (via supertest)
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('includes a timestamp field', async () => {
    const res = await request(app).get('/health');
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });
});

describe('404 fallback', () => {
  it('returns 404 for an unknown GET route', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });

  it('returns 404 for an unknown POST route', async () => {
    const res = await request(app).post('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });

  it('returns 404 for a deeply nested unknown route', async () => {
    const res = await request(app).get('/api/sessions/fake/tasks/fake/unknown');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// errorHandler unit tests (called directly, no HTTP)
// ---------------------------------------------------------------------------

describe('errorHandler middleware', () => {
  let res;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('responds with err.status when provided', () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  it('defaults to status 500 when err.status is absent', () => {
    const err = new Error('Something blew up');
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Something blew up' });
  });

  it('uses "Internal server error" when err.message is absent', () => {
    errorHandler({}, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('returns JSON with an error key', () => {
    errorHandler(new Error('oops'), {}, res, () => {});
    const [payload] = res.json.mock.calls[0];
    expect(payload).toHaveProperty('error');
  });
});
