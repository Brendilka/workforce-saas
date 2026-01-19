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

  # Print body then status code on last line
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

  # Jira Cloud REST API v3 expects description in ADF format.
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
            {
              type: "paragraph",
              content: [ { type: "text", text: $desc } ]
            }
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
  if [[ -z "$key" || "$key" == "null" ]]; then
    echo "Issue created but key missing; response:" 1>&2
    echo "$body" 1>&2
    return 1
  fi

  echo "$key"
}

# Ticket payloads
t1_summary="Create Roster Manager for workload planning and staffing patterns"
t1_desc="Implement full Roster Manager feature with workload grid, pattern creation, and API.\n\nScope:\n- DB schema: workload_patterns, workload_pattern_details, workload_requirements\n- RLS policies for tenant isolation\n- RPC: apply_workload_pattern for bulk date-range application\n- API routes: /api/roster/workload, /api/roster/patterns, /api/roster/patterns/[id]\n- Admin UI at /admin/roster-manager with grid, filters, save/publish, pattern modal\n- TS types extended in src/types/supabase.ts\n\nAcceptance:\n- View/edit workload by date and job/skill\n- Create/apply reusable patterns to ranges\n- Save drafts and publish\n- Tenant isolation respected"
t1_type="Story"
t1_prio="High"

t2_summary="Fix Roster Manager DB constraints and pattern creation errors"
t2_desc="Resolve constraint and FK issues blocking pattern creation.\n\nFixes:\n- Removed created_by insert (bad FK)\n- Normalize empty strings to null (job_title, skill_profile, location_id, end_date)\n- Avoid invalid date syntax\n- Client + API aligned on payload fields\n\nFiles: src/app/api/roster/patterns/route.ts, RosterManagerClient.tsx"
t2_type="Bug"
t2_prio="High"

t3_summary="Add Manage Patterns UI for apply/delete"
t3_desc="Enable viewing/applying/deleting saved patterns.\n\nScope:\n- Added Manage Patterns modal listing all active patterns (ignores location filter)\n- Show name, location, job/skill, recurrence, dates, status\n- Apply to Current Range action\n- Delete with confirm\n\nFiles: RosterManagerClient.tsx"
t3_type="Story"
t3_prio="Medium"

t4_summary="Update branding to BDK logo"
t4_desc="Replace text logo with BDK PNG in sidebar and login.\n\nScope:\n- Use /public/bdk-logo.png with Next/Image\n- Sidebar and login header updated\n- Dimensions ~316x57, responsive width\n\nFiles: sidebar.tsx, login/page.tsx, public/bdk-logo.png"
t4_type="Task"
t4_prio="Low"

echo "Creating issues..."

if ! k1=$(create_issue "$t1_summary" $'Implement full Roster Manager feature with workload grid, pattern creation, and API.\n\nScope:\n- DB schema: workload_patterns, workload_pattern_details, workload_requirements\n- RLS policies for tenant isolation\n- RPC: apply_workload_pattern for bulk date-range application\n- API routes: /api/roster/workload, /api/roster/patterns, /api/roster/patterns/[id]\n- Admin UI at /admin/roster-manager with grid, filters, save/publish, pattern modal\n- TS types extended in src/types/supabase.ts\n\nAcceptance:\n- View/edit workload by date and job/skill\n- Create/apply reusable patterns to ranges\n- Save drafts and publish\n- Tenant isolation respected' "$t1_type" "$t1_prio"); then exit 1; fi
if ! k2=$(create_issue "$t2_summary" $'Resolve constraint and FK issues blocking pattern creation.\n\nFixes:\n- Removed created_by insert (bad FK)\n- Normalize empty strings to null (job_title, skill_profile, location_id, end_date)\n- Avoid invalid date syntax\n- Client + API aligned on payload fields\n\nFiles: src/app/api/roster/patterns/route.ts, RosterManagerClient.tsx' "$t2_type" "$t2_prio"); then exit 1; fi
if ! k3=$(create_issue "$t3_summary" $'Enable viewing/applying/deleting saved patterns.\n\nScope:\n- Added Manage Patterns modal listing all active patterns (ignores location filter)\n- Show name, location, job/skill, recurrence, dates, status\n- Apply to Current Range action\n- Delete with confirm\n\nFiles: RosterManagerClient.tsx' "$t3_type" "$t3_prio"); then exit 1; fi
if ! k4=$(create_issue "$t4_summary" $'Replace text logo with BDK PNG in sidebar and login.\n\nScope:\n- Use /public/bdk-logo.png with Next/Image\n- Sidebar and login header updated\n- Dimensions ~316x57, responsive width\n\nFiles: sidebar.tsx, login/page.tsx, public/bdk-logo.png' "$t4_type" "$t4_prio"); then exit 1; fi

echo "Created: $k1 $k2 $k3 $k4"
echo "Links:"
echo "- ${JIRA_BASE}/browse/$k1"
echo "- ${JIRA_BASE}/browse/$k2"
echo "- ${JIRA_BASE}/browse/$k3"
echo "- ${JIRA_BASE}/browse/$k4"