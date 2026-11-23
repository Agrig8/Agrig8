/**
 * Admin action scope enforcement (issue #49).
 *
 * Adds a lightweight scope layer on top of `adminMiddleware` so that
 * individual route handlers can declare the minimum access they need.
 * Currently we distinguish two scopes:
 *
 *   - "read"  — safe, idempotent inspection: GET / HEAD requests.
 *   - "write" — state-mutating operations: POST / PUT / PATCH / DELETE.
 *
 * Usage: add `requireAdminScope("write")` *after* `adminMiddleware` on any
 * route that mutates state.
 *
 * ```ts
 * router.post(
 *   "/api/admin/contract/mediators",
 *   authMiddleware,
 *   adminMiddleware,
 *   requireAdminScope("write"),
 *   ...
 * )
 * ```
 *
 * The scope check deliberately rejects the request (403) rather than
 * silently allowing it, so a misconfigured route fails loudly.
 */

import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../services/auth.service";

export type AdminActionScope = "read" | "write";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Returns a middleware that aborts with 403 when the HTTP method does not
 * match the declared scope.
 */
export function requireAdminScope(scope: AdminActionScope) {
  return function adminActionScopeMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const method = req.method.toUpperCase();
    if (scope === "write" && !WRITE_METHODS.has(method)) {
      res.status(403).json({
        code: "ADMIN_SCOPE_MISMATCH",
        error: `Forbidden: route requires 'write' scope but received ${method}`,
      });
      return;
    }
    if (scope === "read" && !READ_METHODS.has(method)) {
      res.status(403).json({
        code: "ADMIN_SCOPE_MISMATCH",
        error: `Forbidden: route requires 'read' scope but received ${method}`,
      });
      return;
    }
    // Annotate the request so downstream handlers can see it was scope-checked.
    (req as AuthRequest & { adminScope?: AdminActionScope }).adminScope = scope;
    next();
  };
}
