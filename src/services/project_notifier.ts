import type { Project, ProjectId } from "../models/project";
import type { DiscordPort } from "./discord_service";

/** admin API が企画に加えた変更の種類。 */
export type ProjectEventType =
  | "created"
  | "bulk_created"
  | "updated"
  | "description_updated"
  | "icon_updated"
  | "icon_deleted"
  | "deleted";

export type ProjectEvent =
  | {
      type: Exclude<ProjectEventType, "bulk_created">;
      projectId: ProjectId;
      /** 変更後の企画。削除など内容を伴わない操作では省略する。 */
      project?: Project;
    }
  | {
      /** 一括登録は件数が多くなるため、企画ごとではなく一通にまとめる。 */
      type: "bulk_created";
      projects: Project[];
    };

const PRESENTATION: Record<ProjectEventType, { title: string; color: number }> =
  {
    created: { title: "企画を登録しました", color: 0x57f287 },
    bulk_created: { title: "企画を一括登録しました", color: 0x57f287 },
    updated: { title: "企画を更新しました", color: 0x5865f2 },
    description_updated: { title: "企画説明を更新しました", color: 0x5865f2 },
    icon_updated: { title: "企画アイコンを更新しました", color: 0x5865f2 },
    icon_deleted: { title: "企画アイコンを削除しました", color: 0xfaa61a },
    deleted: { title: "企画を削除しました", color: 0xed4245 },
  };

/** 表示上の目安。Discord の embed field value は 1024 文字が上限。 */
const MAX_DESCRIPTION_LENGTH = 300;
/** 一括登録の通知に並べる企画 ID の数。1024 文字の上限に収まる範囲。 */
const MAX_LISTED_IDS = 50;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const fieldsOf = (event: ProjectEvent) => {
  if (event.type === "bulk_created") {
    const ids = event.projects.map((project) => project.id);
    const listed = ids.slice(0, MAX_LISTED_IDS);
    const rest = ids.length - listed.length;

    return [
      { name: "件数", value: String(ids.length), inline: true },
      {
        name: "企画ID",
        value: listed.join(", ") + (rest > 0 ? ` ほか ${String(rest)} 件` : ""),
        inline: false,
      },
    ];
  }

  const fields = [{ name: "企画ID", value: event.projectId, inline: true }];

  if (event.project === undefined) {
    return fields;
  }

  fields.push(
    { name: "企画名", value: event.project.projectName, inline: true },
    { name: "団体名", value: event.project.groupName, inline: true },
  );

  // 説明そのものが変更点である操作でだけ本文を載せる。全文更新でも出すと
  // 通知が長くなりすぎるため。
  if (event.type === "description_updated") {
    fields.push({
      name: "説明",
      value: truncate(event.project.description, MAX_DESCRIPTION_LENGTH),
      inline: false,
    });
  }

  return fields;
};

/** 企画への変更を Discord へ流す。送信手段は DiscordPort に委ねる。 */
export class ProjectNotifier {
  constructor(private readonly discord: DiscordPort) {}

  async notify(event: ProjectEvent): Promise<void> {
    const { title, color } = PRESENTATION[event.type];

    await this.discord.send({
      embeds: [
        {
          title,
          color,
          fields: fieldsOf(event),
          timestamp: new Date().toISOString(),
        },
      ],
      // 通知に企画名や説明がそのまま載るため、本文由来のメンションは飛ばさない。
      allowed_mentions: { parse: [] },
    });
  }
}
