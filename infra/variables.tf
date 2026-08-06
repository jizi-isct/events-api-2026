variable "cloudflare_account_id" {
  description = "Access applications を作成する Cloudflare Account ID"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be a 32-character lowercase hexadecimal ID."
  }
}

variable "enabled_environments" {
  description = "Access application を作成する環境。初回は staging のみ、検証後に prod を追加する"
  type        = set(string)
  default     = ["staging"]

  validation {
    condition = (
      length(var.enabled_environments) > 0 &&
      length(setsubtract(var.enabled_environments, ["staging", "prod"])) == 0
    )
    error_message = "enabled_environments must contain staging, prod, or both."
  }
}

variable "allowed_identity_provider_ids" {
  description = "管理 API への対話的ログインに使用できる既存 Access Identity Provider の ID"
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

variable "allowed_access_group_ids" {
  description = "管理 API を利用できる既存 Access Group の ID"
  type        = set(string)
  default     = []

  validation {
    condition = alltrue([
      for id in var.allowed_access_group_ids :
      can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", id))
    ])
    error_message = "Every allowed_access_group_ids entry must be a lowercase UUID."
  }
}

variable "allowed_emails" {
  description = "管理 API を利用できる個別メールアドレス。Access Group を使う場合は空集合"
  type        = set(string)
  default     = []

  validation {
    condition = alltrue([
      for email in var.allowed_emails :
      can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", email))
    ])
    error_message = "Every allowed_emails entry must be an email address."
  }
}

variable "service_token_ids" {
  description = "管理 API を呼び出せる既存 Access Service Token の ID。不要なら空集合"
  type        = set(string)
  default     = []

  validation {
    condition = alltrue([
      for id in var.service_token_ids :
      can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", id))
    ])
    error_message = "Every service_token_ids entry must be a lowercase UUID."
  }
}

variable "session_duration" {
  description = "Access のログインセッション有効期間"
  type        = string
  default     = "24h"
}
