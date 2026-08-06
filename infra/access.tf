locals {
  admin_application_catalog = {
    staging = {
      name   = "events-api-2026 staging admin"
      domain = "events26-staging.koudaisai.jp/admin"
    }
    prod = {
      name   = "events-api-2026 prod admin"
      domain = "events26.koudaisai.jp/admin"
    }
  }

  admin_applications = {
    for environment, application in local.admin_application_catalog :
    environment => application
    if contains(var.enabled_environments, environment)
  }
}

# Zero Trust organization 自体と Identity Provider は中央の infrastructure
# repository が所有する。この stack では読み取りだけ行う。
data "cloudflare_zero_trust_organization" "current" {
  account_id = var.cloudflare_account_id
}

resource "cloudflare_zero_trust_access_policy" "admin_login" {
  account_id       = var.cloudflare_account_id
  name             = "events-api-2026 admin login"
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

resource "cloudflare_zero_trust_access_application" "admin" {
  for_each = local.admin_applications

  account_id       = var.cloudflare_account_id
  name             = each.value.name
  type             = "self_hosted"
  domain           = each.value.domain
  session_duration = var.session_duration

  # /admin の cookie を公開 API の /v1 へ送らない。
  path_cookie_attribute = true
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

  lifecycle {
    prevent_destroy = true
  }
}
