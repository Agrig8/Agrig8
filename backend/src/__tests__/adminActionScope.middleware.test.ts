/**
 * Issue #49 — Tests for requireAdminScope middleware.
 */

import { Request, Response, NextFunction } from "express";
import { requireAdminScope } from "../middleware/adminActionScope.middleware";

function makeReq(method: string): Request {
  return { method } as unknown as Request;
}

function makeRes() {
  const body: unknown[] = [];
  let statusCode = 200;
  const res: Partial<Response> = {
    status: jest.fn().mockImplementation((code: number) => { statusCode = code; return res as Response; }),
    json: jest.fn().mockImplementation((b: unknown) => { body.push(b); return res as Response; }),
  };
  return { res: res as Response, body, getStatus: () => statusCode };
}

function makeNext(): NextFunction {
  return jest.fn();
}

describe("requireAdminScope('write')", () => {
  it("calls next for POST", () => {
    const next = makeNext();
    const { res } = makeRes();
    requireAdminScope("write")(makeReq("POST"), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next for PUT", () => {
    const next = makeNext();
    const { res } = makeRes();
    requireAdminScope("write")(makeReq("PUT"), res, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next for PATCH", () => {
    const next = makeNext();
    const { res } = makeRes();
    requireAdminScope("write")(makeReq("PATCH"), res, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next for DELETE", () => {
    const next = makeNext();
    const { res } = makeRes();
    requireAdminScope("write")(makeReq("DELETE"), res, next);
    expect(next).toHaveBeenCalled();
  });

  it("responds 403 for GET on a write-scoped route", () => {
    const next = makeNext();
    const { res, getStatus } = makeRes();
    requireAdminScope("write")(makeReq("GET"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(getStatus()).toBe(403);
  });

  it("responds 403 for HEAD on a write-scoped route", () => {
    const next = makeNext();
    const { res, getStatus } = makeRes();
    requireAdminScope("write")(makeReq("HEAD"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(getStatus()).toBe(403);
  });
});

describe("requireAdminScope('read')", () => {
  it("calls next for GET", () => {
    const next = makeNext();
    const { res } = makeRes();
    requireAdminScope("read")(makeReq("GET"), res, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next for HEAD", () => {
    const next = makeNext();
    const { res } = makeRes();
    requireAdminScope("read")(makeReq("HEAD"), res, next);
    expect(next).toHaveBeenCalled();
  });

  it("responds 403 for POST on a read-scoped route", () => {
    const next = makeNext();
    const { res, getStatus } = makeRes();
    requireAdminScope("read")(makeReq("POST"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(getStatus()).toBe(403);
  });

  it("responds 403 for DELETE on a read-scoped route", () => {
    const next = makeNext();
    const { res, getStatus } = makeRes();
    requireAdminScope("read")(makeReq("DELETE"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(getStatus()).toBe(403);
  });
});

describe("requireAdminScope — scope annotation", () => {
  it("annotates req.adminScope with the declared scope", () => {
    const next = makeNext();
    const { res } = makeRes();
    const req = makeReq("POST");
    requireAdminScope("write")(req, res, next);
    expect((req as any).adminScope).toBe("write");
  });
});
