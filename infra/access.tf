locals {
  protected_application_catalog = {
    staging = {
      name   = "events-api-2026 staging"
      domain = "events26-staging.koudaisai.jp"
    }
    prod = {
      name   = "events-api-2026 prod"
      domain = "events26.koudaisai.jp"
    }
  }

  protected_applications = {
    for environment, application in local.protected_application_catalog :
    environment => application
    if contains(var.enabled_environments, environment)
  }

  public_path_catalog = {
    v1 = {
      name = "public API"
      path = "v1"
    }
    openapi = {
      name = "OpenAPI"
      path = "openapi.json"
    }
    # Discord の通知に載せる企画アイコンは、cdn-cgi の画像最適化を通した URL で
    # 参照する。変換元は既に公開している /v1 のアイコンなので、変換後だけを
    # 塞いでも守るものが無い。Discord からも読めるよう bypass する。
    image_resizing = {
      name = "image resizing"
      path = "cdn-cgi/image"
    }
  }

  public_applications = {
    for application in flatten([
      for environment, protected_application in local.protected_applications : [
        for path_key, public_path in local.public_path_catalog : {
          key    = "${environment}_${path_key}"
          name   = "${protected_application.name} ${public_path.name}"
          domain = "${protected_application.domain}/${public_path.path}"
        }
      ]
    ]) : application.key => application
  }
}

# Zero Trust organization 自体と Identity Provider は中央の infrastructure
# repository が所有する。この stack では読み取りだけ行う。
data "cloudflare_zero_trust_organization" "current" {
  account_id = var.cloudflare_account_id
}

resource "cloudflare_zero_trust_access_policy" "admin_login" {
  account_id       = var.cloudflare_account_id
  name             = "events-api-2026 login"
  decision         = "allow"
  session_duration = var.session_duration

  # 中央 infrastructure repository の JIZI Portal Auth と同じく、
  # 指定した Identity Provider でログインできたユーザーを許可する。
  include = [
    for id in sort(tolist(var.allowed_identity_provider_ids)) : {
      login_method = {
        id = id
      }
    }
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# ブラウザを持たない CI や外部システム用の認証情報。secret は作成時にしか
# 取得できないため、Terraform state (Wasabi の private bucket) が唯一の保管先に
# なる。ローテーションは service_token_secret_version を増やして行う。
resource "cloudflare_zero_trust_access_service_token" "admin" {
  for_each = local.protected_applications

  account_id = var.cloudflare_account_id
  name       = "${each.value.name} service token"
  duration   = var.service_token_duration

  # 既定 (null) では version を Terraform が管理しない。値を設定して増やすと
  # secret が再発行され、旧 secret は previous_client_secret_expires_at まで
  # 有効なまま残る。
  client_secret_version = var.service_token_secret_version
}

# service token は identity を持たないため、login policy の include に足しても
# 一致しない。decision = "non_identity" の Service Auth policy が必要。
resource "cloudflare_zero_trust_access_policy" "admin_service_token" {
  for_each = local.protected_applications

  account_id = var.cloudflare_account_id
  name       = "${each.value.name} service token"
  decision   = "non_identity"

  include = [
    {
      service_token = {
        token_id = cloudflare_zero_trust_access_service_token.admin[each.key].id
      }
    }
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# 公開 API は、ホスト全体の login application より具体的な path で
# Access を bypass する。対象 path は必要最小限に保つ。
resource "cloudflare_zero_trust_access_policy" "public_bypass" {
  account_id = var.cloudflare_account_id
  name       = "events-api-2026 public endpoints"
  decision   = "bypass"

  include = [
    {
      everyone = {}
    }
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_zero_trust_access_application" "public" {
  for_each = local.public_applications

  account_id           = var.cloudflare_account_id
  name                 = each.value.name
  type                 = "self_hosted"
  domain               = each.value.domain
  session_duration     = var.session_duration
  app_launcher_visible = false
  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.public_bypass.id
      precedence = 1
    }
  ]

  destinations = [
    {
      type = "public"
      uri  = each.value.domain
    }
  ]
}

# state と AUD を維持するため、既存 /admin application の resource address
# は変えず、同じ application をホスト全体の login application へ拡張する。
resource "cloudflare_zero_trust_access_application" "admin" {
  for_each = local.protected_applications

  account_id       = var.cloudflare_account_id
  name             = each.value.name
  type             = "self_hosted"
  domain           = each.value.domain
  session_duration = var.session_duration

  # JWT をホスト全体へ scope し、/cdn-cgi/access/cli の handoff でも使う。
  path_cookie_attribute = false
  app_launcher_visible  = false
  allowed_idps          = sort(tolist(var.allowed_identity_provider_ids))

  # Service Auth policy に一致しなかった request は login へ redirect されるため、
  # ブラウザからのログインは precedence 1 の login policy でこれまでどおり動く。
  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.admin_login.id
      precedence = 1
    },
    {
      id         = cloudflare_zero_trust_access_policy.admin_service_token[each.key].id
      precedence = 2
    }
  ]

  destinations = [
    {
      type = "public"
      uri  = each.value.domain
    }
  ]

  # apply 中も公開 endpoint が一時的に login 必須にならないよう、child
  # application を先に作成する。
  depends_on = [cloudflare_zero_trust_access_application.public]

  lifecycle {
    prevent_destroy = true
  }
}
