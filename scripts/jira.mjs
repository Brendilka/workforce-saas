/**
 * Minimal Jira CLI for this repo.
 *
 * Uses Atlassian Jira Cloud REST API v3.
 * Auth: email + API token.
 *
 * Required env vars:
 *   JIRA_BASE_URL=https://brendilka.atlassian.net
 *   JIRA_EMAIL=you@example.com
 *   JIRA_API_TOKEN=... (create at https://id.atlassian.com/manage-profile/security/api-tokens)
 *
 * Optional:
 *   JIRA_PROJECT_KEY=BDK
 *
 * Commands:
 *   node scripts/jira.mjs whoami
 *   node scripts/jira.mjs list --project BDK --max 50
 *   node scripts/jira.mjs get BDK-123
 *   node scripts/jira.mjs comment BDK-123 "comment text"
 *   node scripts/jira.mjs transition BDK-123 "Done"
 *   node scripts/jira.mjs create --project BDK --summary "..." --description "..." --type Task
 */

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing env var: ${name}`);
  }
  return String(value).trim();
}

function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function basicAuthHeader(email, token) {
  const encoded = Buffer.from(`${email}:${token}`, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a) continue;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

let DEBUG = false;

async function jiraFetch(path, { method = 'GET', body } = {}) {
  const baseUrl = requiredEnv('JIRA_BASE_URL').replace(/\/$/, '');
  const email = requiredEnv('JIRA_EMAIL');
  const token = requiredEnv('JIRA_API_TOKEN');

  const url = `${baseUrl}${path}`;

  if (DEBUG) {
    console.log('[jira] request', {
      method,
      url,
      email,
      tokenLength: token.length,
      hasBody: Boolean(body),
    });
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: basicAuthHeader(email, token),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';

  let json = null;
  if (text && contentType.includes('application/json')) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const msg =
      json?.errorMessages?.join('; ') ||
      json?.message ||
      (text ? text.slice(0, 200) : res.statusText);
    const details = json?.errors ? JSON.stringify(json.errors) : '';
    throw new Error(
      `Jira API ${method} ${path} failed (${res.status}): ${msg}${details ? ` (${details})` : ''}`
    );
  }

  return json ?? (text ? { raw: text } : null);
}

async function cmdWhoAmI() {
  const me = await jiraFetch('/rest/api/3/myself');
  console.log({
    accountId: me.accountId,
    displayName: me.displayName,
    emailAddress: me.emailAddress,
    timeZone: me.timeZone,
  });
}

async function cmdList(args) {
  const project = args.project || optionalEnv('JIRA_PROJECT_KEY', 'BDK');
  const max = Number(args.max || 50);
  const jql = args.jql || `project = ${project} ORDER BY updated DESC`;

  // Jira Cloud is migrating from /search to /search/jql (some sites already removed /search).
  const search = await jiraFetch('/rest/api/3/search/jql', {
    method: 'POST',
    body: {
      jql,
      maxResults: Number.isFinite(max) ? Math.min(Math.max(max, 1), 100) : 50,
      fields: ['summary', 'status', 'issuetype', 'assignee', 'updated'],
    },
  });

  const issues = (search.issues || []).map((i) => ({
    key: i.key,
    type: i.fields?.issuetype?.name,
    status: i.fields?.status?.name,
    summary: i.fields?.summary,
    updated: i.fields?.updated,
    assignee: i.fields?.assignee?.displayName || null,
  }));

  console.log(issues);
}

async function cmdGet(key) {
  const issue = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,status,description,issuetype,assignee,updated`);
  console.log({
    key: issue.key,
    type: issue.fields?.issuetype?.name,
    status: issue.fields?.status?.name,
    summary: issue.fields?.summary,
    updated: issue.fields?.updated,
    assignee: issue.fields?.assignee?.displayName || null,
  });
}

async function cmdComment(key, text) {
  if (!text) throw new Error('Missing comment text');
  await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
    method: 'POST',
    body: {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text }],
          },
        ],
      },
    },
  });
  console.log('OK');
}

async function cmdTransitions(key) {
  const data = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
  const transitions = (data.transitions || []).map((t) => ({ id: t.id, name: t.name }));
  console.log(transitions);
}

async function cmdTransition(key, transitionName) {
  if (!transitionName) throw new Error('Missing transition name');
  const data = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
  const transitions = data.transitions || [];
  const match = transitions.find((t) => String(t.name).toLowerCase() === String(transitionName).toLowerCase());
  if (!match) {
    const available = transitions.map((t) => t.name).join(', ');
    throw new Error(`Transition "${transitionName}" not found. Available: ${available}`);
  }

  await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, {
    method: 'POST',
    body: { transition: { id: match.id } },
  });

  console.log('OK');
}

async function cmdCreate(args) {
  const projectKey = args.project || optionalEnv('JIRA_PROJECT_KEY', 'BDK');
  const summary = args.summary;
  const description = args.description || '';
  const issueTypeName = args.type || 'Task';

  if (!summary) throw new Error('Missing --summary');

  const meta = await jiraFetch(`/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes.fields`);
  const project = meta.projects?.[0];
  const issuetypes = project?.issuetypes || [];
  const issueType = issuetypes.find((t) => String(t.name).toLowerCase() === String(issueTypeName).toLowerCase());
  if (!issueType) {
    const available = issuetypes.map((t) => t.name).join(', ');
    throw new Error(`Issue type "${issueTypeName}" not found for ${projectKey}. Available: ${available}`);
  }

  const created = await jiraFetch('/rest/api/3/issue', {
    method: 'POST',
    body: {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { id: issueType.id },
        description: {
          type: 'doc',
          version: 1,
          content: description
            ? [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: description }],
                },
              ]
            : [],
        },
      },
    },
  });

  console.log({ key: created.key, id: created.id });
}

function usage() {
  console.log('Usage: node scripts/jira.mjs <command> [args]');
  console.log('Commands: whoami | list | get | comment | transitions | transition | create');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const [command, a, b] = parsed._;

  DEBUG = Boolean(parsed.debug) || process.env.JIRA_DEBUG === '1';

  if (!command) {
    usage();
    process.exitCode = 2;
    return;
  }

  switch (command) {
    case 'whoami':
      await cmdWhoAmI();
      return;
    case 'list':
      await cmdList(parsed);
      return;
    case 'get':
      if (!a) throw new Error('Missing issue key');
      await cmdGet(a);
      return;
    case 'comment':
      if (!a) throw new Error('Missing issue key');
      await cmdComment(a, b);
      return;
    case 'transitions':
      if (!a) throw new Error('Missing issue key');
      await cmdTransitions(a);
      return;
    case 'transition':
      if (!a) throw new Error('Missing issue key');
      await cmdTransition(a, b);
      return;
    case 'create':
      await cmdCreate(parsed);
      return;
    default:
      usage();
      process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
