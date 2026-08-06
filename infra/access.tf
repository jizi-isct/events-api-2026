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
  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.admin_login.id
      precedence = 1
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
