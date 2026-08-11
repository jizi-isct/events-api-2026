import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  TEST_ACCESS_AUD,
  TEST_ACCESS_TEAM_DOMAIN,
} from "../../test/access_config";
import { LANDSCAPE_PNG, SQUARE_PNG } from "../../test/icon_fixtures";
import app from "../index";
import { DEV_BYPASS_VALUE } from "../middleware/access";
import type { Project } from "../models/project";
import { ProjectRepository } from "../repositories/project_repository";

const db = env.DB;
const iconBucket = env.ICON_BUCKET;
const repository = new ProjectRepository(db);

const TEAM_DOMAIN = TEST_ACCESS_TEAM_DOMAIN;
const AUD = TEST_ACCESS_AUD;

// Access の JWKS エンドポイントを差し替え、テスト内で署名した JWT を
// 検証させる。鍵ペアは正規のものと、署名が通らないことを確かめる別物の二組。
const signing = await generateKeyPair("RS256", { extractable: true });
const other = await generateKeyPair("RS256", { extractable: true });

const publicJwk: JWK = {
  ...(await exportJWK(signing.publicKey)),
  kid: "test-key",
  alg: "RS256",
  use: "sig",
};

const realFetch = globalThis.fetch;

// 通知先の webhook もスタブし、送信内容と応答をテストから操作する。
const WEBHOOK_URL = "https://discord.example/api/webhooks/1/token";
const webhookPayloads: unknown[] = [];
let webhookStatus = 204;

vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (url.startsWith(`${TEAM_DOMAIN}/cdn-cgi/access/certs`)) {
    return Response.json({ keys: [publicJwk] });
  }

  if (url === WEBHOOK_URL) {
    webhookPayloads.push(JSON.parse(init?.body as string));
    return new Response(webhookStatus === 204 ? null : "webhook is gone", {
      status: webhookStatus,
    });
  }

  return realFetch(input, init);
});

interface TokenOptions {
  key?: CryptoKey;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
}

const signToken = ({
  key = signing.privateKey,
  audience = AUD,
  issuer = TEAM_DOMAIN,
  expiresIn = "1h",
}: TokenOptions = {}): Promise<string> =>
  new SignJWT({ email: "staff@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);

const authorized = async (
  path: string,
  init: RequestInit = {},
  bindings: Parameters<typeof app.request>[2] = env,
): Promise<Response> =>
  app.request(
    path,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": await signToken(),
        ...init.headers,
      },
    },
    bindings,
  );

/** 通知先が設定された状態でリクエストする。 */
const notifying = (path: string, init: RequestInit = {}): Promise<Response> =>
  authorized(path, init, { ...env, DISCORD_WEBHOOK_URL: WEBHOOK_URL });

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

