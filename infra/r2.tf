locals {
  icon_bucket_catalog = {
    staging = "events-api-2026-icons-staging"
    prod    = "events-api-2026-icons-prod"
  }
}

/** 企画アイコンの原本を環境ごとに分離して保存する。 */
resource "cloudflare_r2_bucket" "icons" {
  for_each = local.icon_bucket_catalog

  account_id    = var.cloudflare_account_id
  name          = each.value
  location      = "apac"
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}
