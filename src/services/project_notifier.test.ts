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
  test("企画つきの通知に ID・企画名・団体名を載せる", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port).notify({
      type: "created",
      projectId: project.id,
      project,
    });

    const embed = sent[0]?.embeds?.[0];
    expect(embed?.title).toBe("企画を登録しました");
    expect(embed?.fields).toEqual([
      { name: "企画ID", value: "g1", inline: true },
      { name: "企画名", value: "テスト企画", inline: true },
      { name: "団体名", value: "テスト団体", inline: true },
    ]);
  });

  test("説明の更新では説明本文も載せる", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port).notify({
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

    await new ProjectNotifier(port).notify({
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

    await new ProjectNotifier(port).notify({
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

    await new ProjectNotifier(port).notify({
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

    await new ProjectNotifier(port).notify({
      type: "icon_deleted",
      projectId: "g1",
    });

    expect(sent[0]?.embeds?.[0]?.fields).toEqual([
      { name: "企画ID", value: "g1", inline: true },
    ]);
  });

  test("本文由来のメンションを飛ばさない", async () => {
    const { port, sent } = fakeDiscord();

    await new ProjectNotifier(port).notify({
      type: "deleted",
      projectId: "g1",
      project: { ...project, projectName: "@everyone" },
    });

    expect(sent[0]?.allowed_mentions).toEqual({ parse: [] });
  });

  test("送信の失敗は握り潰さない", async () => {
    const port: DiscordPort = {
      send: vi.fn().mockRejectedValue(new Error("boom")),
    };

    await expect(
      new ProjectNotifier(port).notify({ type: "deleted", projectId: "g1" }),
    ).rejects.toThrow("boom");
  });
});
