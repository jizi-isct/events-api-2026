# Infrastructure

Cloudflare Access で次の管理 API だけを保護する Terraform stack です。

- staging: `events26-staging.koudaisai.jp/admin` とその配下
- prod: `events26.koudaisai.jp/admin` とその配下

公開 API の `/v1` は Access の対象にしません。Zero Trust organization、Identity Provider、Access Group、Service Token 自体は中央の infrastructure repository の所有物とし、この stack では既存 ID を参照します。

Identity Provider はログイン手段を制限するだけで、管理者の認可条件にはしません。管理者は既存 Access Group または個別メールアドレスで必ず明示します。

Terraform state は Wasabi の S3-compatible API に保存します。backend 設定と credentials は `backend.wasabi.sops.env` にまとめ、SOPS + age で暗号化してコミットします。age の秘密鍵、復号済み設定、実 tfvars、state、plan は Git にコミットしません。

## 事前準備

### Wasabi

state 専用の private bucket と、root ではない専用 sub-user の access key を用意してください。

- bucket は Versioning を有効にする
- state / lock key には Compliance や Object Lock の retention を設定しない
- bucket の実リージョンに対応する HTTPS endpoint を使う
- bucket に `s3:ListBucket`
- `events-api-2026/access/terraform.tfstate` に `s3:GetObject`, `s3:PutObject`
- 同じ key の `.tflock` に `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`

### Cloudflare

API token には対象 Account の次の権限が必要です。

- `Access: Apps and Policies Write`
- `Access: Organizations, Identity Providers, and Groups Read`

## SOPS + age

`backend.wasabi.sops.env` は、中央 infrastructure repository と同じ2つの age recipient（インフラ担当者 / GitHub Actions）で暗号化します。recipient は公開鍵なので `.sops.yaml` と暗号文へのコミットが前提です。age の秘密鍵は repository の外で管理してください。

SOPS 3.10 以上、age、Terraform を用意します。macOS で SOPS が既定で探す age identity は `$HOME/Library/Application Support/sops/age/keys.txt` です。別の場所を使う場合は `SOPS_AGE_KEY_FILE`、CI では secret store から作成した mode `0600` の一時 identity file または `SOPS_AGE_KEY_CMD` を使います。

初回は repository root から暗号化ファイルを編集し、placeholder を実値へ置き換えます。

```sh
sops infra/backend.wasabi.sops.env
```

設定する値は次の5つです。

- `TF_BACKEND_BUCKET`: state 専用 bucket
- `TF_BACKEND_REGION`: bucket の実リージョン
- `TF_BACKEND_S3_ENDPOINT`: そのリージョンの Wasabi HTTPS endpoint
- `AWS_ACCESS_KEY_ID`: state 専用 sub-user の access key
- `AWS_SECRET_ACCESS_KEY`: 対応する secret key

recipient を変更したときは `.sops.yaml` の変更だけでは既存暗号文へ反映されません。暗号文の key slot を更新し、権限剥奪や漏えいの場合は Wasabi access key 自体も rotate します。

```sh
sops updatekeys infra/backend.wasabi.sops.env
```

## GitHub Actions

`.github/workflows/infra-deploy.yml` は、main 向け pull request では credentials を使わず Terraform の format / validate を行い、infra 関連ファイルが main へ push されたときに plan と apply を続けて実行します。pull request の merge commit だけでなく main への直接 push でも起動するため、merge 経由に限定するには main の branch ruleset が必要です。

deploy job は GitHub Environment `infrastructure` を参照します。workflow を main へ merge する前に environment を作り、deployment branch を `main` のみに制限してください。完全自動 deploy にする場合は required reviewer を設定しません。required reviewer の承認は deploy job 全体、つまり plan の作成前に行われるため、生成された plan を確認する承認 gate ではありません。

初回の workflow merge より先に、次の準備を完了します。

1. Wasabi bucket / sub-user を作成し、`backend.wasabi.sops.env` の5つの placeholder を実値へ変更して暗号文を commit
2. ローカルから同じ backend を初期化し、既存 Access application / policy があれば import して staging の plan を確認
3. GitHub Environment `infrastructure` を作成し、以下の secrets / variables と main 限定 rule を設定
4. main の ruleset を有効化してから workflow の pull request を merge

Environment secrets は次の2つです。

- `SOPS_AGE_KEY`: `.sops.yaml` の GitHub Actions recipient に対応する age private identity
- `CLOUDFLARE_API_TOKEN`: 対象 Account 限定の Access 用 API token

Wasabi credentials は暗号化済み `backend.wasabi.sops.env` から取得するため、Actions secrets へ重複登録しません。既存の別 repository の Actions secret は値を読み戻せないため、管理元の password manager などから age identity を取得してください。共通 CI identity の影響範囲を分離する場合は、この repository 専用の age keypairを作り、`.sops.yaml` と暗号文の recipient を更新します。

Environment variables は次のとおりです。set 型の値は JSON 配列で指定します。

| Name                            | Example                                    | Required                |
| ------------------------------- | ------------------------------------------ | ----------------------- |
| `CLOUDFLARE_ACCOUNT_ID`         | `0123456789abcdef0123456789abcdef`         | yes                     |
| `ENABLED_ENVIRONMENTS`          | `["staging"]`                              | no; default is staging  |
| `ALLOWED_IDENTITY_PROVIDER_IDS` | `["00000000-0000-0000-0000-000000000000"]` | yes                     |
| `ALLOWED_ACCESS_GROUP_IDS`      | `["00000000-0000-0000-0000-000000000000"]` | group or email required |
| `ALLOWED_EMAILS`                | `[]`                                       | group or email required |
| `SERVICE_TOKEN_IDS`             | `[]`                                       | no                      |
| `SESSION_DURATION`              | `24h`                                      | no                      |

