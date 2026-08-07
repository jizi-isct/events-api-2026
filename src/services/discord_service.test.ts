import { describe, expect, test, vi } from "vitest";
import { DiscordService, DiscordWebhookError } from "./discord_service";

const WEBHOOK_URL = "https://discord.com/api/webhooks/1/token";

describe("send", () => {
  test("webhook URL へ JSON で POST する", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const service = new DiscordService(WEBHOOK_URL, { fetch });

    await service.send({ content: "hello" });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe(WEBHOOK_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ content: "hello" });
  });

  test("429 は retry_after だけ待ってから再送する", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ retry_after: 0.001 }), { status: 429 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = new DiscordService(WEBHOOK_URL, { fetch });

    await service.send({ content: "hello" });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("再試行の上限を超えたら DiscordWebhookError を投げる", async () => {
    const fetch = vi.fn(
      async () => new Response("upstream is down", { status: 503 }),
    );
    const service = new DiscordService(WEBHOOK_URL, { fetch, maxRetries: 1 });

    await expect(service.send({ content: "hello" })).rejects.toEqual(
      new DiscordWebhookError(503, "upstream is down"),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("再試行しても意味のない 4xx は即座に失敗する", async () => {
    const fetch = vi.fn(
      async () => new Response("invalid webhook token", { status: 401 }),
    );
    const service = new DiscordService(WEBHOOK_URL, { fetch });

    await expect(service.send({ content: "hello" })).rejects.toBeInstanceOf(
      DiscordWebhookError,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
