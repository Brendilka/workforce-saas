#!/usr/bin/env bash
set -euo pipefail

JIRA_BASE="${JIRA_BASE:-https://brendilka.atlassian.net}"
JIRA_PROJECT="${JIRA_PROJECT:-BDK}"
JIRA_EMAIL="${JIRA_EMAIL:?export JIRA_EMAIL='you@company.com'}"
JIRA_API_TOKEN="${JIRA_API_TOKEN:?export JIRA_API_TOKEN='your_jira_api_token'}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" 1>&2
    exit 1
  }
}

require_cmd jq
require_cmd curl

jira_post() {
  local path="$1"
  local payload="$2"

  curl -sS -X POST "${JIRA_BASE}${path}" \
    -H 'Content-Type: application/json' \
    -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
    --data-binary "$payload" \
    -w "\n%{http_code}"
}

create_issue() {
  local summary="$1"
  local description_text="$2"
  local issue_type_name="$3"
  local priority_name="$4"

  local payload response http_code body key

  payload=$(jq -cn \
    --arg project "$JIRA_PROJECT" \
    --arg summary "$summary" \
    --arg type "$issue_type_name" \
    --arg priority "$priority_name" \
    --arg desc "$description_text" \
    '{
      fields: {
        project: { key: $project },
        summary: $summary,
        description: {
          type: "doc",
          version: 1,
          content: [
            { type: "paragraph", content: [ { type: "text", text: $desc } ] }
          ]
        },
        issuetype: { name: $type },
        priority: { name: $priority }
      }
    }')

  response=$(jira_post "/rest/api/3/issue" "$payload")
  http_code=$(printf "%s" "$response" | tail -n 1)
  body=$(printf "%s" "$response" | sed '$d')

  if [[ "$http_code" != "201" ]]; then
    echo "Failed to create issue ($http_code)" 1>&2
    echo "$body" 1>&2
    return 1
  fi

  key=$(printf "%s" "$body" | jq -r '.key')
  [[ -n "$key" && "$key" != "null" ]] || {
    echo "Issue created but key missing; response:" 1>&2
    echo "$body" 1>&2
    return 1
  }

  echo "$key"
}

main() {
  local summary="Business Structure: admin editor for org units/relationships"
  local desc
  desc=$'Add Business Structure feature for admins to create and manage hierarchical org structures.\n\nScope:\n- Admin page: /admin/business-structure\n- Create business structures (name/description), set active structure\n- Visual editor for business units (nodes) with drag positioning and multi-level hierarchy\n- Manage parent/child relationships between units\n- Persist structures, units, relationships in Supabase\n- Cost center association for units (lookup/create)\n\nKey files:\n- src/app/admin/business-structure/page.tsx\n- src/app/admin/business-structure/business-structure-client.tsx\n- src/components/business-structure/business-structure-editor.tsx\n- src/types/supabase.ts (business_* tables and cost_centers types)\n\nAcceptance:\n- Admin can create a structure and open editor\n- Changes save and reload consistently\n- Units/relationships persist per tenant and structure\n- Cost center mapping is preserved on reload'

  echo "Creating Business Structure ticket..."
  local key
  key=$(create_issue "$summary" "$desc" "Story" "Medium")

  echo "Created: $key"
  echo "Link: ${JIRA_BASE}/browse/$key"
}

main "$@"
