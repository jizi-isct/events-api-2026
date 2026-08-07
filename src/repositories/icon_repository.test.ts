import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import { IconRepository } from "./icon_repository";

const bucket = env.ICON_BUCKET;

let repository: IconRepository;

beforeEach(async () => {
  // storage はテストファイル内で共有されるため、テストごとに空にする。
  let listed = await bucket.list();

  while (true) {
    await bucket.delete(listed.objects.map((object) => object.key));

    if (!listed.truncated) {
      break;
    }

    listed = await bucket.list({ cursor: listed.cursor });
  }

  repository = new IconRepository(bucket);
});

describe("save", () => {
  test("企画 ID に対応するキーへ原本と Content-Type を保存する", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    await repository.save(
      "g1",
      new Blob([bytes.buffer], { type: "image/png" }),
    );

    const stored = await bucket.get("g1/original");

    expect(stored).not.toBeNull();
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(bytes);
    expect(stored!.httpMetadata?.contentType).toBe("image/png");
  });

  test("同じ企画 ID に保存すると既存のアイコンを上書きする", async () => {
    await repository.save("g1", new Blob(["old"], { type: "image/png" }));

    await repository.save("g1", new Blob(["new"], { type: "image/webp" }));

    const stored = await bucket.get("g1/original");

    expect(await stored?.text()).toBe("new");
    expect(stored?.httpMetadata?.contentType).toBe("image/webp");
  });

  test("企画 ID ごとにアイコンを分離して保存する", async () => {
    await repository.save("g1", new Blob(["general"], { type: "image/png" }));
    await repository.save("s1", new Blob(["stage"], { type: "image/jpeg" }));

    expect(await (await bucket.get("g1/original"))?.text()).toBe("general");
    expect(await (await bucket.get("s1/original"))?.text()).toBe("stage");
  });
});

describe("get", () => {
  test("企画 ID に対応するアイコンの原本を取得する", async () => {
    await bucket.put("g1/original", "icon", {
      httpMetadata: { contentType: "image/png" },
    });

    const icon = await repository.get("g1");

    expect(await icon?.text()).toBe("icon");
    expect(icon?.httpMetadata?.contentType).toBe("image/png");
  });

  test("アイコンが存在しない場合は null を返す", async () => {
    expect(await repository.get("g1")).toBeNull();
  });

  test("条件付き取得で ETag が一致した場合は本文を返さない", async () => {
    await bucket.put("g1/original", "icon", {
      httpMetadata: { contentType: "image/png" },
    });
    const stored = await bucket.head("g1/original");
    const headers = new Headers({ "If-None-Match": stored!.httpEtag });

    const icon = await repository.get("g1", headers);

    expect(icon).not.toBeNull();
    expect("body" in icon!).toBe(false);
    expect(icon?.httpEtag).toBe(stored?.httpEtag);
  });
});

describe("delete", () => {
  test("企画 ID に対応するアイコンだけを削除する", async () => {
    await bucket.put("g1/original", "general");
    await bucket.put("s1/original", "stage");

    await repository.delete("g1");

    expect(await bucket.get("g1/original")).toBeNull();
    expect(await (await bucket.get("s1/original"))?.text()).toBe("stage");
  });

  test("アイコンが存在しない場合も成功する", async () => {
    await expect(repository.delete("g1")).resolves.toBeUndefined();
  });
});
