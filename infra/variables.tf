variable "cloudflare_account_id" {
  description = "Access applications を作成する Cloudflare Account ID"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be a 32-character lowercase hexadecimal ID."
  }
}

variable "enabled_environments" {
  description = "Access application を作成する環境"
  type        = set(string)
  default     = ["staging", "prod"]

  validation {
    condition = (
      length(var.enabled_environments) > 0 &&
      length(setsubtract(var.enabled_environments, ["staging", "prod"])) == 0
    )
    error_message = "enabled_environments must contain staging, prod, or both."
  }
}

variable "allowed_identity_provider_ids" {
  description = "保護対象へのログインとアクセスを許可する既存 Access Identity Provider の ID"
  type        = set(string)

  validation {
    condition = (
      length(var.allowed_identity_provider_ids) > 0 &&
      alltrue([
        for id in var.allowed_identity_provider_ids :
        can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", id))
      ])
    )
    error_message = "Specify at least one lowercase UUID for an Access Identity Provider."
  }
}

variable "session_duration" {
  description = "Access のログインセッション有効期間"
  type        = string
  default     = "24h"
}
