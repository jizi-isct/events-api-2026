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

describe("OpenAPI", () => {
  test("documents the projects routes", async () => {
    const res = await app.request("/openapi.json", undefined, env);
    const document = (await res.json()) as {
      paths: Record<string, Record<string, { operationId: string }>>;
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
  });
});
