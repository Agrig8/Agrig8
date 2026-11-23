/**
 * Issue #46 — Retry classification middleware.
 *
 * Intercepts `ClassifiedServiceError` instances thrown by Stellar, IPFS,
 * database, and cache service calls and enriches the HTTP response with
 * machine-readable retry guidance before the generic error handler fires:
 *
 *   - `X-Retryable: true | false`  — explicit signal for clients and gateways.
 *   - `Retry-After: <seconds>`      — added only for retryable responses whose
 *     status is 429 or 503; otherwise the signal is implicit in the status.
 *
 * Place this middleware **before** the generic `errorHandler` in the Express
 * stack so it can annotate responses while they still flow through the
 * middleware chain.
 */

import { NextFunction, Request, Response } from "express";
import { ClassifiedServiceError } from "../errors/service.errors";

/** Default retry delay in seconds for 429 / 503 retryable errors. */
const DEFAULT_RETRY_AFTER_SECONDS = 5;

export function retryClassificationMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof ClassifiedServiceError) {
    res.setHeader("X-Retryable", err.retryable ? "true" : "false");

    if (err.retryable && (err.statusCode === 429 || err.statusCode === 503)) {
      res.setHeader("Retry-After", String(DEFAULT_RETRY_AFTER_SECONDS));
    }
  }

  next(err);
}
