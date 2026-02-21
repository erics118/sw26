import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseBody, validationError, dbError, notFound } from "./helpers";

describe("dbError", () => {
  it("returns status 500", () => {
    const res = dbError("connection refused");
    expect(res.status).toBe(500);
  });

  it("returns the message in the error field", async () => {
    const res = dbError("connection refused");
    const body = await res.json();
    expect(body).toEqual({ error: "connection refused" });
  });
});

describe("notFound", () => {
  it("returns status 404", () => {
    const res = notFound("Client");
    expect(res.status).toBe(404);
  });

  it("returns '<resource> not found' in the error field", async () => {
    const res = notFound("Client");
    const body = await res.json();
    expect(body).toEqual({ error: "Client not found" });
  });

  it("interpolates any resource name", async () => {
    const res = notFound("Aircraft");
    const body = await res.json();
    expect(body).toEqual({ error: "Aircraft not found" });
  });
});

describe("validationError", () => {
  it("returns status 400", () => {
    const schema = z.object({ name: z.string(), count: z.number() });
    const result = schema.safeParse({ name: 42, count: "oops" });
    if (result.success) throw new Error("expected failure");
    const res = validationError(result.error);
    expect(res.status).toBe(400);
  });

  it("joins multiple issue messages with ', '", async () => {
    // Two type errors → two issues → joined with ", "
    const schema = z.object({ name: z.string(), count: z.number() });
    const result = schema.safeParse({ name: 42, count: "oops" });
    if (result.success) throw new Error("expected failure");
    const res = validationError(result.error);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error).toContain(", ");
  });

  it("returns a single issue message verbatim", async () => {
    const schema = z.object({ x: z.string().min(3, "Too short") });
    const result = schema.safeParse({ x: "ab" });
    if (result.success) throw new Error("expected failure");
    const res = validationError(result.error);
    const body = await res.json();
    expect(body.error).toBe("Too short");
  });

  it("body has an 'error' string key", async () => {
    const schema = z.object({ n: z.number() });
    const result = schema.safeParse({ n: "wrong" });
    if (result.success) throw new Error("expected failure");
    const body = await validationError(result.error).json();
    expect(Object.keys(body)).toEqual(["error"]);
    expect(typeof body.error).toBe("string");
  });
});

describe("parseBody", () => {
  it("returns [body, null] for valid JSON", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });
    const [body, err] = await parseBody(req);
    expect(err).toBeNull();
    expect(body).toEqual({ foo: "bar" });
  });

  it("returns [null, 400 response] for invalid JSON", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const [body, err] = await parseBody(req);
    expect(body).toBeNull();
    expect(err).not.toBeNull();
    expect(err!.status).toBe(400);
    const errBody = await err!.json();
    expect(errBody).toEqual({ error: "Invalid JSON" });
  });
});
