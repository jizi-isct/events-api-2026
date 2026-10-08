import { env } from "cloudflare:test";
import { cache } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import app from "../index";
import { DEV_BYPASS_VALUE } from "../middleware/access";
import type { Menu, Project, ProjectDetails } from "../models";
import { ProjectDetailsRepository } from "../repositories/project_details_repository";
import { ProjectRepository } from "../repositories/project_repository";

const db = env.DB;
const projectRepository = new ProjectRepository(db);
const detailsRepository = new ProjectDetailsRepository(db);
const purge = vi.mocked(cache.purge);

const WEBHOOK_URL = "https://discord.example/api/webhooks/1/token";
const webhookPayloads: unknown[] = [];
let webhookStatus = 204;
const realFetch = globalThis.fetch;

vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (url === WEBHOOK_URL) {
    webhookPayloads.push(JSON.parse(init?.body as string));
    return new Response(webhookStatus === 204 ? null : "webhook is gone", {
      status: webhookStatus,
    });
  }

  return realFetch(input, init);
});

const project: Project = {
  id: "g1",
  type: "general",
  groupName: "サークルA",
  projectName: "ミニ実験教室",
  description: "説明",
  isChildFriendly: true,
  isRecommended: false,
  occasions: [],
  tag: ["experience"],
};

const originalMenu: Menu = {
  items: [
    {
      name: "クレープ",
      price: 500,
      options: [{ name: "アイス追加", price: 100 }],
    },
  ],
  description: "売り切れ次第終了します。",
};

const replacementMenu: Menu = {
  items: [{ name: "ドリンク", price: 200, options: [] }],
  description: "一人一点までです。",
};

const fullDetails: ProjectDetails = {
  additionalInfo: "整理券は10時から配布します。",
  menu: originalMenu,
};

beforeEach(async () => {
  await db.prepare(`DELETE FROM projects`).run();
  purge.mockReset().mockResolvedValue({ success: true, errors: [] });
  webhookPayloads.length = 0;
  webhookStatus = 204;
});

const requestAdmin = async (
  path: string,
  method: "PUT" | "DELETE",
  body?: unknown,
  webhookUrl = "",
): Promise<Response> =>
  app.request(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    {
      ...env,
      ACCESS_DEV_BYPASS: DEV_BYPASS_VALUE,
      DISCORD_WEBHOOK_URL: webhookUrl,
    },
  );

describe("Access による保護", () => {
  test("認証なしでは menu を書き換えられない", async () => {
    await projectRepository.create(project);

    const res = await app.request(
      "/admin/v1/projects/g1/details/menu",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(originalMenu),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await detailsRepository.get("g1")).toBeNull();
  });
});

describe("PUT /admin/v1/projects/:projectId/details/menu", () => {
  test("menu を新規保存する", async () => {
    await projectRepository.create(project);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "PUT",
      originalMenu,
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await detailsRepository.get("g1")).toEqual({ menu: originalMenu });
  });

  test("menu だけを書き換える", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "PUT",
      replacementMenu,
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({
      additionalInfo: fullDetails.additionalInfo,
      menu: replacementMenu,
    });
  });

  test("不正な menu は 400 で元の値を変更しない", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "PUT",
      { ...replacementMenu, items: [{ name: "商品", price: -1, options: [] }] },
    );

    expect(res.status).toBe(400);
    expect(await detailsRepository.get("g1")).toEqual(fullDetails);
  });
});

describe("DELETE /admin/v1/projects/:projectId/details/menu", () => {
  test("menu だけを undefined にする", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({
      additionalInfo: fullDetails.additionalInfo,
    });
  });

  test("最後の項目を削除すると保存済みの空オブジェクトになる", async () => {
    await projectRepository.create(project);
    await detailsRepository.saveMenu("g1", originalMenu);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({});
  });

  test("詳細情報が未登録でも 204", async () => {
    await projectRepository.create(project);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/menu",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toBeNull();
  });
});

describe("PUT /admin/v1/projects/:projectId/details/additionalInfo", () => {
  test("additionalInfo を新規保存する", async () => {
    await projectRepository.create(project);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "PUT",
      "追加情報",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({
      additionalInfo: "追加情報",
    });
  });

  test("additionalInfo だけを書き換える", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "PUT",
      "変更後",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({
      additionalInfo: "変更後",
      menu: originalMenu,
    });
  });

  test("文字列以外は 400 で元の値を変更しない", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "PUT",
      { additionalInfo: "オブジェクトは受け付けない" },
    );

    expect(res.status).toBe(400);
    expect(await detailsRepository.get("g1")).toEqual(fullDetails);
  });
});

