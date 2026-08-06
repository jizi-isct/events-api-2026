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

resource "cloudflare_zero_trust_access_policy" "admin_groups" {
  count = length(var.allowed_access_group_ids) > 0 ? 1 : 0

  account_id       = var.cloudflare_account_id
  name             = "events-api-2026 admin groups"
  decision         = "allow"
  session_duration = var.session_duration

  include = [
    for id in sort(tolist(var.allowed_access_group_ids)) : {
      group = {
        id = id
      }
    }
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_zero_trust_access_policy" "admin_emails" {
  count = length(var.allowed_emails) > 0 ? 1 : 0

  account_id       = var.cloudflare_account_id
  name             = "events-api-2026 admin emails"
  decision         = "allow"
  session_duration = var.session_duration

  include = [
    for email in sort(tolist(var.allowed_emails)) : {
      email = {
        email = email
      }
    }
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_zero_trust_access_policy" "admin_service_auth" {
  count = length(var.service_token_ids) > 0 ? 1 : 0

  account_id       = var.cloudflare_account_id
  name             = "events-api-2026 admin service auth"
  decision         = "non_identity"
  session_duration = var.session_duration

  include = [
    for id in sort(tolist(var.service_token_ids)) : {
      service_token = {
        token_id = id
      }
    }
  ]

  lifecycle {
    create_before_destroy = true
  }
}

locals {
  application_policies = concat(
    length(var.allowed_access_group_ids) > 0 ? [
      {
        id         = cloudflare_zero_trust_access_policy.admin_groups[0].id
        precedence = 1
      }
    ] : [],
    length(var.allowed_emails) > 0 ? [
      {
        id         = cloudflare_zero_trust_access_policy.admin_emails[0].id
        precedence = 2
      }
    ] : [],
    length(var.service_token_ids) > 0 ? [
      {
        id         = cloudflare_zero_trust_access_policy.admin_service_auth[0].id
        precedence = 3
      }
    ] : [],
  )
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
  policies              = local.application_policies

  destinations = [
    {
      type = "public"
      uri  = each.value.domain
    }
  ]

  lifecycle {
    prevent_destroy = true

    precondition {
      condition = (
        length(var.allowed_access_group_ids) > 0 ||
        length(var.allowed_emails) > 0
      )
      error_message = "Configure at least one allowed Access Group or individual email address."
    }
  }
}
