import { assert } from 'chai';
import * as express from 'express';
import httpHeaderFieldsTyped from 'http-header-fields-typed';
import * as request from 'supertest';
import { correlationIdService } from '../services/correlationIdService';
import { setTestingConfigurations } from '../utils/testingConfigurations';
import { createCorrelationIdMiddleware } from './correlationIdMiddleware';

function delay(millis: number): Promise<void> {
  return new Promise<void>((resolve) =>
    setTimeout(() => {
      resolve();
    }, millis),
  );
}

// ==========================================
// Set Testing configurations
// ==========================================
setTestingConfigurations();

const uuidMatcher = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ==========================================
// Correlation ID service
// ==========================================
// tslint:disable-next-line: max-func-body-length
describe('Correlation ID Middleware', () => {
  it('should generate correlation id if it doesnt exists', async () => {
    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', (req, res) => {
      const actual = correlationIdService.getId();
      assert.match(actual, uuidMatcher);
      res.end();
    });

    await request(app).get('/').send();
  });

  it('should get correlation id from incoming request', async () => {
    const testId = 'correlation-id-123';

    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', (req, res) => {
      const actual = correlationIdService.getId();
      assert.strictEqual(
        actual,
        testId,
        'getId() should return id from x-correlation-id header of inbound request',
      );
      res.end();
    });

    await request(app).get('/').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();
  });

  it('should maintain correlation id with async callbacks', async () => {
    const testId = 'correlation-id-123';

    let actual = '';
    let actual2 = '';
    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', async (req, res, next) => {
      actual = correlationIdService.getId();
      setTimeout(() => {
        actual2 = correlationIdService.getId();
        res.end();
      }, 250);
    });

    assert.isUndefined(correlationIdService.getId());
    await request(app).get('/').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();

    assert.isUndefined(correlationIdService.getId());
    assert.strictEqual(
      actual,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual2,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
  });

  it('should maintain correlation id with async/await operations', async () => {
    const testId = 'correlation-id-123';

    let actual = '';
    let actual2 = '';
    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', async (req, res, next) => {
      try {
        actual = correlationIdService.getId();
        await delay(250);
        actual2 = correlationIdService.getId();
      } catch (e) {
        next(e);
      } finally {
        res.end();
      }
    });

    assert.isUndefined(correlationIdService.getId());
    await request(app).get('/').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();

    assert.isUndefined(correlationIdService.getId());
    assert.strictEqual(
      actual,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual2,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
  });

  it('should keep correlation ids in nested requests', async () => {
    const testId = 'correlation-id-123';
    const testId2 = 'correlation-id-456';

    let actual = '';
    let actual2 = '';
    let actual3 = '';
    let actual4 = '';
    let actual5 = '';
    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', async (req, res, next) => {
      try {
        actual = correlationIdService.getId();
        await delay(250);
        actual2 = correlationIdService.getId();
        await request(app).get('/foo').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId2).send();
        actual3 = correlationIdService.getId();
      } catch (e) {
        next(e);
      } finally {
        res.end();
      }
    });
    app.get('/foo', async (req, res, next) => {
      try {
        actual4 = correlationIdService.getId();
        await delay(250);
        actual5 = correlationIdService.getId();
      } catch (e) {
        next(e);
      } finally {
        res.end();
      }
    });

    assert.isUndefined(correlationIdService.getId());
    await request(app).get('/').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();

    assert.isUndefined(correlationIdService.getId());
    assert.strictEqual(
      actual,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual2,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual3,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual4,
      testId2,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual5,
      testId2,
      'getId() should return id from x-correlation-id header of inbound request',
    );
  });

  // tslint:disable: no-console
  it('should keep correlation ids separated in parallel requests', async function () {
    this.timeout(5000);
    const testId = 'correlation-id-123';
    const testId2 = 'correlation-id-456';

    let actual = '';
    let actual2 = '';
    let actual4 = '';
    let actual5 = '';
    let unlock: any;
    const lock = new Promise(async (resolve, reject) => {
      unlock = resolve;
    });
    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', async (req, res, next) => {
      try {
        actual = correlationIdService.getId();
        console.log('start of req1', actual);
        await lock;
        actual2 = correlationIdService.getId();
        console.log('end of req1', actual2);
      } catch (e) {
        next(e);
      } finally {
        res.end();
      }
    });
    app.get('/foo', async (req, res, next) => {
      try {
        actual4 = correlationIdService.getId();
        console.log('start of req2', actual4);
        unlock();
        await this.timeout(200);
        actual5 = correlationIdService.getId();
        console.log('end of req2', actual5);
      } catch (e) {
        next(e);
      } finally {
        res.end();
      }
    });

    console.log('send req1');
    assert.isUndefined(correlationIdService.getId());
    const req1 = request(app).get('/').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();
    console.log('send req2');
    assert.isUndefined(correlationIdService.getId());
    const req2 = request(app)
      .get('/foo')
      .set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId2)
      .send();
    await Promise.all([req1, req2]);
    assert.isUndefined(correlationIdService.getId());
    assert.strictEqual(
      actual,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual2,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual4,
      testId2,
      'getId() should return id from x-correlation-id header of inbound request',
    );
    assert.strictEqual(
      actual5,
      testId2,
      'getId() should return id from x-correlation-id header of inbound request',
    );
  });

  it('should work with operations causing errors', async () => {
    const testId = 'correlation-id-123';

    let actual = '';
    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', (req, res, next) => {
      actual = correlationIdService.getId();
      throw new Error('some error');
    });

    assert.isUndefined(correlationIdService.getId());
    const result = await request(app)
      .get('/')
      .set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId)
      .send();
    assert.strictEqual(result.status, 500);
    assert.isUndefined(correlationIdService.getId());
    assert.strictEqual(
      actual,
      testId,
      'getId() should return id from x-correlation-id header of inbound request',
    );
  });

  it('a filter can be specified', async () => {
    const testId = 'correlation-id-123';

    const filter = (req: express.Request): boolean => {
      if (req.path.startsWith('/ok/')) {
        return true;
      }
      return false;
    };

    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware(filter));

    app.get('/ok/1', (req, res) => {
      const actual = correlationIdService.getId();
      assert.strictEqual(
        actual,
        testId,
        'getId() should return id from x-correlation-id header of inbound request',
      );
      res.end();
    });
    app.get('/ok/2', (req, res) => {
      const actual = correlationIdService.getId();
      assert.strictEqual(
        actual,
        testId,
        'getId() should return id from x-correlation-id header of inbound request',
      );
      res.end();
    });
    app.get('/notok/1', (req, res) => {
      const actual = correlationIdService.getId();
      assert.isUndefined(actual);
      res.end();
    });

    await request(app).get('/ok/1').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();

    await request(app).get('/ok/2').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();

    await request(app).get('/notok/1').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();
  });

  it('getCidInfo() cid received', async () => {
    const testId = 'correlation-id-123';

    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', (req, res) => {
      const info = correlationIdService.getCidInfo(req);
      assert.strictEqual(info.current, testId);
      assert.strictEqual(info.receivedInRequest, testId);
      assert.isUndefined(info.generated);

      res.end();
    });

    await request(app).get('/').set(httpHeaderFieldsTyped.X_CORRELATION_ID, testId).send();
  });

  it('getCidInfo() cid generated', async () => {
    const app: express.Application = express();
    app.use(createCorrelationIdMiddleware());
    app.get('/', (req, res) => {
      const info = correlationIdService.getCidInfo(req);
      assert.match(info.current, uuidMatcher);
      assert.strictEqual(info.current, info.generated);
      assert.isUndefined(info.receivedInRequest);

      res.end();
    });

    await request(app).get('/').send();
  });
});
