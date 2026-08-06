import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  TEST_ACCESS_AUD,
  TEST_ACCESS_TEAM_DOMAIN,
} from "../../test/access_config";
import app from "../index";
import { DEV_BYPASS_VALUE } from "../middleware/access";
import type { Project } from "../models/project";
import { ProjectRepository } from "../repositories/project_repository";

const db = env.DB;
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
    env,
  );

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
  await db.prepare(`DELETE FROM projects`).run();
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
  test("管理用エンドポイントを公開仕様に載せない", async () => {
    const res = await app.request("/openapi.json", undefined, env);
    const document = (await res.json()) as { paths: Record<string, unknown> };

    expect(Object.keys(document.paths)).not.toContain("/admin/v1/projects");
    expect(
      Object.keys(document.paths).filter((path) => path.startsWith("/admin")),
    ).toEqual([]);
  });
});
