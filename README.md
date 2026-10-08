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

## Workers Cache

staging / prod の両環境で Workers Cache を有効にしています。以下の成功応答に
`Cache-Control: public, max-age=0, s-maxage=86400, must-revalidate` を設定し、
Cloudflare 側の TTL を24時間にします。ブラウザは毎回再確認します。

| GET                               | Cache-Tag                      |
| --------------------------------- | ------------------------------ |
| `/v1/projects`                    | `projects-query`               |
| `/v1/projects/:projectId`         | `projects-{projectId}`         |
| `/v1/projects/:projectId/details` | `projects-{projectId}-details` |

一覧は Workers Cache の標準キー（パスとクエリ文字列）でキャッシュします。
クエリの値や順序が違う URL は別のキャッシュになります。
これはキャッシュの区別であり、一覧 API に絞り込み機能を追加するものではありません。
各応答に ETag を付け、条件付きリクエストで内容が変わらなければ304を返します。
エラー応答・管理用 API・その他の未指定ルートは `no-store` にし、
アイコンは既存の再検証用 Cache-Control を維持します。
ID に空白や日本語などが含まれる場合、タグ中の ID は URL エンコードします。
タグが1024文字を超える応答はキャッシュしません。

DB の変更が成功した後、同じ Worker の `cloudflare:workers` の `cache` から操作します。

| 書き込み                                                                               | キャッシュ操作                                                  |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `POST /admin/v1/projects`、`POST /admin/v1/projects/bulk`                              | `projects-query` を invalidate                                  |
| `PUT /admin/v1/projects/:projectId`、`PATCH /admin/v1/projects/:projectId/description` | `projects-{projectId}` を purge、`projects-query` を invalidate |
| `DELETE /admin/v1/projects/:projectId`                                                 | 企画と詳細のタグを purge、`projects-query` を invalidate        |
| `PUT/DELETE /admin/v1/projects/:projectId/details/menu`、`.../additionalInfo`          | `projects-{projectId}-details` を purge                         |

キャッシュ操作は完了を待ち、Cloudflare が失敗を返した場合は API も500を返します。
その場合でも DB の変更は既に保存されています。
ローカル開発など Workers Cache が無効な環境ではキャッシュ操作をスキップします。
テストではキャッシュ API をモックしてヘッダ・再検証・更新後の操作を確認します。
実際の HIT とグローバルな無効化は、デプロイ後に `Cf-Cache-Status` と更新前後の本文で確認してください。

仕様: [設定](https://developers.cloudflare.com/workers/cache/configuration/)、
[キャッシュキー](https://developers.cloudflare.com/workers/cache/cache-keys/)、
[purge / invalidate](https://developers.cloudflare.com/workers/cache/purge/)。

## Discord 通知

`/admin` 配下の企画情報の変更(登録・一括登録・更新・説明更新・アイコン更新・アイコン削除・削除、
メニューと追加情報の更新・削除)を Discord の incoming webhook へ通知します。
同じ値の再保存や未登録値の削除も成功時は通知します。通知はベストエフォートで、送信に失敗しても API の
応答は変わらず `console.warn` がログに残るだけです。

企画本体の通知は「団体ID 団体名」を名乗り、その企画のアイコンをアイコンとして表示します。
メニューと追加情報の通知は企画 ID と更新内容を表示します。アイコンの
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

`invalidate()` の型も `wrangler types` で生成しています。Wrangler 4.147.0 に
同梱される workerd にはこの型がないため、`package.json` の `overrides` で
workerd 1.20261006.1 を指定しています。Wrangler がこの版以降を同梱するようになれば
override を削除できます。ローカルの `.dev.vars` のキーを生成型に含めず再生成する場合は
`bun run cf-typegen --env-file /dev/null` を使います。

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
