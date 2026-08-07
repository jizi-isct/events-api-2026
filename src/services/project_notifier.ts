import type { Occasion } from "../models/occasion";
import type { Project, ProjectId } from "../models/project";
import type { Time } from "../models/time";
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
      /** 変更前の企画。更新系の操作で、何が変わったかを出すために使う。 */
      previous?: Project;
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
/** Discord の embed field value の上限。 */
const MAX_FIELD_LENGTH = 1024;
/** Discord の embed description の上限。 */
const MAX_EMBED_DESCRIPTION_LENGTH = 4096;
/** 変更点の 1 項目あたりに出す値の長さ。差分の見通しを優先して短く保つ。 */
const MAX_CHANGE_VALUE_LENGTH = 100;
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

const PROJECT_TYPE_LABELS: Record<Project["type"], string> = {
  "food-stall": "屋台",
  general: "一般",
  laboratory: "研究室",
  stage: "ステージ",
};

const yesNo = (value: boolean): string => (value ? "はい" : "いいえ");

const formatTime = (time: Time): string =>
  `${String(time.date)}日目 ${String(time.hour)}:${String(time.minute).padStart(2, "0")}`;

const formatOccasion = (occasion: Occasion): string =>
  `${occasion.place ?? "場所未定"} ${formatTime(occasion.timeRange.start)}〜${formatTime(occasion.timeRange.end)}`;

const formatOccasions = (occasions: Occasion[]): string =>
  occasions.length === 0
    ? "なし"
    : occasions.map((occasion) => `・${formatOccasion(occasion)}`).join("\n");

/** タグは種別ごとに形が違う。API の値をそのまま出して取り違えを防ぐ。 */
const formatTags = (project: Project): string | null => {
  switch (project.type) {
    case "general":
      return project.tag.length === 0 ? "なし" : project.tag.join(", ");
    case "food-stall":
      return project.tag.length === 0
        ? "なし"
        : project.tag
            .map((tag) =>
              tag.tag === "drink" ? tag.tag : `${tag.tag}/${tag.tag2}`,
            )
            .join(", ");
    default:
      // 研究室企画とステージ企画はタグを持たない。
      return null;
  }
};

type Field = { name: string; value: string; inline: boolean };

/** 企画の全項目を embed の field として並べる。 */
const projectFields = (project: Project): Field[] => {
  const fields: Field[] = [
    { name: "企画ID", value: project.id, inline: true },
    { name: "種別", value: PROJECT_TYPE_LABELS[project.type], inline: true },
    { name: "企画名", value: project.projectName, inline: true },
    { name: "団体名", value: project.groupName, inline: true },
    { name: "子ども向け", value: yesNo(project.isChildFriendly), inline: true },
    { name: "おすすめ", value: yesNo(project.isRecommended), inline: true },
  ];

  if (project.type === "laboratory") {
    fields.push({ name: "ツアー", value: yesNo(project.isTour), inline: true });
  }

  const tags = formatTags(project);

  if (tags !== null) {
    fields.push({ name: "タグ", value: tags, inline: false });
  }

  fields.push(
    {
      name: "開催予定",
      value: truncate(formatOccasions(project.occasions), MAX_FIELD_LENGTH),
      inline: false,
    },
    {
      name: "説明",
      value:
        project.description === ""
          ? "なし"
          : truncate(project.description, MAX_DESCRIPTION_LENGTH),
      inline: false,
    },
  );

  return fields;
};

/**
 * 変更前後で値が変わった項目を「項目: 旧 → 新」の形に並べる。
 * 表示に使う field をそのまま比較するので、出ている値と変更点がずれない。
 */
const describeChanges = (previous: Project, current: Project): string => {
  const before = new Map(
    projectFields(previous).map((field) => [field.name, field.value]),
  );
  const after = new Map(
    projectFields(current).map((field) => [field.name, field.value]),
  );
  const names = [...new Set([...before.keys(), ...after.keys()])];

  const changes = names
    // 企画 ID は変えられないので、差分としては出てこない。
    .filter((name) => name !== "企画ID" && before.get(name) !== after.get(name))
    .map((name) => {
      const from = truncate(
        before.get(name) ?? "なし",
        MAX_CHANGE_VALUE_LENGTH,
      );
      const to = truncate(after.get(name) ?? "なし", MAX_CHANGE_VALUE_LENGTH);

      return `- **${name}**: ${from} → ${to}`;
    });

  return changes.length === 0
    ? "変更なし"
    : truncate(changes.join("\n"), MAX_EMBED_DESCRIPTION_LENGTH);
};

const fieldsOf = (event: ProjectEvent): Field[] => {
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

  return event.project === undefined
    ? [{ name: "企画ID", value: event.projectId, inline: true }]
    : projectFields(event.project);
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
          // 全項目を並べると差分が埋もれるので、変わった項目を先頭にまとめる。
          ...(event.type !== "bulk_created" &&
          event.previous !== undefined &&
          event.project !== undefined
            ? { description: describeChanges(event.previous, event.project) }
            : {}),
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
