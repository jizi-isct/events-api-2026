import { env } from "cloudflare:test";
import { cache } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import app from "../index";
import { DEV_BYPASS_VALUE } from "../middleware/access";
import type { Project } from "../models/project";
import { ProjectDetailsRepository } from "../repositories/project_details_repository";
import { ProjectRepository } from "../repositories/project_repository";

const repository = new ProjectRepository(env.DB);
const detailsRepository = new ProjectDetailsRepository(env.DB);
const project: Project = {
  id: "g1",
  type: "general",
  groupName: "サークルA",
  projectName: "実験教室",
  description: "説明",
  isChildFriendly: true,
  isRecommended: false,
  occasions: [],
  tag: ["experience"],
};
const menu = { items: [], description: "メニュー" };
const cacheControl = "public, max-age=0, s-maxage=86400, must-revalidate";
const purge = vi.mocked(cache.purge);
const invalidate = vi.mocked(cache.invalidate);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM projects").run();
  purge.mockReset().mockResolvedValue({ success: true, errors: [] });
  invalidate.mockReset().mockResolvedValue({ success: true, errors: [] });
});

afterEach(() => vi.restoreAllMocks());

const write = (path: string, method: string, body?: unknown) =>
  app.request(
    `/admin/v1/projects${path}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { ...env, ACCESS_DEV_BYPASS: DEV_BYPASS_VALUE },
  );

describe("Workers Cache の応答", () => {
  test.each([
    ["/v1/projects", "projects-query"],
    ["/v1/projects?tag=experience", "projects-query"],
    ["/v1/projects?tag=food", "projects-query"],
    ["/v1/projects/g1", "projects-g1"],
    ["/v1/projects/g1/details", "projects-g1-details"],
  ])("%s に24時間の TTL とタグを設定する", async (path, tag) => {
    await repository.create(project);
    await detailsRepository.saveMenu(project.id, menu);

    const res = await app.request(path, undefined, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(cacheControl);
    expect(res.headers.get("Cache-Tag")).toBe(tag);
    expect(res.headers.get("ETag")).not.toBeNull();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("一覧が未変更なら304、変更後は新しいETagと本文を返す", async () => {
    const first = await app.request(
      "/v1/projects?tag=experience",
      undefined,
      env,
    );
    const etag = first.headers.get("ETag")!;
    const init = { headers: { "If-None-Match": etag } };
    const unchanged = await app.request(
      "/v1/projects?tag=experience",
      init,
      env,
    );

    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe("");
    expect(unchanged.headers.get("ETag")).toBe(etag);
    expect(unchanged.headers.get("Cache-Control")).toBe(cacheControl);
    expect(unchanged.headers.get("Cache-Tag")).toBe("projects-query");
    expect(unchanged.headers.get("Access-Control-Allow-Origin")).toBe("*");

    expect((await write("", "POST", project)).status).toBe(201);
    const changed = await app.request("/v1/projects?tag=experience", init, env);
    expect(changed.status).toBe(200);
    expect(changed.headers.get("ETag")).not.toBe(etag);
    expect(await changed.json()).toEqual([project]);
  });

  test.each([
    ["/v1/projects/missing", 404],
    ["/v1/projects/missing/details", 404],
    ["/v1/projects/missing/icon", 404],
    ["/v1/places", 200],
    ["/openapi.json", 200],
    ["/admin/v1/projects", 401],
    ["/missing", 404],
  ])("対象外の %s は保存しない", async (path, status) => {
    const res = await app.request(path, undefined, env);
    expect(res.status).toBe(status);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Cache-Tag")).toBeNull();
  });

  test("存在しない企画への条件付きリクエストも404のまま返す", async () => {
    const res = await app.request(
      "/v1/projects/missing",
      { headers: { "If-None-Match": "*" } },
      env,
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("HEAD はGETと同じキャッシュ情報を本文なしで返す", async () => {
    const get = await app.request("/v1/projects", undefined, env);
    const head = await app.request("/v1/projects", { method: "HEAD" }, env);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(head.headers.get("Cache-Control")).toBe(cacheControl);
    expect(head.headers.get("Cache-Tag")).toBe("projects-query");
    expect(head.headers.get("ETag")).toBe(get.headers.get("ETag"));
  });

  test("ASCII以外のIDでも取得と更新のタグを揃える", async () => {
    const id = "企画 A,B";
    const encoded = encodeURIComponent(id);
    await repository.create({ ...project, id });
    const res = await app.request(`/v1/projects/${encoded}`, undefined, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Tag")).toBe(`projects-${encoded}`);
    expect((await write(`/${encoded}`, "PUT", { ...project, id })).status).toBe(
      200,
    );
    expect(purge).toHaveBeenCalledWith({ tags: [`projects-${encoded}`] });
  });

  test("タグの上限を超えるIDの応答は保存しない", async () => {
    const id = "a".repeat(1024);
    await repository.create({ ...project, id });
    const res = await app.request(`/v1/projects/${id}`, undefined, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Cache-Tag")).toBeNull();
  });
});

describe("書き込み後のキャッシュ無効化", () => {
  test("ローカルのようにWorkers Cacheが無効な環境でも書き込める", async () => {
    const original = cache.purge;
    Object.assign(cache, { purge: undefined });
    try {
      expect((await write("", "POST", project)).status).toBe(201);
      expect((await write("/g1", "PUT", project)).status).toBe(200);
      expect((await write("/g1/details/menu", "PUT", menu)).status).toBe(204);
      expect(purge).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
    } finally {
      Object.assign(cache, { purge: original });
    }
  });

  test.each(["", "/bulk"])(
    "登録 %s の保存完了後に一覧を invalidate する",
    async (path) => {
      invalidate.mockImplementationOnce(async () => {
        expect(await repository.get(project.id)).toEqual(project);
        return { success: true, errors: [] };
      });
      const res = await write(path, "POST", path === "" ? project : [project]);
      expect(res.status).toBe(201);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(invalidate).toHaveBeenCalledExactlyOnceWith({
        tags: ["projects-query"],
      });
      expect(purge).not.toHaveBeenCalled();
    },
  );

  test.each(["PUT", "PATCH", "DELETE"])(
    "%s は企画を purge し一覧を invalidate する",
    async (method) => {
      await repository.create(project);
      await detailsRepository.saveMenu(project.id, menu);
      const path = method === "PATCH" ? "/g1/description" : "/g1";
      const body =
        method === "PUT"
          ? { ...project, description: "変更後" }
          : method === "PATCH"
            ? { description: "変更後" }
            : undefined;
      purge.mockImplementationOnce(async () => {
        const stored = await repository.get(project.id);
        if (method === "DELETE") {
          expect(stored).toBeNull();
          expect(await detailsRepository.get(project.id)).toBeNull();
        } else {
          expect(stored?.description).toBe("変更後");
        }
        return { success: true, errors: [] };
      });

      const res = await write(path, method, body);
      expect(res.status).toBe(method === "DELETE" ? 204 : 200);
      expect(purge).toHaveBeenCalledExactlyOnceWith({
        tags:
          method === "DELETE"
            ? ["projects-g1", "projects-g1-details"]
            : ["projects-g1"],
      });
      expect(invalidate).toHaveBeenCalledExactlyOnceWith({
        tags: ["projects-query"],
      });
    },
  );

  test.each([
    ["menu", "PUT", menu],
    ["menu", "DELETE", undefined],
    ["additionalInfo", "PUT", "追加情報"],
    ["additionalInfo", "DELETE", undefined],
  ])("%s の %s は詳細だけを purge する", async (field, method, body) => {
    await repository.create(project);
    const res = await write(`/g1/details/${field}`, method as string, body);
    expect(res.status).toBe(204);
    expect(purge).toHaveBeenCalledExactlyOnceWith({
      tags: ["projects-g1-details"],
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  test.each([
    ["", "POST", {}, 400],
    ["", "POST", project, 409],
    ["/missing", "PUT", { ...project, id: "missing" }, 404],
    ["/missing", "DELETE", undefined, 404],
    ["/g1/details/menu", "PUT", { items: "invalid" }, 400],
    ["/missing/details/menu", "DELETE", undefined, 404],
  ])("失敗した %s %s は無効化しない", async (path, method, body, status) => {
    await repository.create(project);
    const res = await write(path as string, method as string, body);
    expect(res.status).toBe(status);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(purge).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  test("未認証の書き込みでは無効化しない", async () => {
    const res = await app.request(
      "/admin/v1/projects/g1",
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  test("DB書き込みに失敗したら無効化しない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(ProjectRepository.prototype, "create").mockRejectedValueOnce(
      new Error("DB unavailable"),
    );
    const res = await write("", "POST", project);
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(purge).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  test.each(["purge", "invalidate"])(
    "%s の失敗を成功として返さない",
    async (method) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      await repository.create(project);
      const operation = method === "purge" ? purge : invalidate;
      operation.mockResolvedValueOnce({
        success: false,
        errors: [{ code: 429, message: "rate limited" }],
      });
      const res = await write("/g1", "PUT", {
        ...project,
        description: "保存済み",
      });
      expect(res.status).toBe(500);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect((await repository.get(project.id))?.description).toBe("保存済み");
    },
  );
});
