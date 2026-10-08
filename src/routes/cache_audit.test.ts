import { env } from "cloudflare:test";
import { cache } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import app from "../index";
import { DEV_BYPASS_VALUE } from "../middleware/access";
import type { Project } from "../models/project";
import { ProjectDetailsRepository } from "../repositories/project_details_repository";
import { ProjectRepository } from "../repositories/project_repository";

// 07aa0f1 の仕様監査。障害系は、未解決の挙動を再現するためのテスト。
// このファイルの成功は「障害から回復できる」という意味ではない。
const repository = new ProjectRepository(env.DB);
const detailsRepository = new ProjectDetailsRepository(env.DB);
const purge = vi.mocked(cache.purge);
const invalidate = vi.mocked(cache.invalidate);
const project: Project = {
  id: "audit-1",
  type: "general",
  groupName: "監査用団体",
  projectName: "監査用企画",
  description: "更新前",
  isChildFriendly: false,
  isRecommended: false,
  occasions: [],
  tag: [],
};
const failed = {
  success: false,
  errors: [{ code: 429, message: "rate limited" }],
};

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

describe("キャッシュ仕様の監査対象", () => {
  test("全11書き込み経路と全4取得経路を列挙できている", () => {
    const methods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    const writes = [
      ...new Set(
        app.routes
          .filter((route) => methods.has(route.method))
          .map((route) => `${route.method} ${route.path}`),
      ),
    ].sort();
    expect(writes).toEqual(
      [
        "POST /admin/v1/projects",
        "POST /admin/v1/projects/bulk",
        "PUT /admin/v1/projects/:projectId",
        "PATCH /admin/v1/projects/:projectId/description",
        "DELETE /admin/v1/projects/:projectId",
        "PUT /admin/v1/projects/:projectId/icon",
        "DELETE /admin/v1/projects/:projectId/icon",
        "PUT /admin/v1/projects/:projectId/details/menu",
        "DELETE /admin/v1/projects/:projectId/details/menu",
        "PUT /admin/v1/projects/:projectId/details/additionalInfo",
        "DELETE /admin/v1/projects/:projectId/details/additionalInfo",
      ].sort(),
    );
    const reads = [
      ...new Set(
        app.routes
          .filter(
            (route) =>
              route.method === "GET" && route.path.startsWith("/v1/projects"),
          )
          .map((route) => route.path),
      ),
    ].sort();
    expect(reads).toEqual(
      [
        "/v1/projects",
        "/v1/projects/:projectId",
        "/v1/projects/:projectId/details",
        "/v1/projects/:projectId/icon",
      ].sort(),
    );
  });

  test("企画PUTは詳細を変更せず、一覧と単体のETagを更新する", async () => {
    await repository.create(project);
    await detailsRepository.save(project.id, {
      additionalInfo: "変更しない詳細",
    });
    const paths = [
      "/v1/projects?tag=experience",
      `/v1/projects/${project.id}`,
      `/v1/projects/${project.id}/details`,
    ];
    const before = await Promise.all(
      paths.map((path) => app.request(path, undefined, env)),
    );
    const res = await write(`/${project.id}`, "PUT", {
      ...project,
      description: "更新後",
    });
    expect(res.status).toBe(200);
    const after = await Promise.all(
      paths.map((path, i) =>
        app.request(
          path,
          {
            headers: { "If-None-Match": before[i].headers.get("ETag")! },
          },
          env,
        ),
      ),
    );
    expect(after.map((response) => response.status)).toEqual([200, 200, 304]);
    expect(purge).toHaveBeenCalledExactlyOnceWith({
      tags: ["projects-audit-1"],
    });
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      tags: ["projects-query"],
    });
  });

  test("メニューPUTは詳細だけを変更し、他企画と一覧のETagを維持する", async () => {
    await repository.create(project);
    await repository.create({ ...project, id: "audit-2" });
    await detailsRepository.save(project.id, {});
    await detailsRepository.save("audit-2", {});
    const paths = [
      "/v1/projects",
      `/v1/projects/${project.id}`,
      `/v1/projects/${project.id}/details`,
      "/v1/projects/audit-2/details",
    ];
    const before = await Promise.all(
      paths.map((path) => app.request(path, undefined, env)),
    );
    const res = await write(`/${project.id}/details/menu`, "PUT", {
      items: [],
      description: "更新後",
    });
    expect(res.status).toBe(204);
    const after = await Promise.all(
      paths.map((path, i) =>
        app.request(
          path,
          {
            headers: { "If-None-Match": before[i].headers.get("ETag")! },
          },
          env,
        ),
      ),
    );
    expect(after.map((response) => response.status)).toEqual([
      304, 304, 200, 304,
    ]);
    expect(purge).toHaveBeenCalledExactlyOnceWith({
      tags: ["projects-audit-1-details"],
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("既知の反例: キャッシュ操作失敗後の再試行", () => {
  test.each(["", "/bulk"])(
    "POST %s の再試行は409で、invalidateを再実行しない",
    async (path) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      invalidate.mockResolvedValueOnce(failed);
      const body = path === "" ? project : [project];

      const first = await write(path, "POST", body);
      expect(first.status).toBe(500);
      expect(await repository.get(project.id)).toEqual(project);
      expect(invalidate).toHaveBeenCalledOnce();

      const retry = await write(path, "POST", body);
      expect(retry.status).toBe(409);
      expect(invalidate).toHaveBeenCalledOnce();
      // mock の既定値は成功に戻っているが、再試行はそこに到達しない。
    },
  );

  test("DELETE の再試行は404で、失敗したpurgeを再実行しない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await repository.create(project);
    await detailsRepository.save(project.id, { additionalInfo: "削除対象" });
    purge.mockResolvedValueOnce(failed);

    const first = await write(`/${project.id}`, "DELETE");
    expect(first.status).toBe(500);
    expect(await repository.get(project.id)).toBeNull();
    expect(await detailsRepository.get(project.id)).toBeNull();
    expect(purge).toHaveBeenCalledExactlyOnceWith({
      tags: ["projects-audit-1", "projects-audit-1-details"],
    });

    const retry = await write(`/${project.id}`, "DELETE");
    expect(retry.status).toBe(404);
    expect(purge).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledOnce();
  });
});

describe("証明の境界: 進行中のGETと更新の競合", () => {
  test("purge受付後に古い本文を持つキャッシュ可能なGET応答が完了し得る", async () => {
    await repository.create(project);
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const originalGet = ProjectRepository.prototype.get;
    vi.spyOn(ProjectRepository.prototype, "get").mockImplementationOnce(
      async function (this: ProjectRepository, id) {
        const snapshot = await originalGet.call(this, id);
        started.resolve();
        await release.promise;
        return snapshot;
      },
    );

    const pending = app.request(`/v1/projects/${project.id}`, undefined, env);
    await started.promise;
    try {
      const updated = await write(`/${project.id}`, "PUT", {
        ...project,
        description: "更新後",
      });
      expect(updated.status).toBe(200);
      expect(purge).toHaveBeenCalledOnce();
    } finally {
      release.resolve();
    }

    const lateResponse = await pending;
    expect(lateResponse.status).toBe(200);
    expect(await lateResponse.json()).toEqual(project);
    expect(lateResponse.headers.get("Cache-Control")).toContain(
      "s-maxage=86400",
    );
    const fresh = await app.request(
      `/v1/projects/${project.id}`,
      undefined,
      env,
    );
    expect((await fresh.json<Project>()).description).toBe("更新後");
    // 実際に古い応答が edge に保存されるかは、Cloudflare 側の競合処理次第。
  });
});
