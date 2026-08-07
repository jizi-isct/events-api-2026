import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import * as v from "valibot";
import app from "../index";
import { ProjectSchema, type Project } from "../models/project";
import {
  type ProjectDetails,
  ProjectDetailsSchema,
} from "../models/project_details";
import { ProjectDetailsRepository } from "../repositories/project_details_repository";
import { ProjectRepository } from "../repositories/project_repository";

const db = env.DB;
const iconBucket = env.ICON_BUCKET;
const repository = new ProjectRepository(db);
const detailsRepository = new ProjectDetailsRepository(db);

const general: Project = {
  id: "g1",
  type: "general",
  groupName: "サークルA",
  projectName: "ミニ実験教室",
  description: "説明",
  isChildFriendly: true,
  isRecommended: false,
  occasions: [
    {
      place: "south.s3.s3-206",
      timeRange: {
        start: { date: 1, hour: 10, minute: 0 },
        end: { date: 1, hour: 16, minute: 30 },
      },
    },
  ],
  tag: ["experience"],
};

const laboratory: Project = {
  id: "l1",
  type: "laboratory",
  groupName: "研究室C",
  projectName: "ロボティクス研究室公開",
  description: "説明",
  isChildFriendly: true,
  isRecommended: true,
  occasions: [],
  isTour: true,
};

const details: ProjectDetails = {
  additionalInfo: "整理券は10時から配布します。",
  menu: {
    items: [
      {
        name: "クレープ",
        price: 500,
        options: [{ name: "アイス追加", price: 100 }],
      },
    ],
    description: "売り切れ次第終了します。",
  },
};

beforeEach(async () => {
  await db.prepare(`DELETE FROM projects`).run();

  let listed = await iconBucket.list();

  while (true) {
    await iconBucket.delete(listed.objects.map((object) => object.key));

    if (!listed.truncated) {
      break;
    }

    listed = await iconBucket.list({ cursor: listed.cursor });
  }
});

