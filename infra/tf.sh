#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly BASH_EXECUTABLE="$BASH"
readonly SOPS_CONFIG_FILE="${REPOSITORY_ROOT}/.sops.yaml"
readonly BACKEND_ENV_FILE="${SCRIPT_DIR}/backend.wasabi.sops.env"
readonly INTERNAL_COMMAND="__sops_exec"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_backend_value() {
  local name="$1"
  local value="${!name:-}"

  [[ -n "$value" ]] || fail "${name} is missing from ${BACKEND_ENV_FILE}"
  case "$value" in
    CHANGEME*) fail "replace the ${name} placeholder with the real value using sops" ;;
  esac
}

validate_backend_environment() {
  local name

  for name in \
    TF_BACKEND_BUCKET \
    TF_BACKEND_REGION \
    TF_BACKEND_S3_ENDPOINT \
    AWS_ACCESS_KEY_ID \
    AWS_SECRET_ACCESS_KEY; do
    require_backend_value "$name"
  done

  [[ "$TF_BACKEND_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] ||
    fail "TF_BACKEND_BUCKET must be a valid Wasabi bucket name"
  [[ "$TF_BACKEND_BUCKET" != *..* ]] ||
    fail "TF_BACKEND_BUCKET must not contain adjacent periods"
  [[ "$TF_BACKEND_REGION" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]] ||
    fail "TF_BACKEND_REGION must be a region identifier"
  [[ "$TF_BACKEND_S3_ENDPOINT" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$ ]] ||
    fail "TF_BACKEND_S3_ENDPOINT must be an HTTPS origin without a path"
}

run_init() {
  local argument
  local backend_config
  local temp_root="${TMPDIR:-/tmp}"
  local terraform_status

  for argument in "$@"; do
    case "$argument" in
      -backend-config | -backend-config=*)
        fail "backend configuration is managed by ${BACKEND_ENV_FILE}"
        ;;
    esac
  done

  umask 077
  backend_config="$(mktemp "${temp_root%/}/events-api-2026-backend.tfbackend.XXXXXX")"
  chmod 600 "$backend_config"

  cleanup() {
    rm -f -- "$backend_config"
  }
  trap cleanup EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  {
    printf 'bucket = "%s"\n' "$TF_BACKEND_BUCKET"
    printf 'region = "%s"\n' "$TF_BACKEND_REGION"
    printf 'endpoints = {\n  s3 = "%s"\n}\n' "$TF_BACKEND_S3_ENDPOINT"
  } >"$backend_config"

  if terraform -chdir="$SCRIPT_DIR" init "$@" -input=false -backend-config="$backend_config"; then
    terraform_status=0
  else
    terraform_status=$?
  fi

  cleanup
  trap - EXIT HUP INT TERM
  return "$terraform_status"
}

run_terraform() {
  local argument

  require_command terraform
  [[ $# -gt 0 ]] || fail "usage: ./tf.sh <terraform subcommand> [arguments...]"

  for argument in "$@"; do
    case "$argument" in
      -chdir | -chdir=*)
        fail "the Terraform working directory is fixed to ${SCRIPT_DIR}"
        ;;
    esac
  done

  # The age identity is only needed by SOPS. Do not pass its location or value
  # any further down to Terraform or provider subprocesses.
  unset SOPS_AGE_KEY SOPS_AGE_KEY_FILE SOPS_AGE_KEY_CMD
  unset EVENTS_API_BASH_EXECUTABLE EVENTS_API_TERRAFORM_COMMAND

  # Static Wasabi keys must not be combined with a session token inherited
  # from an unrelated AWS SSO/STS session.
  unset AWS_SESSION_TOKEN AWS_SECURITY_TOKEN

  validate_backend_environment

  # Saved plans and any other local artifacts should be owner-readable only.
  umask 077

  # Wasabi may not accept the AWS SDK's newer checksum defaults.
  export AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED
  export AWS_RESPONSE_CHECKSUM_VALIDATION=WHEN_REQUIRED

  if [[ "$1" == "init" ]]; then
    shift
    run_init "$@"
    return
  fi

  exec terraform -chdir="$SCRIPT_DIR" "$@"
}

run_with_sops() {
  require_command sops
  [[ -f "$SOPS_CONFIG_FILE" ]] || fail "missing SOPS config: ${SOPS_CONFIG_FILE}"
  [[ -f "$BACKEND_ENV_FILE" ]] || fail "missing encrypted backend config: ${BACKEND_ENV_FILE}"
  [[ $# -gt 0 ]] || fail "usage: ./tf.sh <terraform subcommand> [arguments...]"

  # SOPS accepts the child command as one shell string. Bash's %q preserves the
  # exact Terraform argument vector without evaluating user-supplied arguments.
  printf -v EVENTS_API_TERRAFORM_COMMAND '%q ' \
    "${SCRIPT_DIR}/tf.sh" "$INTERNAL_COMMAND" "$@"
  EVENTS_API_BASH_EXECUTABLE="$BASH_EXECUTABLE"
  export EVENTS_API_BASH_EXECUTABLE EVENTS_API_TERRAFORM_COMMAND

  exec sops --config "$SOPS_CONFIG_FILE" exec-env --same-process \
    "$BACKEND_ENV_FILE" \
    'exec "$EVENTS_API_BASH_EXECUTABLE" -c "$EVENTS_API_TERRAFORM_COMMAND"'
}

main() {
  if [[ "${1:-}" == "$INTERNAL_COMMAND" ]]; then
    shift
    run_terraform "$@"
    return
  fi

  run_with_sops "$@"
}

main "$@"