Environment variable の変更だけでは main push workflow は起動しません。値を変更した後は Actions 画面から `Access infrastructure` を main branch に対して手動実行します。手動実行で deploy できるのも main だけです。

main の ruleset では、少なくとも pull request 経由、review、`Validate Terraform` check の成功を必須にし、force push と branch deletion を禁止します。`infra/**`、`.sops.yaml`、`.github/workflows/**` は CODEOWNERS review の対象にすることを推奨します。

Repository Settings の Actions default workflow permissions も `Read repository contents and packages permissions` にします。この workflow 自体も `contents: read` だけを明示しています。

workflow は同時 apply を直列化し、Wasabi の state lock も利用します。plan は runner の一時領域だけに保存して同じ job で applyし、artifact にはアップロードしません。SOPS から復号した Wasabi credentials は GitHub が自動 mask する Actions secret ではないため、workflow へ `set -x`、環境変数の出力、plan の upload を追加してはいけません。

## 初期化と操作

実 tfvars を作成し、Account ID / Identity Provider ID / 管理者条件を実値へ変更します。

```sh
cd infra
cp terraform.tfvars.example terraform.tfvars
./tf.sh init
```

`tf.sh` は各 Terraform command の間だけ SOPS を復号し、値を子プロセスの環境へ注入します。`init` では bucket / region / endpoint だけを mode `0600` の一時 `.tfbackend` に書き、終了時に削除します。Wasabi credentials は backend config に書かないため、Terraform の `.terraform` backend metadata や保存 plan に credentials がコピーされません。

Cloudflare API token は backend credential と分離し、password manager や CI secret store から親環境へ注入します。`sops exec-env` は親環境を引き継ぐため、`tf.sh` 経由の Terraform から参照できます。

```sh
# Password manager や CI の secret store から注入する。
# export CLOUDFLARE_API_TOKEN=...

./tf.sh plan
./tf.sh apply
```

Wasabi は新しい S3 checksum の既定値と互換性がない場合があるため、`tf.sh` は checksum の計算・検証を `WHEN_REQUIRED` に固定します。secret を command line や shell history に貼り付けないでください。

この stack は staging / prod を同じ state で管理するため、Terraform workspace は追加せず `default` だけを使います。初回は同じ state に対する操作を二つ起動し、片方が `.tflock` を取得できず停止することも確認してください。

backend 設定を変更した場合は、次のように再初期化します。

```sh
./tf.sh init -reconfigure
```

Access application が既に手動または別 stack で作成済みなら、`apply` より先にこの state へ import してください。同じ domain や、より具体的な `/admin/...` path を管理する stack を複数残してはいけません。子 path の application は親の policy を継承せず、より具体的な設定が優先されます。

```sh
./tf.sh import \
  'cloudflare_zero_trust_access_application.admin["staging"]' \
  'accounts/<ACCOUNT_ID>/<STAGING_APPLICATION_ID>'

./tf.sh import \
  'cloudflare_zero_trust_access_application.admin["prod"]' \
  'accounts/<ACCOUNT_ID>/<PROD_APPLICATION_ID>'

./tf.sh import \
  'cloudflare_zero_trust_access_policy.admin_groups[0]' \
  '<ACCOUNT_ID>/<POLICY_ID>'
```

policy を import できるのは account-level reusable policy だけです。application-scoped / inline policy はそのまま import できません。Service Auth policy も引き継ぐ場合は `cloudflare_zero_trust_access_policy.admin_service_auth[0]` へ import します。

import する環境は、先に `enabled_environments` へ含めてください。特に既存 prod application は `prod` を追加した後、`apply` より前に import します。メール認可 policy を引き継ぐ場合の resource address は `cloudflare_zero_trust_access_policy.admin_emails[0]` です。

application の `policies` はこの stack が authoritative に管理します。import 後の plan で、既存の deny / bypass / allow policy が意図せず外れないこと、再利用 policy の変更が他 application に波及しないことを確認してください。

## Wrangler への反映

apply 後に出力される値を `wrangler.jsonc` の `env.staging.vars` / `env.prod.vars` へ反映します。

```sh
./tf.sh output -json wrangler_access_vars
```

Terraform と Wrangler が同じ Worker 設定を同時に所有すると競合するため、この stack は Worker vars 自体を更新せず、必要な値だけを出力します。

初回 rollout は `enabled_environments` を使って一環境ずつ行います。Access application には `prevent_destroy` があるため、一度追加した環境を集合から取り除くことはできません。

1. staging の既存 Access application / 子 path を確認し、必要なら import
2. `enabled_environments = ["staging"]` で Terraform を apply し、AUD と team domain を取得
3. `wrangler.jsonc` の staging vars を更新し、`wrangler deploy --env staging --minify`
4. staging の対話ログイン、Service Token、未認証リクエストが origin へ到達しないこと（302 / 401 / 403）、公開 `/v1` を確認
5. `enabled_environments = ["staging", "prod"]` に変更し、既存 prod application があれば import してから apply
6. 同じ確認を prod で行う

現在の root `deploy` script は `--env` を付けないため、この rollout には使用しません。named environment を明示しない deploy では DB / Access vars が設定されません。

## 参考資料

- [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Cloudflare Terraform Access resources](https://developers.cloudflare.com/api/terraform/resources/zero_trust/)
- [SOPS documentation](https://getsops.io/docs/)
- [SOPS age identities](https://getsops.io/docs/usage/identities/age/)
- [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [Wasabi region endpoints](https://docs.wasabi.com/v1/docs/service-urls-for-wasabis-storage-regions)
