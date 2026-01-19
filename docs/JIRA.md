# Jira Integration (BDK)

This repo includes a small CLI helper to interact with Jira Cloud via REST API.

## Prereqs

1. Create an Atlassian API token:
   - https://id.atlassian.com/manage-profile/security/api-tokens

2. Set environment variables (examples):

```bash
export JIRA_BASE_URL='https://brendilka.atlassian.net'
export JIRA_EMAIL='you@yourcompany.com'
export JIRA_API_TOKEN='YOUR_TOKEN'
export JIRA_PROJECT_KEY='BDK'
```

## Commands

### Verify auth

```bash
npm run jira -- whoami
```

### List recent issues in BDK

```bash
npm run jira -- list --project BDK --max 50
```

### Fetch one issue

```bash
npm run jira -- get BDK-123
```

### Comment on an issue

```bash
npm run jira -- comment BDK-123 "Shipped in Vercel; updating NEXT_PUBLIC_APP_URL for custom domain."
```

### Transition an issue (e.g., Done)

```bash
npm run jira -- transitions BDK-123
npm run jira -- transition BDK-123 "Done"
```

### Create a new issue

```bash
npm run jira -- create --project BDK --type Task --summary "Connect app.brendilkasolutions.com" --description "Update DNS CNAME for app subdomain and set NEXT_PUBLIC_APP_URL in Vercel."
```

## Smart Commits (Git)

If your Git hosting is connected to Jira, include the issue key in commit messages. Examples:

- `BDK-123 #comment Configure app subdomain DNS`
- `BDK-123 #time 30m #comment Update Supabase redirect URLs`

Exact Smart Commit commands depend on your Jira/Git integration. The safe baseline is always: start the commit subject with `BDK-123`.
