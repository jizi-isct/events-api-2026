import { describe, expect, test, vi } from "vitest";
import type { Project } from "../models/project";
import type { DiscordMessage, DiscordPort } from "./discord_service";
import { ProjectNotifier } from "./project_notifier";

const project: Project = {
  id: "g1",
  type: "general",
  groupName: "テスト団体",
  projectName: "テスト企画",
  description: "説明",
  isChildFriendly: true,
  isRecommended: false,
  occasions: [],
  tag: ["display"],
};

const BASE_URL = "https://events26.example";

const fakeDiscord = () => {
  const sent: DiscordMessage[] = [];
  const port: DiscordPort = {
    send: async (message) => {
      sent.push(message);
    },
  };

  return { port, sent };
};

describe("notify", () => {
  test("企画の全項目を載せる", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "created",
      projectId: project.id,
      project: {
        ...project,
        occasions: [
          {
            place: "south.s3.s3-206",
            timeRange: {
              start: { date: 1, hour: 10, minute: 0 },
              end: { date: 1, hour: 16, minute: 30 },
            },
          },
        ],
      },
    });

    const embed = sent[0]?.embeds?.[0];
    expect(embed?.title).toBe("企画を登録しました");
    expect(embed?.fields).toEqual([
      { name: "企画ID", value: "g1", inline: true },
      { name: "種別", value: "一般", inline: true },
      { name: "企画名", value: "テスト企画", inline: true },
      { name: "団体名", value: "テスト団体", inline: true },
      { name: "子ども向け", value: "はい", inline: true },
      { name: "おすすめ", value: "いいえ", inline: true },
      { name: "タグ", value: "display", inline: false },
      {
        name: "開催予定",
        value: "・south.s3.s3-206 1日目 10:00〜1日目 16:30",
        inline: false,
      },
      { name: "説明", value: "説明", inline: false },
    ]);
  });

  test("種別ごとの項目を出し分ける", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "created",
      projectId: "l1",
      project: {
        id: "l1",
        type: "laboratory",
        groupName: "研究室",
        projectName: "研究室公開",
        description: "",
        isChildFriendly: false,
        isRecommended: true,
        occasions: [],
        isTour: true,
      },
    });

    const fields = sent[0]?.embeds?.[0]?.fields;
    expect(fields).toContainEqual({
      name: "ツアー",
      value: "はい",
      inline: true,
    });
    // 研究室企画はタグを持たない。
    expect(fields?.some((field) => field.name === "タグ")).toBe(false);
    expect(fields).toContainEqual({
      name: "開催予定",
      value: "なし",
      inline: false,
    });
    expect(fields).toContainEqual({
      name: "説明",
      value: "なし",
      inline: false,
    });
  });

  test("変更前が渡されたら、変わった項目だけを先頭にまとめる", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "updated",
      projectId: project.id,
      project: { ...project, projectName: "新しい企画名", isRecommended: true },
      previous: project,
    });

    expect(sent[0]?.embeds?.[0]?.description).toBe(
      "- **企画名**: テスト企画 → 新しい企画名\n- **おすすめ**: いいえ → はい",
    );
  });

  test("値が変わっていなければ変更なしと出す", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "updated",
      projectId: project.id,
      project,
      previous: project,
    });

    expect(sent[0]?.embeds?.[0]?.description).toBe("変更なし");
  });

  test("変更前が無ければ差分を出さない", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "created",
      projectId: project.id,
      project,
    });

    expect(sent[0]?.embeds?.[0]?.description).toBeUndefined();
  });

  test("説明の更新では説明本文も載せる", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "description_updated",
      projectId: project.id,
      project: { ...project, description: "新しい説明" },
    });

    expect(sent[0]?.embeds?.[0]?.fields).toContainEqual({
      name: "説明",
      value: "新しい説明",
      inline: false,
    });
  });

  test("長い説明を切り詰める", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "description_updated",
      projectId: project.id,
      project: { ...project, description: "あ".repeat(500) },
    });

    const description = sent[0]?.embeds?.[0]?.fields?.find(
      (field) => field.name === "説明",
    );
    expect(description?.value).toBe(`${"あ".repeat(299)}…`);
  });

  test("一括登録は件数と ID を一通にまとめる", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "bulk_created",
      projects: [project, { ...project, id: "g2" }],
    });

    const embed = sent[0]?.embeds?.[0];
    expect(embed?.title).toBe("企画を一括登録しました");
    expect(embed?.fields).toEqual([
      { name: "件数", value: "2", inline: true },
      { name: "企画ID", value: "g1, g2", inline: false },
    ]);
  });

  test("一括登録の ID が多いときは件数で省略する", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "bulk_created",
      projects: Array.from({ length: 60 }, (_, index) => ({
        ...project,
        id: `g${String(index)}`,
      })),
    });

    const ids = sent[0]?.embeds?.[0]?.fields?.[1]?.value;
    expect(ids).toContain("g49");
    expect(ids?.endsWith("ほか 10 件")).toBe(true);
  });

  test("企画が無い通知では ID だけ載せる", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "icon_deleted",
      projectId: "g1",
    });

    expect(sent[0]?.embeds?.[0]?.fields).toEqual([
      { name: "企画ID", value: "g1", inline: true },
    ]);
  });

  test("本文由来のメンションを飛ばさない", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "deleted",
      projectId: "g1",
      project: { ...project, projectName: "@everyone" },
    });

    expect(sent[0]?.allowed_mentions).toEqual({ parse: [] });
  });

  test("団体 ID と団体名を名乗り、企画アイコンをアイコンにする", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "created",
      projectId: project.id,
      project,
    });

    expect(sent[0]?.username).toBe("g1 テスト団体");
    expect(sent[0]?.avatar_url).toBe(
      `${BASE_URL}/cdn-cgi/image/width=128,format=auto/v1/projects/g1/icon`,
    );
  });

  test("企画が無ければ ID だけを名乗る", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "icon_deleted",
      projectId: "g1",
    });

    expect(sent[0]?.username).toBe("g1");
  });

  test("一括登録は特定の企画を名乗らない", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "bulk_created",
      projects: [project],
    });

    expect(sent[0]?.username).toBeUndefined();
    expect(sent[0]?.avatar_url).toBeUndefined();
  });

  test("アイコンの更新では更新後の画像を embed に添える", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "icon_updated",
      projectId: project.id,
      project,
    });

    const url = sent[0]?.embeds?.[0]?.image?.url;
    expect(url).toMatch(
      /^https:\/\/events26\.example\/cdn-cgi\/image\/width=512,format=auto\/v1\/projects\/g1\/icon\?v=\d+$/,
    );
    // Discord のキャッシュに更新前の画像が残らないよう、アイコンにも版を付ける。
    expect(sent[0]?.avatar_url).toContain("?v=");
  });

  test("アイコンの更新以外では画像を添えない", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port, BASE_URL).notify({
      type: "updated",
      projectId: project.id,
      project,
    });

    expect(sent[0]?.embeds?.[0]?.image).toBeUndefined();
    expect(sent[0]?.avatar_url).not.toContain("?v=");
  });

  test("送信の失敗は握り潰さない", async () => {
    const port: DiscordPort = {
      send: vi.fn().mockRejectedValue(new Error("boom")),
    };

    await expect(
      new ProjectNotifier(port, BASE_URL).notify({
        type: "deleted",
        projectId: "g1",
      }),
    ).rejects.toThrow("boom");
  });
});
