import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";
import { IconRepository } from "./icon_repository";

const bucket = env.TEST_ICON_BUCKET;

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
