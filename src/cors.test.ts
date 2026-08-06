import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { SQUARE_PNG } from "../test/icon_fixtures";
import app from "./index";
import { IconRepository } from "./repositories/icon_repository";

const ORIGIN = "https://example.com";

describe("CORS", () => {
  test.each(["/v1/places", "/v1/projects", "/openapi.json"])(
    "allows any origin to read %s",
    async (path) => {
      const res = await app.request(path, { headers: { Origin: ORIGIN } }, env);

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    },
  );

  test("exposes ETag on icon responses so clients can revalidate", async () => {
    await new IconRepository(env.ICON_BUCKET).save(
      "p1",
      new Blob([SQUARE_PNG], { type: "image/png" }),
    );

    const res = await app.request(
      "/v1/projects/p1/icon",
      { headers: { Origin: ORIGIN } },
      env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).not.toBeNull();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("ETag");
  });

  test("answers preflight for conditional icon requests", async () => {
    const res = await app.request(
      "/v1/projects/1/icon",
      {
        method: "OPTIONS",
        headers: {
          Origin: ORIGIN,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "If-None-Match",
        },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "If-None-Match",
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  // 書き込み系はブラウザから直接叩かせない。CORS を付けないことで、
  // 万一トークンが漏れてもオリジン越しには読めない。
  test("does not send CORS headers for admin routes", async () => {
    const res = await app.request(
      "/admin/v1/projects",
      { headers: { Origin: ORIGIN } },
      env,
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
