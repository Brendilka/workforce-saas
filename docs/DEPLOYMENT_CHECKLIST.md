# Deployment Checklist for Cloud Supabase

## Critical Environment Variables

Before deploying to production (Vercel or other platforms), ensure these environment variables are set:

### Required for HR Import to Work

```bash
# Your production app URL - REQUIRED for background job processing
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Why this is needed:** The HR import system uses fire-and-forget HTTP calls to trigger background processing. Without this variable, the system falls back to unreliable header-based URL construction which often fails in serverless environments.

### Supabase Configuration

```bash
# Get these from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Name:** Variable name (e.g., `NEXT_PUBLIC_APP_URL`)
   - **Value:** Your value
   - **Environment:** Select where to apply:
     - ✅ Production (always)
     - ✅ Preview (recommended)
     - ⚠️ Development (optional - uses local values)
4. Click **Save**
5. **Redeploy** your application for changes to take effect

## Vercel Deployment Steps

### Initial Deployment

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy to production
vercel --prod
```

### Setting Environment Variables via CLI

```bash
# Add production environment variable
vercel env add NEXT_PUBLIC_APP_URL production

# When prompted, enter: https://your-app.vercel.app

# Add other required variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

### After Adding Environment Variables

```bash
# Trigger a new deployment to apply environment variables
vercel --prod

## Custom Domain (brendilkasolutions.com)

You have two common options:

1. **Make this app the primary site** at `https://brendilkasolutions.com` (and optionally `https://www.brendilkasolutions.com`).
2. **Host the app on a subdomain** like `https://app.brendilkasolutions.com` while keeping your existing marketing site on the root domain.

### Add the Domain in Vercel

1. Go to **Vercel Dashboard → Project → Settings → Domains**
2. Add one of:
    - `brendilkasolutions.com`
    - `www.brendilkasolutions.com`
    - `app.brendilkasolutions.com`
3. Vercel will show the required DNS records for your DNS provider.

### Typical DNS Records (most registrars)

If you’re pointing the **root (apex) domain** to Vercel:

- `A` record
   - **Name/Host:** `@`
   - **Value:** `76.76.21.21`

If you’re using **www**:

- `CNAME` record
   - **Name/Host:** `www`
   - **Value:** `cname.vercel-dns.com`

If you’re using an **app subdomain**:

- `CNAME` record
   - **Name/Host:** `app`
   - **Value:** `cname.vercel-dns.com`

Notes:
- Remove conflicting existing records (old `A`/`CNAME` for the same host).
- DNS changes can take a few minutes up to 24h (usually much faster).

### Update App URL Environment Variable

Set this in Vercel **for Production (and Preview if desired):**

```bash
NEXT_PUBLIC_APP_URL=https://brendilkasolutions.com
```

If you deploy on a subdomain, use that instead:

```bash
NEXT_PUBLIC_APP_URL=https://app.brendilkasolutions.com
```
```

## Post-Deployment Verification

### 1. Check Environment Variables Are Set

After deployment, verify in your application logs:

- ✅ You should see: `[HR Import] Job X: Process URL: https://your-app.vercel.app/... (source: NEXT_PUBLIC_APP_URL env var)`
- ❌ If you see: `WARNING: NEXT_PUBLIC_APP_URL not set` → Environment variable not configured correctly

### 2. Test HR Import

1. Login as admin user
2. Go to **Admin** → **HR Import**
3. Upload a small test CSV (2-3 employees)
4. Click **Import**
5. Watch the progress:
   - Status should change: `pending` → `processing` → `completed`
   - Progress bar should update in real-time
   - Should complete within seconds for small files

### 3. Check Logs

**In Vercel Dashboard:**
1. Go to **Deployments** → Latest deployment
2. Click **Functions** tab
3. Look for these functions:
   - `/api/admin/hr-import/start`
   - `/api/admin/hr-import/process`
4. Check for errors or warnings

**Expected log messages (success):**
```
[HR Import] Created job abc-123 for 5 rows
[HR Import] Job abc-123: Process URL: https://your-app.vercel.app/api/admin/hr-import/process (source: NEXT_PUBLIC_APP_URL env var)
[HR Import] Job abc-123: Background processing triggered successfully (250ms, status: 200)
[HR Import] Starting processing for job abc-123
[HR Import] Processing complete for job abc-123
```

**Error indicators:**
```
WARNING: NEXT_PUBLIC_APP_URL not set
Failed to trigger processing
Background processing trigger returned error
```

## Troubleshooting Deployment Issues

### Issue: Jobs Still Stuck in Pending

**Possible causes:**

1. **Environment variable not set correctly**
   - Solution: Double-check in Vercel Settings → Environment Variables
   - Ensure it's set for "Production" environment
   - Redeploy after setting

