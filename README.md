# events-api-2026

工大祭企画情報 API の Cloudflare Worker です。

## ローカル開発

```sh
bun install
bun run dev
```

## デプロイ

GitHub Actions の `Deploy Worker` workflow が環境を選択してデプロイします。

| Trigger                       | Wrangler environment | Custom domain                   |
| ----------------------------- | -------------------- | ------------------------------- |
| `main` branch への push       | `staging`            | `events26-staging.koudaisai.jp` |
| GitHub Release の `published` | `prod`               | `events26.koudaisai.jp`         |

workflow は GitHub Environment `main` に登録済みの次の値を使用します。

- secret `CLOUDFLARE_API_TOKEN`
- variable `CLOUDFLARE_ACCOUNT_ID`

Workerをデプロイする前に、対象環境のremote D1へ未適用migrationを順番に適用します。migrationが失敗した場合はWorkerをデプロイしません。Cloudflare API tokenにはWorkerのデプロイ権限に加えてD1の編集権限が必要です。

デプロイ後は対応する custom domain の `/openapi.json` が成功することまで確認します。GitHub Actions を唯一の自動デプロイ経路とし、Cloudflare Workers Builds の automatic deploy は併用しません。

ローカルから明示的にデプロイする場合は、対象環境を指定します。

```sh
bun run deploy:staging
bun run deploy:prod
```

## Discord 通知

`/admin` 配下の企画情報の変更(登録・一括登録・更新・説明更新・アイコン更新・アイコン削除・削除)を
Discord の incoming webhook へ通知します。通知はベストエフォートで、送信に失敗しても API の
応答は変わらず `console.warn` がログに残るだけです。

通知は「団体ID 団体名」を名乗り、その企画のアイコンをアイコンとして表示します。アイコンの
更新では更新後の画像を embed にも添えます。いずれの画像も `/cdn-cgi/image/` の画像最適化を
通した URL で参照するため、対象 zone で Image Transformations が有効になっている必要が
あります。`/cdn-cgi/image` は Access を bypass する application として Terraform 側で
公開しています(変換元の `/v1` のアイコンが元から公開されているため、変換後だけを塞いでも
守るものがありません)。

webhook URL はトークンを含むため secret として環境ごとに設定します。

```sh
bunx wrangler secret put DISCORD_WEBHOOK_URL --env staging
bunx wrangler secret put DISCORD_WEBHOOK_URL --env prod
```

未設定の環境では通知しません。ローカルでは `.dev.vars` に書けば有効になります。

## 型生成

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```sh
bun run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
