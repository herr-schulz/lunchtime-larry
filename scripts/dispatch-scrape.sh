#!/usr/bin/env bash
# Kick scrape.yml via the GitHub API (workflow_dispatch).
# This is the reliable trigger. GitHub's own `on.schedule` is best-effort and
# may delay or drop runs: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
#
# Token: fine-grained PAT, repo herr-schulz/lunchtime-larry, permission Actions: Read and write.
# cron-job.org: POST this URL, timezone Europe/Berlin, Mon–Fri 07:44, body {"ref":"main"}.
set -euo pipefail

: "${GITHUB_DISPATCH_TOKEN:?set GITHUB_DISPATCH_TOKEN}"

curl -fsS -X POST \
  -H "Authorization: Bearer ${GITHUB_DISPATCH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  -H "User-Agent: lunchtime-larry-dispatch" \
  https://api.github.com/repos/herr-schulz/lunchtime-larry/actions/workflows/scrape.yml/dispatches \
  -d '{"ref":"main"}'