describe("DELETE /admin/v1/projects/:projectId/details/additionalInfo", () => {
  test("additionalInfo だけを undefined にする", async () => {
    await projectRepository.create(project);
    await detailsRepository.save("g1", fullDetails);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({ menu: originalMenu });
  });

  test("最後の項目を削除すると保存済みの空オブジェクトになる", async () => {
    await projectRepository.create(project);
    await detailsRepository.saveAdditionalInfo("g1", "追加情報");

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toEqual({});
  });

  test("詳細情報が未登録でも 204", async () => {
    await projectRepository.create(project);

    const res = await requestAdmin(
      "/admin/v1/projects/g1/details/additionalInfo",
      "DELETE",
    );

    expect(res.status).toBe(204);
    expect(await detailsRepository.get("g1")).toBeNull();
  });
});

describe("存在しない企画", () => {
  test.each([
    [
      "menu PUT",
      "/admin/v1/projects/unknown/details/menu",
      "PUT",
      originalMenu,
    ],
    ["menu DELETE", "/admin/v1/projects/unknown/details/menu", "DELETE"],
    [
      "additionalInfo PUT",
      "/admin/v1/projects/unknown/details/additionalInfo",
      "PUT",
      "追加情報",
    ],
    [
      "additionalInfo DELETE",
      "/admin/v1/projects/unknown/details/additionalInfo",
      "DELETE",
    ],
  ] as const)("%s は 404", async (_name, path, method, body?) => {
    const res = await requestAdmin(path, method, body);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      message: "Unknown project ID: unknown",
    });
  });
});

