#!/usr/bin/env node

/**
 * Script to enable custom_access_token hook via Supabase Management API
 *
 * Usage:
 *   node scripts/enable-hook-api.js
 *
 * Required environment variables:
 *   SUPABASE_ACCESS_TOKEN - Your personal access token from https://supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF  - Your project reference ID from project settings
 */

const https = require('https');

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!ACCESS_TOKEN || !PROJECT_REF) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_ACCESS_TOKEN - Get from https://supabase.com/dashboard/account/tokens');
  console.error('   SUPABASE_PROJECT_REF  - Get from project settings');
  console.error('');
  console.error('Usage:');
  console.error('   SUPABASE_ACCESS_TOKEN=xxx SUPABASE_PROJECT_REF=yyy node scripts/enable-hook-api.js');
  process.exit(1);
}

const hookConfig = {
  hook_name: 'custom_access_token',
  enabled: true,
  function_name: 'custom_access_token_hook',
  function_schema: 'public',
};

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/config/auth/hooks/custom_access_token`,
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
};

console.log('🔐 Enabling custom_access_token hook via Management API...');
console.log(`   Project: ${PROJECT_REF}`);
console.log(`   Function: public.custom_access_token_hook`);
console.log('');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Hook enabled successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Log out and log back in to get a new JWT with claims');
      console.log('2. Test HR import functionality');
      console.log('');
      console.log('Verify JWT contains tenant_id:');
      console.log('   const { data } = await supabase.auth.getSession()');
      console.log('   console.log(data.session.access_token)');
    } else {
      console.error('❌ Failed to enable hook:');
      console.error(`   Status: ${res.statusCode}`);
      console.error(`   Response: ${data}`);
      console.error('');
      console.error('You may need to enable it manually in the dashboard:');
      console.error(`   https://supabase.com/dashboard/project/${PROJECT_REF}/auth/hooks`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Network error:', error.message);
  process.exit(1);
});

req.write(JSON.stringify(hookConfig));
req.end();