describe("GET /v1/projects", () => {
  test("returns an empty list when nothing is registered", async () => {
    const res = await app.request("/v1/projects", undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("returns all registered projects", async () => {
    await repository.create(general);
    await repository.create(laboratory);

    const res = await app.request("/v1/projects", undefined, env);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Project[];
    expect(v.safeParse(v.array(ProjectSchema), body).success).toBe(true);
    expect(body).toEqual([general, laboratory]);
  });
});

describe("GET /v1/projects/:projectId", () => {
  test("returns the requested project", async () => {
    await repository.create(general);

    const res = await app.request("/v1/projects/g1", undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(general);
  });

  test("returns 404 for an unknown ID", async () => {
    const res = await app.request("/v1/projects/unknown", undefined, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      message: "Unknown project ID: unknown",
    });
  });

  test("does not confuse projects with one another", async () => {
    await repository.create(general);
    await repository.create(laboratory);

    const res = await app.request("/v1/projects/l1", undefined, env);

    expect(await res.json()).toEqual(laboratory);
  });
});

describe("GET /v1/projects/:projectId/details", () => {
  test("企画詳細情報を返す", async () => {
    await repository.create(general);
    await detailsRepository.save("g1", details);

    const res = await app.request("/v1/projects/g1/details", undefined, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(v.safeParse(ProjectDetailsSchema, body).success).toBe(true);
    expect(body).toEqual(details);
  });

  test("保存済みの空の詳細情報を返す", async () => {
    await repository.create(general);
    await detailsRepository.save("g1", {});

    const res = await app.request("/v1/projects/g1/details", undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  test("詳細情報が未登録なら 404", async () => {
    await repository.create(general);

    const res = await app.request("/v1/projects/g1/details", undefined, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      message: "Project details not found: g1",
    });
  });

  test("存在しない企画 ID なら 404", async () => {
    const res = await app.request(
      "/v1/projects/unknown/details",
      undefined,
      env,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      message: "Project details not found: unknown",
    });
  });
});

describe("GET /v1/projects/:projectId/icon", () => {
  test("returns the requested project icon with its HTTP metadata", async () => {
    await repository.create(general);
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await iconBucket.put("g1/original", body, {
      httpMetadata: { contentType: "image/png" },
    });

    const res = await app.request("/v1/projects/g1/icon", undefined, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Length")).toBe(body.byteLength.toString());
    expect(res.headers.get("ETag")).toMatch(/^".+"$/);
    expect(res.headers.get("Last-Modified")).not.toBeNull();
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(body);
  });

  test("returns 304 when If-None-Match matches the current icon", async () => {
    await repository.create(general);
    await iconBucket.put("g1/original", "icon", {
      httpMetadata: { contentType: "image/png" },
    });
    const stored = await iconBucket.head("g1/original");

    const res = await app.request(
      "/v1/projects/g1/icon",
      { headers: { "If-None-Match": stored!.httpEtag } },
      env,
    );

    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe(stored?.httpEtag);
    expect(res.headers.get("Last-Modified")).not.toBeNull();
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(await res.text()).toBe("");
  });

  test("returns 304 when If-Modified-Since matches the current icon", async () => {
    await repository.create(general);
    await iconBucket.put("g1/original", "icon", {
      httpMetadata: { contentType: "image/png" },
    });
    const stored = await iconBucket.head("g1/original");

    const res = await app.request(
      "/v1/projects/g1/icon",
      { headers: { "If-Modified-Since": stored!.uploaded.toUTCString() } },
      env,
    );

    expect(res.status).toBe(304);
    expect(res.headers.get("Last-Modified")).toBe(
      stored?.uploaded.toUTCString(),
    );
  });

  test("returns the new icon when If-None-Match refers to an overwritten icon", async () => {
    await iconBucket.put("g1/original", "old", {
      httpMetadata: { contentType: "image/png" },
    });
    const oldIcon = await iconBucket.head("g1/original");
    await iconBucket.put("g1/original", "current", {
      httpMetadata: { contentType: "image/webp" },
    });
    const currentIcon = await iconBucket.head("g1/original");

    const res = await app.request(
      "/v1/projects/g1/icon",
      { headers: { "If-None-Match": oldIcon!.httpEtag } },
      env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("ETag")).toBe(currentIcon?.httpEtag);
    expect(currentIcon?.httpEtag).not.toBe(oldIcon?.httpEtag);
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe("current");
  });

  test("returns 404 when the project has no icon", async () => {
    await repository.create(general);

    const res = await app.request("/v1/projects/g1/icon", undefined, env);

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      message: "Icon not found for project ID: g1",
    });
  });

  test("returns an icon independently of whether the project exists", async () => {
    await iconBucket.put("g1/original", "orphaned", {
      httpMetadata: { contentType: "image/png" },
    });

    const res = await app.request("/v1/projects/g1/icon", undefined, env);

    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe("orphaned");
  });
});

describe("OpenAPI", () => {
  test("documents the projects routes", async () => {
    const res = await app.request("/openapi.json", undefined, env);
    const document = (await res.json()) as {
      paths: Record<
        string,
        Record<
          string,
          { operationId: string; responses: Record<string, unknown> }
        >
      >;
    };

    expect(document.paths["/v1/projects"]?.get?.operationId).toBe(
      "listProjects",
    );
    expect(document.paths["/v1/projects/{projectId}"]?.get?.operationId).toBe(
      "getProject",
    );
    expect(
      document.paths["/v1/projects/{projectId}/details"]?.get?.operationId,
    ).toBe("getProjectDetails");
    expect(
      document.paths["/v1/projects/{projectId}/icon"]?.get?.operationId,
    ).toBe("getProjectIcon");
    expect(
      Object.keys(
        document.paths["/v1/projects/{projectId}/icon"]?.get?.responses ?? {},
      ),
    ).toEqual(["200", "304", "404"]);
  });
});