2. **Old deployment still running**
   - Solution: Force a new deployment with `vercel --prod --force`
   - Or trigger redeploy from Vercel dashboard

3. **Vercel function timeout**
   - Solution: Check function logs for timeout errors
   - Reduce CSV file size for testing
   - Consider upgrading Vercel plan for longer timeouts

4. **Supabase Realtime not enabled**
   - Solution: See "Supabase Configuration" below

### Issue: "Unauthorized" or Auth Errors

**Possible causes:**

1. **Incorrect Supabase keys**
   - Solution: Verify keys in Supabase Dashboard → Settings → API
   - Ensure you're using the correct project's keys
   - Re-add environment variables if needed

2. **Custom JWT hook not enabled**
   - Solution: See `DEPLOYMENT.md` for full setup instructions
   - Ensure migration `20250111000000_custom_jwt_hook.sql` is applied
   - Enable auth hook in Supabase dashboard

## Supabase Configuration

### Configure Auth Redirect URLs (Required for Login to Work)

In **Supabase Dashboard → Authentication → URL Configuration**:

1. Set **Site URL** to your production URL:
   - `https://brendilkasolutions.com` (or `https://app.brendilkasolutions.com`)
2. Add **Redirect URLs** entries for any domains you will use:
   - `https://brendilkasolutions.com/**`
   - `https://www.brendilkasolutions.com/**` (if you use `www`)
   - `https://app.brendilkasolutions.com/**` (if you use `app`)

If this is missing, you’ll typically see OAuth/email-link flows fail or redirect to the wrong host.

### Enable Realtime for Import Jobs

The HR import page uses Realtime subscriptions to show live progress updates.

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Database** → **Replication**
3. Find the `import_jobs` table in the list
4. Ensure it's checked/enabled for replication
5. Or run this SQL in the SQL Editor:

```sql
-- Add import_jobs to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE import_jobs;
```

### Verify Custom JWT Hook (Required for RLS)

The application requires custom JWT claims for Row Level Security.

**Check if enabled:**
```sql
-- Run in SQL Editor
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

If not enabled, follow the full setup in `DEPLOYMENT.md`.

## Manual Trigger for Stuck Jobs

If jobs are stuck in pending status after deployment:

### Option 1: Using API Endpoint (from browser console)

```javascript
// Run in browser console while logged in as admin
fetch('/api/admin/hr-import/trigger-process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobId: 'your-job-id-here' })
})
.then(r => r.json())
.then(console.log);
```

### Option 2: Using curl

```bash
# Get your session cookie from browser DevTools → Application → Cookies
# Copy the sb-access-token value

curl -X POST https://your-app.vercel.app/api/admin/hr-import/trigger-process \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN_HERE" \
  -d '{"jobId": "your-job-id-here"}'
```

### Find Job IDs

Query Supabase SQL Editor:

```sql
SELECT id, status, created_at, total_rows
FROM import_jobs
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;
```

## Monitoring

### Key Metrics to Monitor

1. **Import job success rate**
   ```sql
   SELECT
     status,
     COUNT(*) as count,
     ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
   FROM import_jobs
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY status;
   ```

2. **Average processing time**
   ```sql
   SELECT
     AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds,
     MAX(EXTRACT(EPOCH FROM (updated_at - created_at))) as max_seconds
   FROM import_jobs
   WHERE status = 'completed'
   AND created_at > NOW() - INTERVAL '7 days';
   ```

3. **Failed jobs**
   ```sql
   SELECT id, status, error_message, created_at
   FROM import_jobs
   WHERE status = 'failed'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

### Set Up Alerts

Consider setting up alerts for:
- Jobs stuck in pending for > 5 minutes
- High failure rate (> 10% in past hour)
- Processing time > 2 minutes for small files

## Rollback Plan

If deployment causes issues:

1. **Immediate rollback in Vercel:**
   - Go to **Deployments** tab
   - Find previous working deployment
   - Click **⋯** (three dots) → **Promote to Production**

2. **Fix environment variables:**
   - Keep production running on old deployment
   - Fix environment variables
   - Deploy to preview first to test
   - Promote to production once verified

## Next Steps After Successful Deployment

1. ✅ Test with small CSV files first (< 10 rows)
2. ✅ Test with medium files (< 100 rows)
3. ✅ Test with production-size files
4. ✅ Monitor logs for first 24 hours
5. ✅ Document any custom configuration in this file
6. ⚠️ Consider implementing more robust solution (see `docs/TROUBLESHOOTING.md`)

## Additional Resources

- Full deployment guide: `DEPLOYMENT.md`
- Troubleshooting guide: `docs/TROUBLESHOOTING.md`
- Vercel documentation: https://vercel.com/docs
- Supabase documentation: https://supabase.com/docs
