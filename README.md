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

デプロイ後は対応する custom domain の `/openapi.json` が成功することまで確認します。GitHub Actions を唯一の自動デプロイ経路とし、Cloudflare Workers Builds の automatic deploy は併用しません。

ローカルから明示的にデプロイする場合は、対象環境を指定します。

```sh
bun run deploy:staging
bun run deploy:prod
```

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
