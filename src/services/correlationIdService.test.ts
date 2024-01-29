// tslint:disable max-func-body-length

import { assert } from 'chai';
import { EventEmitter } from 'events';
import { setTestingConfigurations } from '../utils/testingConfigurations';
import { correlationIdService } from './correlationIdService';

setTestingConfigurations();

const uuidMatcher = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function timeout(work: (params?: any) => any, ms = 50) {
  return new Promise<void>((resolve) =>
    setTimeout(() => {
      work();
      resolve();
    }, ms),
  );
}

describe('Correlation Id Service', () => {
  describe('createNewId', () => {
    it('should return UUID', () => {
      const cid = correlationIdService.createNewId();
      assert.match(cid, uuidMatcher);
    });
  });

  describe('withId correlator', () => {
    it('with sync function', () => {
      // GIVEN
      const expectedResult = '⭐';

      // WHEN
      const result = correlationIdService.withId(() => {
        const actual = correlationIdService.getId();
        assert.match(actual, uuidMatcher, 'getId() should return a uuid');
        return expectedResult;
      });

      // THEN
      assert.strictEqual(result, expectedResult);
    });

    it('with async function', async () => {
      let done = false;

      const promise = correlationIdService.withId(async () => {
        await timeout(() => {
          const actual = correlationIdService.getId();
          assert.match(actual, uuidMatcher, 'getId() should return a uuid');
          done = true;
        });
      });

      // "withId" doesn't care about a promise to be floating or not
      assert.isFalse(done);
      await promise;
    });

    it('with supplied id', () => {
      const testId = 'id-1';
      correlationIdService.withId(() => {
        const actual = correlationIdService.getId();
        assert.strictEqual(actual, testId, 'getId() should return supplied id');
      }, testId);
    });

    it('with bound emitter', () => {
      // GIVEN
      const emitter = new EventEmitter();
      let receivedValue = 0;
      let receivedCid = '';
      emitter.on('test', (value) => {
        receivedValue = value;
        receivedCid = correlationIdService.getId();
      });

      // WHEN
      let boundEmitter: EventEmitter;
      correlationIdService.withId(() => {
        boundEmitter = correlationIdService.bind(emitter);
        assert.strictEqual(boundEmitter, emitter);
      }, 'foo');

      // THEN
      boundEmitter.emit('test', 33);
      assert.equal(receivedValue, 33);
      assert.equal(receivedCid, 'foo');
    });

    it('with bound function', () => {
      // GIVEN
      const func = (msg: string) => msg + correlationIdService.getId();

      // WHEN
      let boundFunc: (msg: string) => string;
      correlationIdService.withId(() => {
        boundFunc = correlationIdService.bind(func);
      }, 'foo');

      // THEN
      const result = boundFunc('Bar-');
      assert.equal(result, 'Bar-foo');
    });

    it('with bound method', () => {
      // GIVEN
      const instance = {
        title: 'Hello-',
        say(msg: string): string {
          return this.title + msg + correlationIdService.getId();
        },
      };

      // WHEN
      correlationIdService.withId(() => {
        instance.say = correlationIdService.bind(instance.say);
      }, 'foo');

      // THEN
      const result = instance.say('Bar-');
      assert.equal(result, 'Hello-Bar-foo');
    });

    it('with resolved promise', async () => {
      let done = false;

      const promise = correlationIdService.withId(() =>
        Promise.resolve(correlationIdService.getId()).then((id) => {
          assert.match(id, uuidMatcher, 'Promise should resolve correlation id');
          done = true;
        }),
      );

      // "withId" doesn't care about a promise to be floating or not
      assert.isFalse(done);
      await promise;
    });

    it('with nested functions', () => {
      correlationIdService.withId(() => {
        const cid1 = correlationIdService.getId();
        assert.match(cid1, uuidMatcher, 'correlationIdService.getId() should return a UUID');

        correlationIdService.withId(() => {
          const cid2 = correlationIdService.getId();
          assert.notEqual(
            cid2,
            cid1,
            'correlationIdService.getId() should return a different id for every scope',
          );
          assert.match(cid2, uuidMatcher, 'correlationIdService.getId() should return a UUID');
        });

        const cid3 = correlationIdService.getId();
        assert.strictEqual(
          cid3,
          cid1,
          'correlationIdService.getId() should return the same id for the same scope',
        );
        assert.match(cid3, uuidMatcher, 'correlationIdService.getId() should return a UUID');
      });
    });

    it('with async function', async function () {
      const duration = 25;
      setSlowThreshold(this, duration);

      // GIVEN
      const expectedResult = '⭐';

      // WHEN
      const result = await correlationIdService.withId(async () => {
        assert.equal(correlationIdService.getId(), 'foo');
        await timeout(() => {
          assert.equal(correlationIdService.getId(), 'foo');
        }, duration);
        assert.equal(correlationIdService.getId(), 'foo');
        return expectedResult;
      }, 'foo');

      // THEN
      assert.strictEqual(result, expectedResult);
    });
  });

  describe('withIdAsync correlator', () => {
    it('with async function', async function () {
      const duration = 25;
      setSlowThreshold(this, duration);

      // GIVEN
      const expectedResult = '⭐';

      // WHEN
      const result = await correlationIdService.withIdAsync(async () => {
        assert.equal(correlationIdService.getId(), 'foo');
        await timeout(() => {
          assert.equal(correlationIdService.getId(), 'foo');
        }, duration);
        assert.equal(correlationIdService.getId(), 'foo');
        return expectedResult;
      }, 'foo');

      // THEN
      assert.strictEqual(result, expectedResult);
    });

    it('with error in callback', async () => {
      try {
        await correlationIdService.withIdAsync(async () => {
          assert.equal(correlationIdService.getId(), 'foo');
          throw new Error('some error...');
        }, 'foo');
        assert.fail('expected error');
      } catch (err) {
        assert.equal(err.message, 'some error...');
      }
    });

    it('with error after await', async function () {
      const duration = 25;
      setSlowThreshold(this, duration);

      try {
        await correlationIdService.withIdAsync(async () => {
          assert.equal(correlationIdService.getId(), 'foo');
          // tslint:disable-next-line: no-empty
          await timeout(() => {}, duration);
          throw new Error('some error...');
        }, 'foo');
        assert.fail('expected error');
      } catch (err) {
        assert.equal(err.message, 'some error...');
      }
    });

    it('with nested async functions', async function () {
      const duration = 25;
      setSlowThreshold(this, 2 * duration);

      await correlationIdService.withIdAsync(async () => {
        assert.equal(correlationIdService.getId(), 'foo');
        await timeout(async () => {
          await correlationIdService.withIdAsync(async () => {
            await timeout(() => {
              assert.equal(correlationIdService.getId(), 'bar');
            }, duration);
          }, 'bar');
        }, duration);
        assert.equal(correlationIdService.getId(), 'foo');
      }, 'foo');
    });
  });

  function setSlowThreshold(context: Mocha.Context, expectedTestDuration: number) {
    // Cf. https://mochajs.org/#test-duration
    // 10: budgeted test case own processing time
    // ×2: for the estimation to sit around "slow/2" in Mocha scale (and no warning shows up)
    context.slow((expectedTestDuration + 10) * 2);
  }
});