describe("Discord への通知", () => {
  describe.each(["例外", "失敗レスポンス"])("purge が %s の場合", (failure) => {
    test.each([
      {
        field: "menu",
        method: "PUT",
        body: replacementMenu,
        expectedDetails: { ...fullDetails, menu: replacementMenu },
        title: "企画メニューを更新しました",
      },
      {
        field: "menu",
        method: "DELETE",
        body: undefined,
        expectedDetails: { additionalInfo: fullDetails.additionalInfo },
        title: "企画メニューを削除しました",
      },
      {
        field: "additionalInfo",
        method: "PUT",
        body: "変更後",
        expectedDetails: { ...fullDetails, additionalInfo: "変更後" },
        title: "企画追加情報を更新しました",
      },
      {
        field: "additionalInfo",
        method: "DELETE",
        body: undefined,
        expectedDetails: { menu: originalMenu },
        title: "企画追加情報を削除しました",
      },
    ] as const)(
      "$field の $method が DB に反映されたら通知する",
      async ({ field, method, body, expectedDetails, title }) => {
        await projectRepository.create(project);
        await detailsRepository.save("g1", fullDetails);
        if (failure === "例外") {
          purge.mockRejectedValueOnce(new Error("purge failed"));
        } else {
          purge.mockResolvedValueOnce({
            success: false,
            errors: [{ code: 429, message: "rate limited" }],
          });
        }
        const error = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
          const response = await requestAdmin(
            `/admin/v1/projects/g1/details/${field}`,
            method,
            body,
            WEBHOOK_URL,
          );

          expect(response.status).toBe(500);
          expect(await detailsRepository.get("g1")).toEqual(expectedDetails);
          expect(purge).toHaveBeenCalledExactlyOnceWith({
            tags: ["projects-g1-details"],
          });
          expect(webhookPayloads).toEqual([
            expect.objectContaining({
              username: "g1",
              embeds: [expect.objectContaining({ title })],
            }),
          ]);
        } finally {
          error.mockRestore();
        }
      },
    );
  });

  test("メニュー・追加情報の更新と削除を既存 webhook へ通知する", async () => {
    await projectRepository.create(project);

    const operations = [
      ["/admin/v1/projects/g1/details/menu", "PUT", originalMenu],
      ["/admin/v1/projects/g1/details/menu", "DELETE", undefined],
      [
        "/admin/v1/projects/g1/details/additionalInfo",
        "PUT",
        "@everyone にお知らせ",
      ],
      ["/admin/v1/projects/g1/details/additionalInfo", "DELETE", undefined],
    ] as const;

    for (const [path, method, body] of operations) {
      const response = await requestAdmin(path, method, body, WEBHOOK_URL);
      expect(response.status).toBe(204);
    }

    const payloads = webhookPayloads as {
      username: string;
      allowed_mentions: { parse: string[] };
      embeds: {
        title: string;
        fields: { name: string; value: string; inline: boolean }[];
      }[];
    }[];
    expect(payloads.map((payload) => payload.embeds[0]?.title)).toEqual([
      "企画メニューを更新しました",
      "企画メニューを削除しました",
      "企画追加情報を更新しました",
      "企画追加情報を削除しました",
    ]);
    for (const payload of payloads) {
      expect(payload.username).toBe("g1");
      expect(payload.embeds[0]?.fields).toContainEqual({
        name: "企画ID",
        value: "g1",
        inline: true,
      });
      expect(payload.allowed_mentions).toEqual({ parse: [] });
    }
    expect(payloads[0]?.embeds[0]?.fields).toContainEqual({
      name: "メニュー",
      value: "・クレープ（500円） / オプション: アイス追加（100円）",
      inline: false,
    });
    expect(payloads[2]?.embeds[0]?.fields).toContainEqual({
      name: "追加情報",
      value: "@everyone にお知らせ",
      inline: false,
    });
  });

  test("同じ値の再保存と未登録値の削除も通知する", async () => {
    await projectRepository.create(project);
    await detailsRepository.saveMenu("g1", originalMenu);

    expect(
      (
        await requestAdmin(
          "/admin/v1/projects/g1/details/menu",
          "PUT",
          originalMenu,
          WEBHOOK_URL,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await requestAdmin(
          "/admin/v1/projects/g1/details/additionalInfo",
          "DELETE",
          undefined,
          WEBHOOK_URL,
        )
      ).status,
    ).toBe(204);
    expect(webhookPayloads).toHaveLength(2);
  });

  test("保存が失敗した場合と webhook 未設定時は通知しない", async () => {
    await projectRepository.create(project);

    expect(
      (
        await requestAdmin(
          "/admin/v1/projects/unknown/details/menu",
          "PUT",
          originalMenu,
          WEBHOOK_URL,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await requestAdmin(
          "/admin/v1/projects/g1/details/menu",
          "PUT",
          { items: "invalid" },
          WEBHOOK_URL,
        )
      ).status,
    ).toBe(400);
    expect(webhookPayloads).toHaveLength(0);

    expect(
      (
        await requestAdmin(
          "/admin/v1/projects/g1/details/menu",
          "PUT",
          originalMenu,
        )
      ).status,
    ).toBe(204);
    expect(webhookPayloads).toHaveLength(0);
  });

  test("webhook が失敗しても保存は成功し warn を残す", async () => {
    await projectRepository.create(project);
    webhookStatus = 404;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const response = await requestAdmin(
        "/admin/v1/projects/g1/details/additionalInfo",
        "PUT",
        "追加情報",
        WEBHOOK_URL,
      );

      expect(response.status).toBe(204);
      expect((await detailsRepository.get("g1"))?.additionalInfo).toBe(
        "追加情報",
      );
      expect(
        warn.mock.calls.some(([message]) =>
          String(message).includes("Failed to notify Discord"),
        ),
      ).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("OpenAPI", () => {
  test("企画詳細情報の管理用エンドポイントを公開仕様に載せる", async () => {
    const res = await app.request("/openapi.json", undefined, env);
    const document = (await res.json()) as {
      paths: Record<
        string,
        | {
            put?: { operationId?: string };
            delete?: { operationId?: string };
          }
        | undefined
      >;
    };

    const menuPath =
      document.paths["/admin/v1/projects/{projectId}/details/menu"];
    const additionalInfoPath =
      document.paths["/admin/v1/projects/{projectId}/details/additionalInfo"];

    expect(menuPath?.put?.operationId).toBe("updateProjectMenu");
    expect(menuPath?.delete?.operationId).toBe("deleteProjectMenu");
    expect(additionalInfoPath?.put?.operationId).toBe(
      "updateProjectAdditionalInfo",
    );
    expect(additionalInfoPath?.delete?.operationId).toBe(
      "deleteProjectAdditionalInfo",
    );
  });
});
