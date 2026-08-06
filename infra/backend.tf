terraform {
  # bucket / region / endpoint は、SOPS で暗号化した設定を tf.sh が
  # 一時的な partial backend configuration に変換して与える。
  # credentials は backend configuration に書かず、SOPS から
  # AWS_ACCESS_KEY_ID と AWS_SECRET_ACCESS_KEY として渡す。
  backend "s3" {
    key = "events-api-2026/access/terraform.tfstate"

    use_path_style = true
    use_lockfile   = true
    encrypt        = true

    # AWS の account discovery / credential validation / IMDS へ不要な
    # 問い合わせを行わず、Wasabi の S3 endpoint だけを利用する。
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
