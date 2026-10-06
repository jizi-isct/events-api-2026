# Workers Cache 仕様監査

監査対象: `07aa0f1` (`feat/workers-cache-24h`)。2026-10-06 実施。

正常系の全更新経路に対して、変更される取得結果を覆う無効化処理がある。
ただし、障害後の回復に反例があり、「どの状況でも古いキャッシュが残らない」とは証明できない。
この監査では実装を変更せず、検証用テストと根拠を追加した。

## 証明する範囲と前提

対象は、この Worker の HTTP API を通じた変更と、この Worker が所有するキャッシュ。
DB の直接編集、他 Worker の書き込み、外部の共有キャッシュは対象外とする。

正常系の議論では、次を前提にする。

1. DB の変更と、その後のキャッシュ操作が両方成功する。
2. Workers Cache が有効で、API が利用できる。
3. 対象キャッシュの保存と書き込みを逐次実行し、purge と進行中の保存を競合させない。
4. Cloudflare の無効化が対象キャッシュまで伝播した後の読み取りを扱う。

`purge()` / `invalidate()` の `success` は受付成功を示す。
全拠点で同時に切り替わることまでアプリの `await` から導くことはできない。
[Cloudflare の受付結果・伝播仕様](https://developers.cloudflare.com/workers/cache/purge/)

## 取得結果の依存関係

| 記号 | 取得結果                              | 参照データ                                | タグ                   |
| ---- | ------------------------------------- | ----------------------------------------- | ---------------------- |
| Q    | `GET /v1/projects` の全クエリ変種     | projects、project_tags、project_occasions | `projects-query`       |
| P(i) | `GET /v1/projects/:projectId`         | 上記3表の企画 i の行                      | `projects-{i}`         |
| D(i) | `GET /v1/projects/:projectId/details` | project_details の企画 i の行             | `projects-{i}-details` |

実装上、タグの ID は URL エンコードする。1024文字を超えるタグでは応答を保存しない。
404 は `no-store` なので、未登録企画や未登録詳細の「存在しない」という結果は残らない。
アイコンは R2 を読み、既存の `max-age=0, must-revalidate` で再検証する。
企画 JSON はアイコン本体や更新日時を含まないため、アイコン変更は Q / P / D を変更しない。

Workers Cache のキーにはパスとクエリ文字列が含まれ、すべての一覧変種が同じ Q タグを持つ。
したがって、一度のタグ invalidation で任意のクエリ文字列を対象にできる。
クエリの順序が異なる場合は別のキーになるが、無効化対象からは漏れない。
[Cloudflare のキャッシュキー仕様](https://developers.cloudflare.com/workers/cache/cache-keys/)

## 全書き込み経路の照合

次のパスは `/admin/v1/projects` を基点とする。

| 経路                                               | 件数 | 影響する既存キャッシュ | 実装の操作                             |
| -------------------------------------------------- | ---- | ---------------------- | -------------------------------------- |
| `POST /`、`POST /bulk`                             | 2    | Q                      | Q を invalidate                        |
| `PUT /:projectId`、`PATCH /:projectId/description` | 2    | Q、P(i)                | Q を invalidate、P(i) を purge         |
| `DELETE /:projectId`                               | 1    | Q、P(i)、D(i)          | Q を invalidate、P(i) と D(i) を purge |
| `PUT/DELETE /:projectId/details/menu`              | 2    | D(i)                   | D(i) を purge                          |
| `PUT/DELETE /:projectId/details/additionalInfo`    | 2    | D(i)                   | D(i) を purge                          |
| `PUT/DELETE /:projectId/icon`                      | 2    | なし                   | JSON キャッシュの操作なし              |

合計11経路。`cache_audit.test.ts` で Hono の実際のルート一覧と一致することを検査する。

POST の場合、変更前には企画が存在せず、その404は保存されないため、既存の P(i) / D(i) はない。
企画 PUT は主キーと project_details を変更しないため、D(i) を無効化する必要はない。
企画 DELETE は外部キーの `ON DELETE CASCADE` で詳細も削除するため、D(i) の purge が必要であり、実装されている。

各経路 m について「本文が変わり得る既存キャッシュの集合」を A(m)、
「purge または invalidate の対象集合」を I(m) とすると、上表の全経路で
`A(m) ⊆ I(m)` が成立する。
無効化された一覧は ETag で再検証し、変更時は200と新しい本文、未変更時は304を返す。
したがって、前述の前提下では、API の更新経路に起因する無効化対象の漏れはない。

## 反例: キャッシュ操作失敗後の再試行で回復しない

DB とキャッシュ API は同じトランザクションではない。現在は無効化の永続的な再試行処理もない。

### POST / POST bulk

1. 古い一覧 Q がキャッシュされている。
2. DB への追加が成功する。
3. invalidate が失敗し、API は500を返す。
4. 同じ POST を再試行すると、既存 ID の判定で409を返す。
5. 再試行では invalidate に到達しない。旧一覧を残したままになり得る。

根拠: `src/routes/admin_projects.ts` の存在確認と `invalidateProjectQueries()` の呼び出し順序。
単体登録と一括登録の両方をテストで再現した。

### DELETE

1. 企画 P(i) と詳細 D(i) がキャッシュされている。
2. DB の企画と詳細の削除が成功する。
3. purge が失敗し、API は500を返す。
4. 同じ DELETE を再試行すると、削除対象が存在せず404を返す。
5. 再試行では purge に到達しない。削除済みの情報を残したままになり得る。

根拠: `src/routes/admin_projects.ts` の `ProjectNotFoundError` での早期 return。
テストは、DB から削除済みであることと、再試行でも purge の呼び出しが1回のままであることを確認する。

この反例では、他の無効化・デプロイ・追い出しがなければ、旧キャッシュが残り TTL（最大24時間）の間使われ得る。
API が500を返すことは無効化失敗の検知にはなるが、回復の保証にはならない。
対処には少なくとも無効化を再実行できる経路が必要である。
Worker の中断まで含めて回復を保証するなら、DB と同じトランザクションで無効化待ちを記録する outbox 等と、再試行処理が必要になる。

## 未証明: 進行中の GET と purge の競合

次の順序はアプリ内で再現できる。

1. GET が更新前の DB の値を取得し、応答の完了が遅れる。
2. PUT が新しい値を書き込み、purge の受付が成功し、200を返す。
3. 遅れていた GET が旧本文と `s-maxage=86400` を返す。

`cache_audit.test.ts` は、この順序と旧本文の応答までを確認する。
Cloudflare がその応答を保存するか、進行中の保存を無効化するかはモックでは確認できない。
公式ドキュメントの「グローバルに伝播する」という記載だけから、この競合の扱いは断定できない。
これは edge で古いデータが再保存されることを証明したテストではない。
競合時も古い情報を再保存しないことを保証したい場合は、Cloudflare の保証範囲または実環境での確認が別途必要になる。

## Workers Cache 以外の共有キャッシュ

現在の `s-maxage=86400` は、Cloudflare 以外の共有キャッシュにも24時間の保存を許可する。
ブラウザの `max-age=0` だけから、下流の共有プロキシや CDN も毎回再検証するとは言えない。
Workers Cache の purge はそれらを無効化しないため、上記の証明は Worker 自身のキャッシュに限定する。
Workers Cache だけに24時間の TTL を与える要件なら、`Cloudflare-CDN-Cache-Control` と
下流向けの `Cache-Control` を分ける必要がある。
[Cloudflare のキャッシュ制御ヘッダの優先順位](https://developers.cloudflare.com/workers/cache/configuration/#header-precedence)

## 検証方法

- `src/routes/cache.test.ts`: TTL、タグ、ETag、304 の CORS、HEAD、エラー非保存、更新時の操作、DB・キャッシュ API の失敗を検証。
- `src/routes/cache_audit.test.ts`: 全経路の列挙、データ依存関係、POST / DELETE の再試行の反例、進行中 GET の競合を検証。
- Workers Cache はモック。実際のエッジでの保存、HIT、TTL の経過、拠点間の無効化を検証したとは扱わない。
- Wrangler が解決した staging / prod の両設定で `cache.enabled === true` を確認。
- 型検査、lint、整形チェック、生成型の整合性を検査。

結果: 15ファイル・284テストが成功。うち監査で追加した7テストには、既知の反例の再現を含む。
型検査、lint、整形チェック、生成型の整合性もすべて成功した。
デプロイと実環境への書き込みは行っていない。

再現コマンド:

```sh
bun run test -- src/routes/cache.test.ts src/routes/cache_audit.test.ts
bun run test
bun run typecheck
bun run lint
bun run format:check
bun run cf-typegen --env-file /dev/null --check
```

監査テストの「既知の反例」は、現在の欠点が再現することを成功条件にしている。
テストの成功を、障害後の回復が保証されたという意味で解釈しないこと。
修正時には、無効化が再試行されて回復することを検証するテストへ置き換える。
