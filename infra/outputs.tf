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

# client_id は secret ではないので、有効期限の確認だけならこちらを見る。
output "access_service_token_client_ids" {
  description = "環境ごとの Access service token の client id と有効期限"
  value = {
    for environment, token in cloudflare_zero_trust_access_service_token.admin :
    environment => {
      name       = token.name
      client_id  = token.client_id
      expires_at = token.expires_at
    }
  }
}

# secret は作成時にしか API から取得できないため、この output が実質の保管場所。
# ./tf.sh output -json access_service_tokens で確認する。
output "access_service_tokens" {
  description = "環境ごとの Access service token の credentials。CF-Access-Client-Id / CF-Access-Client-Secret ヘッダに設定する"
  sensitive   = true
  value = {
    for environment, token in cloudflare_zero_trust_access_service_token.admin :
    environment => {
      name          = token.name
      client_id     = token.client_id
      client_secret = token.client_secret
      expires_at    = token.expires_at
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
