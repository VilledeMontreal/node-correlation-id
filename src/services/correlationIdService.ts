import { AsyncLocalStorage } from 'async_hooks';
import * as cls from 'cls-hooked';
import { EventEmitter } from 'events';
import * as express from 'express';
import * as semver from 'semver';
import { v4 as uuid } from 'uuid';
import { constants } from '../config/constants';
const oldEmitSlot = Symbol('kOriginalEmit');
const cidSlot = Symbol('kCorrelationId');
const storeSlot = Symbol('kCidStore');

/**
 * CorrelationId type
 */
export type CorrelationId = string;

/**
 * Informations about the correlation ID.
 */
export interface ICidInfo {
  /**
   * Current cid
   */
  current: string;

  /**
   * Cid received in the request (may be undefined)
   */
  receivedInRequest: string;

  /**
   * Cid generated (may be undefined)
   */
  generated: string;
}

/**
 * CorrelationId service
 */
export interface ICorrelationIdService {
  /**
   * Creates a new correlation ID that can then be passed to the
   * "withId()" function.
   */
  createNewId(): CorrelationId;

  /**
   * Executes a function inside a context where the correlation ID is defined.
   *
   * @param work the function to run within the cid context.
   * @param cid the correlation ID to use.
   *
   */
  withId<T>(work: () => T, cid?: CorrelationId): T;

  /**
   * Executes a function inside a context where the correlation ID is defined.
   * This is the promisified version of the `withId` method.
   * @param work a callback to invoke with the submitted correlation ID
   * @param cid the correlation ID to install be before invoking the submitted callback
   *
   * @deprecated `#withId` is preferable instead: if the wrapped operation
   * is asynchronous it will still be properly scoped (correlation context) and
   * can safely be awaited for outside of `#withId`.
   */
  withIdAsync<T>(work: () => Promise<T>, cid?: string): Promise<T>;

  /**
   * binds the current correlation context to the target
   * @param target the target to bind to
   * @returns either the submitted target (if it is an emitter) or a wrapped target (for a function)
   * @remarks you might have to bind to an emitter in order to maitain
   * the correlation context.
   */
  bind<T>(target: T): T;

  /**
   * Returns the correlation ID from the current context
   */
  getId(): CorrelationId;

  /**
   * Returns all correlation ID info
   */
  getCidInfo(req: express.Request): ICidInfo;
}

/**
 * CorrelationId service
 */
class CorrelationIdServiceWithClsHooked implements ICorrelationIdService {
  private store: cls.Namespace = cls.createNamespace('343c9880-fa2b-4212-a9f3-15f3cc09581d');

  public createNewId(): CorrelationId {
    return uuid();
  }

  public withId<T>(work: () => T, cid?: CorrelationId): T {
    let cidClean = cid;
    if (!cidClean) {
      cidClean = this.createNewId();
    }

    return this.store.runAndReturn(() => {
      this.store.set('correlator', cidClean);
      return work();
    });
  }

  public async withIdAsync<T>(work: () => Promise<T>, cid?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.withId(() => {
        try {
          work().then(resolve).catch(reject);
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(err);
        }
      }, cid);
    });
  }

  public bind<T>(target: T): T {
    if (target instanceof EventEmitter) {
      return this.bindEmitter(target);
    }
    if (typeof target === 'function') {
      return this.bindFunction(target);
    }
    return target;
  }

  public getId() {
    return this.store.get('correlator');
  }

  public getCidInfo(req: express.Request): ICidInfo {
    return {
      current: this.getId(),
      receivedInRequest: req[constants.requestExtraVariables.cidReceivedInRequest],
      generated: req[constants.requestExtraVariables.cidNew],
    };
  }

  private bindEmitter<T extends EventEmitter>(emitter: T): T {
    // Note that we can't use the following line:
    //   this.store.bindEmitter(emitter);
    // because this works only if bindEmitter is called before any
    // call to the "on" method of the emitter, and I don't want to
    // risk having ordering issues.
    // Note however that patching an emitter might not work in 100% cases.
    // patch emit method only once!
    if (!emitter[oldEmitSlot]) {
      emitter[oldEmitSlot] = emitter.emit;
      (emitter as any).emit = (...args: any[]) => {
        // wrap the emit call within a new correlation context
        // with the bound cid.
        this.withId(() => {
          // invoke original emit method
          emitter[oldEmitSlot].apply(emitter, args);
        }, emitter[cidSlot]);
      };
    }
    // update the cid bound to the emitter
    emitter[cidSlot] = this.getId();
    return emitter;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private bindFunction<T extends Function>(target: T): T {
    return this.store.bind(target);
  }
}

interface AsyncLocalStorageData {
  correlationId?: string;
}

class CorrelationIdServiceWithAsyncLocalStorage implements ICorrelationIdService {
  private storage = new AsyncLocalStorage<AsyncLocalStorageData>();

  public createNewId(): CorrelationId {
    return uuid();
  }

  public withId<T>(work: () => T, cid?: CorrelationId): T {
    const correlationId = cid || this.createNewId();
    return this.storage.run({ correlationId }, work);
  }

  public async withIdAsync<T>(work: () => Promise<T>, cid?: string): Promise<T> {
    return this.withId(work, cid);
  }

  public bind<T>(target: T): T {
    if (target instanceof EventEmitter) {
      return this.bindEmitter(target);
    }
    if (typeof target === 'function') {
      return this.bindFunction(target);
    }
    return target;
  }

  public getId() {
    const store = this.storage.getStore();
    if (store) {
      return store.correlationId;
    }
    return undefined;
  }

  public getCidInfo(req: express.Request): ICidInfo {
    return {
      current: this.getId(),
      receivedInRequest: req[constants.requestExtraVariables.cidReceivedInRequest],
      generated: req[constants.requestExtraVariables.cidNew],
    };
  }

  private bindEmitter<T extends EventEmitter>(emitter: T): T {
    // patch emit method only once!
    if (!emitter[oldEmitSlot]) {
      emitter[oldEmitSlot] = emitter.emit;
      (emitter as any).emit = (...args: any[]) => {
        // use the store that was bound to this emitter
        const store = emitter[storeSlot];
        if (store) {
          this.storage.enterWith(store);
        }
        // invoke original emit method
        emitter[oldEmitSlot].call(emitter, ...args);
      };
    }
    // update the store bound to the emitter
    emitter[storeSlot] = this.storage.getStore();
    return emitter;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private bindFunction<T extends Function>(target: T): T {
    const storage = this.storage;
    const store = this.storage.getStore();
    return function (...args: any[]) {
      storage.enterWith(store);
      return target.call(this, ...args);
    } as any;
  }
}

function canUseAsyncLocalStorage() {
  return semver.satisfies(process.versions.node, '>=13.10.0') && !!AsyncLocalStorage;
}

export const correlationIdService: ICorrelationIdService = canUseAsyncLocalStorage()
  ? new CorrelationIdServiceWithAsyncLocalStorage()
  : new CorrelationIdServiceWithClsHooked();
