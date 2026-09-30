import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { DiscordService } from "./discord_service";
import { ProjectNotifier, type ProjectEvent } from "./project_notifier";

/**
 * 企画への変更を Discord へ通知する。通知はベストエフォートで、失敗しても
 * API の応答は変えず warn を残すだけに留める。webhook 未設定なら何もしない。
 */
export const notifyProject = async (
  c: Context<{ Bindings: Bindings }>,
  event: ProjectEvent,
): Promise<void> => {
  const webhookUrl = c.env.DISCORD_WEBHOOK_URL;

  if (webhookUrl === undefined || webhookUrl === "") {
    return;
  }

  // アイコンの URL は公開 API と同じオリジンから引く。admin も公開ルートも
  // 同じ custom domain に載っているので、受け取ったリクエストの origin でよい。
  const notifier = new ProjectNotifier(
    new DiscordService(webhookUrl),
    new URL(c.req.url).origin,
  );

  const sending = notifier.notify(event).catch((error: unknown) => {
    const target =
      event.type === "bulk_created"
        ? `${String(event.projects.length)} projects`
        : event.projectId;

    console.warn(
      `Failed to notify Discord of project ${event.type} (${target})`,
      error,
    );
  });

  try {
    // 応答を通知の完了まで待たせない。
    c.executionCtx.waitUntil(sending);
  } catch {
    // ExecutionContext 無しで呼ばれた場合は、送信が打ち切られないようここで待つ。
    await sending;
  }
};
