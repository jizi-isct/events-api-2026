output "access_team_domain" {
  description = "Wrangler の ACCESS_TEAM_DOMAIN に設定する値"
  value       = "https://${data.cloudflare_zero_trust_organization.current.auth_domain}"
}

output "access_application_audiences" {
  description = "環境ごとのルート保護用 Access application の Wrangler ACCESS_AUD"
  value = {
    for environment, application in cloudflare_zero_trust_access_application.admin :
    environment => application.aud
  }
}

output "wrangler_access_vars" {
  description = "wrangler.jsonc の各 env.vars に反映する Access 設定"
  value = {
    for environment, application in cloudflare_zero_trust_access_application.admin :
    environment => {
      ACCESS_TEAM_DOMAIN = "https://${data.cloudflare_zero_trust_organization.current.auth_domain}"
      ACCESS_AUD         = application.aud
    }
  }
}

output "wrangler_r2_buckets" {
  description = "wrangler.jsonc の環境ごとの r2_buckets 設定"
  value = {
    for environment, bucket in cloudflare_r2_bucket.icons :
    environment => [
      {
        binding     = "ICON_BUCKET"
        bucket_name = bucket.name
      }
    ]
  }
}