beforeEach(async () => {
  webhookPayloads.length = 0;
  webhookStatus = 204;
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

describe("Access による保護", () => {
  test("トークンが無ければ 401", async () => {
    const res = await app.request(
      "/admin/v1/projects",
      { method: "POST", body: JSON.stringify(general) },
      env,
    );

    expect(res.status).toBe(401);
  });

  test("別の鍵で署名されたトークンは 401", async () => {
    const res = await app.request(
      "/admin/v1/projects",
      {
        method: "POST",
        body: JSON.stringify(general),
        headers: {
          "Content-Type": "application/json",
          "Cf-Access-Jwt-Assertion": await signToken({
            key: other.privateKey,
          }),
        },
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  test("aud が違うトークンは 401", async () => {
    const res = await app.request(
      "/admin/v1/projects",
      {
        method: "POST",
        body: JSON.stringify(general),
        headers: {
          "Content-Type": "application/json",
          "Cf-Access-Jwt-Assertion": await signToken({
            audience: "another-app",
          }),
        },
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  test("期限切れのトークンは 401", async () => {
    const res = await app.request(
      "/admin/v1/projects",
      {
        method: "POST",
        body: JSON.stringify(general),
        headers: {
          "Content-Type": "application/json",
          "Cf-Access-Jwt-Assertion": await signToken({ expiresIn: "-1h" }),
        },
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  test("認証に失敗したとき書き込まれない", async () => {
    // Content-Type を付けないとボディ検証の側で弾かれてしまい、
    // 認証を外しても落ちないテストになる。
    const res = await app.request(
      "/admin/v1/projects",
      {
        method: "POST",
        body: JSON.stringify(general),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await repository.get("g1")).toBeNull();
  });

  test("公開エンドポイントはトークン無しで読める", async () => {
    await repository.create(general);

    const res = await app.request("/v1/projects", undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([general]);
  });
});

describe("ローカル開発用の迂回", () => {
  test("フラグが立っていれば認証なしで通る", async () => {
    const res = await app.request(
      "/admin/v1/projects",
      {
        method: "POST",
        body: JSON.stringify(general),
        headers: { "Content-Type": "application/json" },
      },
      { ...env, ACCESS_DEV_BYPASS: DEV_BYPASS_VALUE },
    );

    expect(res.status).toBe(201);
    expect(await repository.get("g1")).toEqual(general);
  });

  test("値が違えば効かない", async () => {
    const res = await app.request(
      "/admin/v1/projects",
      {
        method: "POST",
        body: JSON.stringify(general),
        headers: { "Content-Type": "application/json" },
      },
      { ...env, ACCESS_DEV_BYPASS: "true" },
    );

    expect(res.status).toBe(401);
    expect(await repository.get("g1")).toBeNull();
  });

  test("既定では無効", async () => {
    const res = await app.request(
      "/admin/v1/projects",
      {
        method: "POST",
        body: JSON.stringify(general),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  test("迂回フラグが wrangler.jsonc に混入していない", () => {
    // .dev.vars はデプロイされないが、設定ファイルに書かれると本番で
    // 認証が無効になる。そこだけは機械的に防ぐ。
    expect(env.TEST_WRANGLER_CONFIG).not.toContain("ACCESS_DEV_BYPASS");
  });
});

describe("POST /admin/v1/projects", () => {
  test("企画を登録する", async () => {
    const res = await authorized("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(general);
    expect(await repository.get("g1")).toEqual(general);
  });

  test("ID が重複していたら 409", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify({ ...general, projectName: "別の企画" }),
    });

    expect(res.status).toBe(409);
    expect(await repository.get("g1")).toEqual(general);
  });

  test("モデルとして不正なボディは 400", async () => {
    const res = await authorized("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify({ ...general, type: "unknown-type" }),
    });

    expect(res.status).toBe(400);
    expect(await repository.get("g1")).toBeNull();
  });

  test("存在しない場所を指すボディは 400", async () => {
    const res = await authorized("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        ...general,
        occasions: [
          {
            place: "nonexistent.place",
            timeRange: general.occasions[0]!.timeRange,
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /admin/v1/projects/bulk", () => {
  const stage: Project = {
    id: "s1",
    type: "stage",
    groupName: "サークルD",
    projectName: "ダンスステージ",
    description: "説明",
    isChildFriendly: true,
    isRecommended: false,
    occasions: [
      {
        place: "east.wood-deck",
        timeRange: {
          start: { date: 2, hour: 13, minute: 0 },
          end: { date: 2, hour: 14, minute: 0 },
        },
      },
    ],
  };

  test("企画をまとめて登録する", async () => {
    const res = await authorized("/admin/v1/projects/bulk", {
      method: "POST",
      body: JSON.stringify([general, stage]),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual([general, stage]);
    expect(await repository.get("g1")).toEqual(general);
    expect(await repository.get("s1")).toEqual(stage);
  });

  test("空配列でも 201", async () => {
    const res = await authorized("/admin/v1/projects/bulk", {
      method: "POST",
      body: JSON.stringify([]),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual([]);
  });

  test("既にある ID が含まれていたら 409", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/bulk", {
      method: "POST",
      body: JSON.stringify([stage, { ...general, projectName: "別の企画" }]),
    });

    expect(res.status).toBe(409);
    expect(await repository.get("g1")).toEqual(general);
    // 一件でも駄目なら一件も入らないこと
    expect(await repository.get("s1")).toBeNull();
  });

  test("同じ ID を二件含んでいたら 400", async () => {
    const res = await authorized("/admin/v1/projects/bulk", {
      method: "POST",
      body: JSON.stringify([general, { ...general, projectName: "別の企画" }]),
    });

    expect(res.status).toBe(400);
    expect(await repository.get("g1")).toBeNull();
  });

  test("モデルとして不正な要素が混ざっていたら 400", async () => {
    const res = await authorized("/admin/v1/projects/bulk", {
      method: "POST",
      body: JSON.stringify([general, { ...stage, type: "unknown-type" }]),
    });

    expect(res.status).toBe(400);
    expect(await repository.get("g1")).toBeNull();
  });

  test("配列でないボディは 400", async () => {
    const res = await authorized("/admin/v1/projects/bulk", {
      method: "POST",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(400);
    expect(await repository.get("g1")).toBeNull();
  });

  test("100 件を超えていたら 400", async () => {
    const projects = Array.from({ length: 101 }, (_, index) => ({
      ...general,
      id: `g${index}`,
    }));

    const res = await authorized("/admin/v1/projects/bulk", {
      method: "POST",
      body: JSON.stringify(projects),
    });

    expect(res.status).toBe(400);
    expect(await repository.get("g0")).toBeNull();
  });

  test("トークンが無ければ 401", async () => {
    const res = await app.request(
      "/admin/v1/projects/bulk",
      {
        method: "POST",
        body: JSON.stringify([general, stage]),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await repository.get("g1")).toBeNull();
  });
});

describe("PUT /admin/v1/projects/:projectId", () => {
  test("企画を置き換える", async () => {
    await repository.create(general);
    const updated: Project = {
      ...general,
      projectName: "改題",
      tag: ["lecture"],
    };

    const res = await authorized("/admin/v1/projects/g1", {
      method: "PUT",
      body: JSON.stringify(updated),
    });

    expect(res.status).toBe(200);
    expect(await repository.get("g1")).toEqual(updated);
  });

  test("存在しない企画は 404", async () => {
    const res = await authorized("/admin/v1/projects/g1", {
      method: "PUT",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(404);
  });

  test("パスとボディの ID が食い違ったら 400", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/other", {
      method: "PUT",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(400);
    expect(await repository.get("g1")).toEqual(general);
  });
});

describe("PATCH /admin/v1/projects/:projectId/description", () => {
  test("説明だけを書き換える", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/g1/description", {
      method: "PATCH",
      body: JSON.stringify({ description: "新しい説明" }),
    });

    const updated: Project = { ...general, description: "新しい説明" };

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(updated);
    expect(await repository.get("g1")).toEqual(updated);
  });

  test("存在しない企画は 404", async () => {
    const res = await authorized("/admin/v1/projects/g1/description", {
      method: "PATCH",
      body: JSON.stringify({ description: "新しい説明" }),
    });

    expect(res.status).toBe(404);
  });

  test("description の無いボディは 400", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/g1/description", {
      method: "PATCH",
      body: JSON.stringify({ projectName: "改題" }),
    });

    expect(res.status).toBe(400);
    expect(await repository.get("g1")).toEqual(general);
  });

  test("トークンが無ければ 401", async () => {
    await repository.create(general);

    const res = await app.request(
      "/admin/v1/projects/g1/description",
      {
        method: "PATCH",
        body: JSON.stringify({ description: "新しい説明" }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await repository.get("g1")).toEqual(general);
  });
});

describe("PUT /admin/v1/projects/:projectId/icon", () => {
  test("正方形の画像を保存する", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Blob([SQUARE_PNG]),
    });

    expect(res.status).toBe(204);
    const stored = await iconBucket.get("g1/original");
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(SQUARE_PNG);
    expect(stored?.httpMetadata?.contentType).toBe("image/png");
  });

  test("実データから判定した Content-Type で保存する", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: new Blob([SQUARE_PNG]),
    });

    expect(res.status).toBe(204);
    expect(
      (await iconBucket.head("g1/original"))?.httpMetadata?.contentType,
    ).toBe("image/png");
  });

  test("存在しない企画は 404", async () => {
    const res = await authorized("/admin/v1/projects/unknown/icon", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Blob([SQUARE_PNG]),
    });

    expect(res.status).toBe(404);
    expect(await iconBucket.get("unknown/original")).toBeNull();
  });

  test("縦横比が 1:1 でない画像は 422", async () => {
    await repository.create(general);
    await iconBucket.put("g1/original", "existing", {
      httpMetadata: { contentType: "image/png" },
    });

    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Blob([LANDSCAPE_PNG]),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ message: "Icon must be square: 2x1" });
    expect(await (await iconBucket.get("g1/original"))?.text()).toBe(
      "existing",
    );
  });

  test("画像でないデータは 415", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: "not an image",
    });

    expect(res.status).toBe(415);
    expect(await iconBucket.get("g1/original")).toBeNull();
  });

  test("寸法を検証できない SVG は 415", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "PUT",
      headers: { "Content-Type": "image/svg+xml" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>',
    });

    expect(res.status).toBe(415);
    expect(await iconBucket.get("g1/original")).toBeNull();
  });

  test("空の画像データは 400", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: "",
    });

    expect(res.status).toBe(400);
    expect(await iconBucket.get("g1/original")).toBeNull();
  });

  test("20 MB を超える画像データは 413", async () => {
    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array(20_000_001),
    });

    expect(res.status).toBe(413);
    expect(await iconBucket.get("g1/original")).toBeNull();
  });
});

describe("DELETE /admin/v1/projects/:projectId/icon", () => {
  test("アイコンだけを削除する", async () => {
    await iconBucket.put("g1/original", "general");
    await iconBucket.put("s1/original", "stage");

    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(await iconBucket.get("g1/original")).toBeNull();
    expect(await (await iconBucket.get("s1/original"))?.text()).toBe("stage");
  });

  test("アイコンが存在しない場合も 204", async () => {
    const res = await authorized("/admin/v1/projects/g1/icon", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  test("認証されていない場合は削除しない", async () => {
    await iconBucket.put("g1/original", "icon");

    const res = await app.request(
      "/admin/v1/projects/g1/icon",
      { method: "DELETE" },
      env,
    );

    expect(res.status).toBe(401);
    expect(await (await iconBucket.get("g1/original"))?.text()).toBe("icon");
  });
});

describe("DELETE /admin/v1/projects/:projectId", () => {
  test("企画を削除する", async () => {
    await repository.create(general);

    const res = await authorized("/admin/v1/projects/g1", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(await repository.get("g1")).toBeNull();
  });

  test("存在しない企画は 404", async () => {
    const res = await authorized("/admin/v1/projects/g1", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});

describe("OpenAPI", () => {
  test("管理用エンドポイントを公開仕様に載せる", async () => {
    const res = await app.request("/openapi.json", undefined, env);
    const document = (await res.json()) as {
      paths: Record<
        string,
        | {
            post?: { operationId?: string };
            put?: {
              operationId?: string;
              requestBody?: { content?: Record<string, unknown> };
              responses?: Record<string, unknown>;
            };
            patch?: { operationId?: string };
            delete?: {
              operationId?: string;
              responses?: Record<string, unknown>;
            };
          }
        | undefined
      >;
    };

    expect(document.paths["/admin/v1/projects"]?.post?.operationId).toBe(
      "createProject",
    );
    expect(document.paths["/admin/v1/projects/bulk"]?.post?.operationId).toBe(
      "createProjects",
    );
    expect(
      document.paths["/admin/v1/projects/{projectId}"]?.put?.operationId,
    ).toBe("updateProject");
    expect(
      document.paths["/admin/v1/projects/{projectId}"]?.delete?.operationId,
    ).toBe("deleteProject");
    expect(
      document.paths["/admin/v1/projects/{projectId}/description"]?.patch
        ?.operationId,
    ).toBe("updateProjectDescription");

    const iconOperation =
      document.paths["/admin/v1/projects/{projectId}/icon"]?.put;
    expect(iconOperation?.operationId).toBe("updateProjectIcon");
    expect(Object.keys(iconOperation?.requestBody?.content ?? {})).toEqual([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/heic",
    ]);
    expect(Object.keys(iconOperation?.responses ?? {})).toEqual([
      "204",
      "400",
      "401",
      "404",
      "413",
      "415",
      "422",
    ]);

    const deleteIconOperation =
      document.paths["/admin/v1/projects/{projectId}/icon"]?.delete;
    expect(deleteIconOperation?.operationId).toBe("deleteProjectIcon");
    expect(Object.keys(deleteIconOperation?.responses ?? {})).toEqual([
      "204",
      "401",
    ]);
  });
});

describe("カテゴリ", () => {
  test("カテゴリつきで登録して読み戻せる", async () => {
    const res = await authorized("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify({ ...general, category: "play" }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ...general, category: "play" });
    expect(await repository.get(general.id)).toEqual({
      ...general,
      category: "play",
    });
  });

  test("カテゴリは省略できる", async () => {
    const res = await authorized("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(general);
  });

  test("定義に無いカテゴリは 400", async () => {
    const res = await authorized("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify({ ...general, category: "gatsuri" }),
    });

    expect(res.status).toBe(400);
    expect(await repository.get(general.id)).toBeNull();
  });

  test("update でカテゴリを外せる", async () => {
    await repository.create({ ...general, category: "display" });

    const res = await authorized(`/admin/v1/projects/${general.id}`, {
      method: "PUT",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(200);
    expect((await repository.get(general.id))?.category).toBeUndefined();
  });
});

describe("Discord への通知", () => {
  test("企画の登録を通知する", async () => {
    const res = await notifying("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(201);
    expect(webhookPayloads).toHaveLength(1);
    const embed = (webhookPayloads[0] as { embeds: { title: string }[] })
      .embeds[0];
    expect(embed?.title).toBe("企画を登録しました");
  });

  test("一括登録は一通にまとめて通知する", async () => {
    const res = await notifying("/admin/v1/projects/bulk", {
      method: "POST",
      body: JSON.stringify([general, { ...general, id: "g2" }]),
    });

    expect(res.status).toBe(201);
    expect(webhookPayloads).toHaveLength(1);
    const embed = (
      webhookPayloads[0] as {
        embeds: { title: string; fields: { name: string; value: string }[] }[];
      }
    ).embeds[0];
    expect(embed?.title).toBe("企画を一括登録しました");
    expect(embed?.fields).toContainEqual({
      name: "件数",
      value: "2",
      inline: true,
    });
  });

  test("企画の削除を、消える前の企画名つきで通知する", async () => {
    await repository.create(general);

    const res = await notifying(`/admin/v1/projects/${general.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    const embed = (
      webhookPayloads[0] as {
        embeds: { title: string; fields: { value: string }[] }[];
      }
    ).embeds[0];
    expect(embed?.title).toBe("企画を削除しました");
    expect(embed?.fields.map((field) => field.value)).toContain(
      general.projectName,
    );
  });

  test("アイコンの更新と削除を通知する", async () => {
    await repository.create(general);

    await notifying(`/admin/v1/projects/${general.id}/icon`, {
      method: "PUT",
      body: SQUARE_PNG,
      headers: { "Content-Type": "image/png" },
    });
    await notifying(`/admin/v1/projects/${general.id}/icon`, {
      method: "DELETE",
    });

    expect(
      webhookPayloads.map(
        (payload) =>
          (payload as { embeds: { title: string }[] }).embeds[0].title,
      ),
    ).toEqual(["企画アイコンを更新しました", "企画アイコンを削除しました"]);
  });

  test("アイコンの更新では最適化した画像を embed に添える", async () => {
    await repository.create(general);

    const res = await notifying(`/admin/v1/projects/${general.id}/icon`, {
      method: "PUT",
      body: SQUARE_PNG,
      headers: { "Content-Type": "image/png" },
    });

    expect(res.status).toBe(204);
    const payload = webhookPayloads[0] as {
      username: string;
      avatar_url: string;
      embeds: { image?: { url: string } }[];
    };
    expect(payload.username).toBe(`${general.id} ${general.groupName}`);
    expect(payload.embeds[0]?.image?.url).toMatch(
      new RegExp(
        `^http://localhost/cdn-cgi/image/width=512,format=auto/v1/projects/${general.id}/icon\\?v=\\d+$`,
      ),
    );
    expect(payload.avatar_url).toContain(
      "/cdn-cgi/image/width=128,format=auto/",
    );
  });

  test("更新の通知に変更点を載せる", async () => {
    await repository.create(general);

    const res = await notifying(`/admin/v1/projects/${general.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...general, projectName: "新しい企画名" }),
    });

    expect(res.status).toBe(200);
    const embed = (webhookPayloads[0] as { embeds: { description?: string }[] })
      .embeds[0];
    expect(embed?.description).toBe(
      `- **企画名**: ${general.projectName} → 新しい企画名`,
    );
  });

  test("説明の更新の通知に変更点を載せる", async () => {
    await repository.create(general);

    const res = await notifying(
      `/admin/v1/projects/${general.id}/description`,
      { method: "PATCH", body: JSON.stringify({ description: "新しい説明" }) },
    );

    expect(res.status).toBe(200);
    const embed = (webhookPayloads[0] as { embeds: { description?: string }[] })
      .embeds[0];
    expect(embed?.description).toBe(
      `- **説明**: ${general.description} → 新しい説明`,
    );
  });

  test("失敗した操作は通知しない", async () => {
    const res = await notifying("/admin/v1/projects/unknown", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    expect(webhookPayloads).toHaveLength(0);
  });

  test("webhook が未設定なら通知しない", async () => {
    const res = await authorized("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(201);
    expect(webhookPayloads).toHaveLength(0);
  });

  test("通知に失敗しても操作は成功し、warn を残す", async () => {
    webhookStatus = 404;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await notifying("/admin/v1/projects", {
      method: "POST",
      body: JSON.stringify(general),
    });

    expect(res.status).toBe(201);
    expect(await repository.get(general.id)).not.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("Failed to notify Discord");
    warn.mockRestore();
  });
});
