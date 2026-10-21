/**
 * End-to-end API tests.
 *   - Runs against MONGO_URI_TEST (default mongodb://127.0.0.1:27017/isl_translator_test).
 *   - The test database is dropped before and after the run.
 *   - DB-backed suites are skipped automatically if MongoDB is not reachable.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/isl_translator_test';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'Admin@1234';

const { default: request } = await import('supertest');
const { createApp } = await import('../src/app.js');
const app = createApp();

/* ------------------------------------------------------------ no database needed */
describe('API surface (no DB)', () => {
  test('health endpoint responds', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('unknown route returns 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  test('protected routes require a token', async () => {
    for (const [method, url] of [['get', '/api/auth/me'], ['get', '/api/translations/me'], ['post', '/api/sessions'], ['get', '/api/admin/overview']]) {
      const res = await request(app)[method](url);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${url}`);
    }
  });

  test('register validates payload', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: 'short' });
    assert.equal(res.status, 400);
    const fields = [...new Set(res.body.details.map((d) => d.field))].sort();
    assert.deepEqual(fields, ['email', 'name', 'password']);
  });

  test('register rejects self-assigned admin role', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@x.com', password: 'Passw0rd!', role: 'admin' });
    assert.equal(res.status, 400);
  });

  test('invalid ObjectId in params is rejected before hitting the DB', async () => {
    const res = await request(app).get('/api/signs/not-an-id');
    assert.equal(res.status, 400);
  });

  test('forged JWT is rejected', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    assert.equal(res.status, 401);
  });
});

/* ------------------------------------------------------------ database-backed */
let dbReady = false;
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  dbReady = true;
} catch {
  console.warn(`\n[tests] MongoDB not reachable at ${process.env.MONGO_URI} — skipping DB-backed suites.\n`);
}

describe('Full user journey (MongoDB)', { skip: !dbReady }, () => {
  const ctx = {};

  before(async () => {
    await mongoose.connection.dropDatabase();
    const { seed } = await import('../src/seed/seed.js');
    const models = await import('../src/models/index.js');
    await Promise.all(Object.values(models).filter((m) => m?.syncIndexes).map((m) => m.syncIndexes()));
    await seed({ log: () => {} });
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('admin can log in', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'Admin@1234' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'admin');
    assert.equal(res.body.user.passwordHash, undefined);
    ctx.adminToken = res.body.token;
  });

  test('user registers, duplicate email is a 409', async () => {
    const body = { name: 'Nallathai', email: 'nalla@example.com', password: 'Secret123', role: 'learner' };
    const res = await request(app).post('/api/auth/register').send(body);
    assert.equal(res.status, 201);
    ctx.token = res.body.token;
    ctx.userId = res.body.user._id;
    const dup = await request(app).post('/api/auth/register').send(body);
    assert.equal(dup.status, 409);
  });

  test('wrong password is rejected', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nalla@example.com', password: 'Wrong1234' });
    assert.equal(res.status, 401);
  });

  test('dictionary is seeded and searchable', async () => {
    const all = await request(app).get('/api/signs?limit=500');
    assert.equal(all.status, 200);
    assert.equal(all.body.items.length, 51);
    const digits = await request(app).get('/api/signs?category=digit');
    assert.equal(digits.body.items.length, 10);
    const q = await request(app).get('/api/signs?q=hel');
    assert.equal(q.body.items[0].word, 'Hello');
    ctx.helloId = q.body.items[0]._id;
  });

  test('non-admin cannot create signs; admin can (auto labelIndex)', async () => {
    const denied = await request(app).post('/api/signs').set('Authorization', `Bearer ${ctx.token}`).send({ word: 'Bus', category: 'word' });
    assert.equal(denied.status, 403);
    const ok = await request(app).post('/api/signs').set('Authorization', `Bearer ${ctx.adminToken}`).send({ word: 'Bus', category: 'word' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.sign.labelIndex, 51);
  });

  test('model upload validates files and labels, then activates', async () => {
    const labels = ['A', 'B', 'Hello'];
    const modelJson = {
      format: 'layers-model',
      modelTopology: { class_name: 'Sequential', config: { layers: [{ class_name: 'Dense', config: { units: 3 } }] } },
      weightsManifest: [{ paths: ['model.weights.bin'], weights: [] }],
    };
    const missing = await request(app).post('/api/models').set('Authorization', `Bearer ${ctx.adminToken}`)
      .field('classLabels', JSON.stringify(labels))
      .attach('files', Buffer.from(JSON.stringify(modelJson)), 'model.json');
    assert.equal(missing.status, 400);
    assert.match(missing.body.message, /Missing weight files/);

    const mismatch = await request(app).post('/api/models').set('Authorization', `Bearer ${ctx.adminToken}`)
      .field('classLabels', JSON.stringify(['A', 'B']))
      .attach('files', Buffer.from(JSON.stringify(modelJson)), 'model.json')
      .attach('files', Buffer.alloc(16), 'model.weights.bin');
    assert.equal(mismatch.status, 400);

    const res = await request(app).post('/api/models').set('Authorization', `Bearer ${ctx.adminToken}`)
      .field('classLabels', JSON.stringify(labels)).field('valAccuracy', '0.93').field('activate', 'true')
      .attach('files', Buffer.from(JSON.stringify(modelJson)), 'model.json')
      .attach('files', Buffer.alloc(16), 'model.weights.bin');
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.model.version, 'v1.0.0');
    assert.equal(res.body.model.isActive, true);
    ctx.modelId = res.body.model._id;

    const active = await request(app).get('/api/models/active');
    assert.equal(active.body.model.version, 'v1.0.0');
    const file = await request(app).get(active.body.model.modelUrl);
    assert.equal(file.status, 200);
  });

  test('only one model can be active', async () => {
    const modelJson = { modelTopology: { config: { layers: [{ config: { units: 2 } }] } }, weightsManifest: [{ paths: ['w.bin'] }] };
    const res = await request(app).post('/api/models').set('Authorization', `Bearer ${ctx.adminToken}`)
      .field('classLabels', '["X","Y"]').field('activate', 'true')
      .attach('files', Buffer.from(JSON.stringify(modelJson)), 'model.json')
      .attach('files', Buffer.alloc(8), 'w.bin');
    assert.equal(res.status, 201);
    assert.equal(res.body.model.version, 'v1.0.1');
    const list = await request(app).get('/api/models').set('Authorization', `Bearer ${ctx.adminToken}`);
    assert.equal(list.body.items.filter((m) => m.isActive).length, 1);
    const delActive = await request(app).delete(`/api/models/${res.body.model._id}`).set('Authorization', `Bearer ${ctx.adminToken}`);
    assert.equal(delActive.status, 400);
    const delOld = await request(app).delete(`/api/models/${ctx.modelId}`).set('Authorization', `Bearer ${ctx.adminToken}`);
    assert.equal(delOld.status, 200);
    ctx.modelId = res.body.model._id;
  });

  test('session → translations → stats', async () => {
    const auth = { Authorization: `Bearer ${ctx.token}` };
    const s = await request(app).post('/api/sessions').set(auth).send({ modelVersionId: ctx.modelId, device: { browser: 'test', backend: 'webgl', fps: 30 } });
    assert.equal(s.status, 201);
    ctx.sessionId = s.body.session._id;

    for (const [text, conf] of [['Hello', 0.97], ['Hello', 0.91], ['A', 0.88]]) {
      const r = await request(app).post('/api/translations').set(auth).send({ sessionId: ctx.sessionId, recognizedText: text, confidence: conf, latencyMs: 12, spoken: true });
      assert.equal(r.status, 201);
    }
    const bad = await request(app).post('/api/translations').set(auth).send({ recognizedText: 'X', confidence: 1.5 });
    assert.equal(bad.status, 400);

    const logs = await request(app).get('/api/translations/me').set(auth);
    assert.equal(logs.body.items.length, 3);
    assert.equal(logs.body.items.find((l) => l.recognizedText === 'Hello').signId.word, 'Hello', 'signId resolved from text');
    ctx.logId = logs.body.items[0]._id;

    const stats = await request(app).get('/api/translations/me/stats').set(auth);
    assert.equal(stats.body.stats.total, 3);
    assert.equal(stats.body.stats.topSigns[0].word, 'Hello');

    const end = await request(app).patch(`/api/sessions/${ctx.sessionId}/end`).set(auth).send({ fps: 29 });
    assert.ok(end.body.session.endedAt);
    assert.equal(end.body.session.gestureCount, 3);
    const late = await request(app).post('/api/translations').set(auth).send({ sessionId: ctx.sessionId, recognizedText: 'B', confidence: 0.9 });
    assert.equal(late.status, 400);
  });

  test("users cannot read or delete each other's data", async () => {
    const other = await request(app).post('/api/auth/register').send({ name: 'Other', email: 'other@example.com', password: 'Secret123' });
    const auth = { Authorization: `Bearer ${other.body.token}` };
    const logs = await request(app).get('/api/translations/me').set(auth);
    assert.equal(logs.body.items.length, 0);
    const del = await request(app).delete(`/api/translations/${ctx.logId}`).set(auth);
    assert.equal(del.status, 404);
    const fb = await request(app).post('/api/feedback').set(auth).send({ logId: ctx.logId });
    assert.equal(fb.status, 404);
  });

  test('feedback is 1:1 with a log and reviewable by admin', async () => {
    const auth = { Authorization: `Bearer ${ctx.token}` };
    const fb = await request(app).post('/api/feedback').set(auth).send({ logId: ctx.logId, expectedSignId: ctx.helloId, comment: 'Was Hello' });
    assert.equal(fb.status, 201);
    const dup = await request(app).post('/api/feedback').set(auth).send({ logId: ctx.logId });
    assert.equal(dup.status, 409);
    const list = await request(app).get('/api/feedback?status=open').set('Authorization', `Bearer ${ctx.adminToken}`);
    assert.equal(list.body.items.length, 1);
    const upd = await request(app).patch(`/api/feedback/${fb.body.feedback._id}`).set('Authorization', `Bearer ${ctx.adminToken}`).send({ status: 'reviewed' });
    assert.equal(upd.body.feedback.status, 'reviewed');
  });

  test('learning progress upserts and reaches mastery', async () => {
    const auth = { Authorization: `Bearer ${ctx.token}` };
    const a1 = await request(app).post('/api/progress/attempt').set(auth).send({ signId: ctx.helloId, accuracy: 0.6 });
    assert.equal(a1.body.progress.status, 'learning');
    const a2 = await request(app).post('/api/progress/attempt').set(auth).send({ signId: ctx.helloId, accuracy: 0.9 });
    assert.equal(a2.body.progress.status, 'mastered');
    assert.equal(a2.body.progress.attempts, 2);
    const a3 = await request(app).post('/api/progress/attempt').set(auth).send({ signId: ctx.helloId, accuracy: 0.5 });
    assert.equal(a3.body.progress.bestAccuracy, 0.9, 'best accuracy is kept');
    const mine = await request(app).get('/api/progress/me').set(auth);
    assert.equal(mine.body.items.length, 1);
    assert.equal(mine.body.summary.mastered, 1);
  });

  test('admin overview aggregates', async () => {
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${ctx.adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.counts.translations, 3);
    assert.equal(res.body.stats.last7.length, 7);
    assert.equal(res.body.stats.activeModel.version, 'v1.0.1');
  });

  test('admin cannot demote themselves', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ctx.adminToken}`);
    const res = await request(app).patch(`/api/admin/users/${me.body.user._id}`).set('Authorization', `Bearer ${ctx.adminToken}`).send({ role: 'user' });
    assert.equal(res.status, 400);
  });
});
