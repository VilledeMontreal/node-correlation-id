import * as express from 'express';
import httpHeaderFieldsTyped from 'http-header-fields-typed';
import { constants } from '../config/constants';
import { correlationIdService } from '../services/correlationIdService';

/**
 * Correlation ID Middleware
 *
 * @param filter a filter which is going to be called with the request to see if a
 * colleration id scope must be managed or not.
 */
export let createCorrelationIdMiddleware = (
  filter?: (req: express.Request) => boolean
): ((req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>) => {
  const correlationIdMiddleware = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    if (filter && !filter(req)) {
      next();
    } else {
      // ==========================================
      // If a Correlation ID (cid) exists in the request
      // it will be used. Otherwise, a new one is created.
      //
      // We add the cid to the response!
      // ==========================================
      let correlationId = req.get(httpHeaderFieldsTyped.X_CORRELATION_ID);
      if (!correlationId) {
        correlationId = correlationIdService.createNewId();
        req[constants.requestExtraVariables.cidNew] = correlationId;
      } else {
        req[constants.requestExtraVariables.cidReceivedInRequest] = correlationId;
      }
      if (!res.headersSent) {
        res.set(httpHeaderFieldsTyped.X_CORRELATION_ID, correlationId);
      }
      correlationIdService.withId(next, correlationId);
    }
    return null;
  };

  return correlationIdMiddleware;
};
