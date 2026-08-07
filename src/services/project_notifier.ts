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
/** Discord の username の上限。 */
const MAX_USERNAME_LENGTH = 80;
/** アイコンとして表示される大きさ。Discord の avatar は 128px で足りる。 */
const AVATAR_SIZE = 128;
/** embed に添付する画像の大きさ。Discord の embed image の表示幅に合わせる。 */
const EMBED_IMAGE_SIZE = 512;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

/**
 * 企画アイコンを cdn-cgi の画像最適化を通して取得する URL を組み立てる。
 * 原本は最大 20 MB あり得るので、Discord にそのまま渡さず縮小・再圧縮させる。
 * 正方形であることは登録時に検証済みなので、リサイズは幅だけ指定する。
 */
const optimizedIconUrl = (
  baseUrl: string,
  projectId: ProjectId,
  width: number,
  /** Discord 側のキャッシュを避けるための版。アイコン更新の通知で使う。 */
  version?: string,
): string => {
  const options = `width=${String(width)},format=auto`;
  const source = `v1/projects/${encodeURIComponent(projectId)}/icon`;
  const query = version === undefined ? "" : `?v=${version}`;

  return `${baseUrl}/cdn-cgi/image/${options}/${source}${query}`;
};

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

/** どの企画からの通知かを名乗らせる。団体 ID と団体名を並べる。 */
const usernameOf = (event: ProjectEvent): string | undefined => {
  if (event.type === "bulk_created") {
    return undefined;
  }

  const name =
    event.project === undefined
      ? event.projectId
      : `${event.projectId} ${event.project.groupName}`;

  return truncate(name, MAX_USERNAME_LENGTH);
};

/**
 * 企画への変更を Discord へ流す。送信手段は DiscordPort に委ねる。
 * baseUrl は企画アイコンを配信しているオリジン(例 https://events26.koudaisai.jp)。
 */
export class ProjectNotifier {
  constructor(
    private readonly discord: DiscordPort,
    private readonly baseUrl: string,
  ) {}

  async notify(event: ProjectEvent): Promise<void> {
    const { title, color } = PRESENTATION[event.type];
    // アイコンの更新では、更新後の画像が確実に出るよう版を変えて
    // Discord 側のキャッシュを避ける。
    const version = String(Date.now());

    await this.discord.send({
      username: usernameOf(event),
      avatar_url:
        event.type === "bulk_created"
          ? undefined
          : optimizedIconUrl(
              this.baseUrl,
              event.projectId,
              AVATAR_SIZE,
              event.type === "icon_updated" ? version : undefined,
            ),
      embeds: [
        {
          title,
          color,
          fields: fieldsOf(event),
          timestamp: new Date().toISOString(),
          // 更新したアイコンそのものを添えて、内容を通知だけで確認できるようにする。
          ...(event.type === "icon_updated"
            ? {
                image: {
                  url: optimizedIconUrl(
                    this.baseUrl,
                    event.projectId,
                    EMBED_IMAGE_SIZE,
                    version,
                  ),
                },
              }
            : {}),
        },
      ],
      // 通知に企画名や説明がそのまま載るため、本文由来のメンションは飛ばさない。
      allowed_mentions: { parse: [] },
    });
  }
}
