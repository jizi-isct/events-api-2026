/**
 * Discord の埋め込み。フィールド名は Discord API のものをそのまま使い、
 * 変換を挟まないことで API ドキュメントとの対応を保つ。
 * @see https://discord.com/developers/docs/resources/message#embed-object
 */
export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  /** ISO 8601 形式のタイムスタンプ。 */
  timestamp?: string;
  /** 左端に表示される色。0xRRGGBB を 10 進数で指定する。 */
  color?: number;
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
};

/** webhook で送信するメッセージ。content と embeds の少なくとも一方が要る。 */
export type DiscordMessage = {
  content?: string;
  embeds?: DiscordEmbed[];
  /** webhook に設定された名前を上書きする。 */
  username?: string;
  avatar_url?: string;
  /**
   * 実際にメンションを飛ばす対象。既定では content 中の @everyone などが
   * そのまま通知になるため、意図しないメンションは `{ parse: [] }` で止める。
   */
  allowed_mentions?: {
    parse?: ("roles" | "users" | "everyone")[];
    roles?: string[];
    users?: string[];
  };
};

/**
 * Discord への通知手段を表す port。
 * 呼び出し側はこの型にだけ依存し、テストでは差し替える。
 */
export interface DiscordPort {
  send(message: DiscordMessage): Promise<void>;
}

/** Discord が 2xx 以外を返したことを表す。 */
export class DiscordWebhookError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Discord webhook failed with ${status}: ${body}`);
    this.name = "DiscordWebhookError";
  }
}

export type DiscordServiceOptions = {
  /** 429 と 5xx に対する再試行の上限回数。既定は 2。 */
  maxRetries?: number;
  /** テストで差し替えるための fetch。 */
  fetch?: typeof fetch;
};

/** レスポンスボディの読み取りに失敗しても送信の失敗理由を潰さない。 */
const readBody = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

/** Discord が返す待ち時間(秒)。取れなければ null。 */
const retryAfterMs = (response: Response, body: string): number | null => {
  try {
    const parsed: unknown = JSON.parse(body);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "retry_after" in parsed &&
      typeof parsed.retry_after === "number"
    ) {
      return parsed.retry_after * 1000;
    }
  } catch {
    // JSON でなければヘッダーへ落とす。
  }

  const header = response.headers.get("Retry-After");
  const seconds = header === null ? Number.NaN : Number(header);

  return Number.isFinite(seconds) ? seconds * 1000 : null;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Discord の incoming webhook へメッセージを送る。
 * webhook URL はトークンを含む秘密情報なので、エラーメッセージにも載せない。
 */
export class DiscordService implements DiscordPort {
  private readonly maxRetries: number;
  private readonly fetch: typeof fetch;

  constructor(
    private readonly webhookUrl: string,
    options: DiscordServiceOptions = {},
  ) {
    this.maxRetries = options.maxRetries ?? 2;
    // globalThis に束ね直さないと Workers の fetch が illegal invocation になる。
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * メッセージを送信する。レート制限(429)と一時的な 5xx は上限まで再試行し、
   * それでも成功しなければ DiscordWebhookError を投げる。
   */
  async send(message: DiscordMessage): Promise<void> {
    const body = JSON.stringify(message);

    for (let attempt = 0; ; attempt++) {
      const response = await this.fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (response.ok) {
        return;
      }

      const responseBody = await readBody(response);
      const retryable = response.status === 429 || response.status >= 500;

      if (!retryable || attempt >= this.maxRetries) {
        throw new DiscordWebhookError(response.status, responseBody);
      }

      // 待ち時間の指定が無い 5xx は指数バックオフで下がる。
      await sleep(
        retryAfterMs(response, responseBody) ?? 500 * Math.pow(2, attempt),
      );
    }
  }
}
