import { env } from "cloudflare:test";
import { describe, expect, test, vi } from "vitest";
import app from "./index";
import { ProjectRepository } from "./repositories/project_repository";

describe("Workers Cache policy", () => {
  test.each([
    ["/v1/places", "GET", 200],
    ["/openapi.json", "GET", 200],
    ["/missing", "GET", 404],
    ["/v1/projects", "POST", 404],
    ["/v1/projects", "OPTIONS", 204],
    ["/admin/v1/projects", "GET", 401],
  ])("does not cache %s (%s)", async (path, method, status) => {
    const res = await app.request(path, { method }, env);

    expect(res.status).toBe(status);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test.each([
    ["/v1/projects", "list"],
    ["/v1/projects/g1", "get"],
  ] as const)(
    "does not cache database failures at %s",
    async (path, method) => {
      const query = vi
        .spyOn(ProjectRepository.prototype, method)
        .mockRejectedValueOnce(new Error("Database unavailable"));
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        const res = await app.request(path, undefined, env);

        expect(res.status).toBe(500);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
      } finally {
        query.mockRestore();
        error.mockRestore();
      }
    },
  );
});
