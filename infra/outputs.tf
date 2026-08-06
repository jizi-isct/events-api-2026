output "access_team_domain" {
  description = "Wrangler の ACCESS_TEAM_DOMAIN に設定する値"
  value       = "https://${data.cloudflare_zero_trust_organization.current.auth_domain}"
}

output "access_application_audiences" {
  description = "環境ごとの Wrangler ACCESS_AUD"
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
