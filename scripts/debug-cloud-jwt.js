// Paste this in your browser console while logged in to check JWT claims
(async function debugJWT() {
  console.log('=== JWT CLAIMS DEBUGGER ===\n');

  // Get session
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    console.error('❌ No session found:', error);
    return;
  }

  console.log('✅ Session found');
  console.log('User ID:', session.user.id);
  console.log('Email:', session.user.email);
  console.log('\n--- User Metadata (should have tenant_id & role) ---');
  console.log(session.user.user_metadata);

  // Decode JWT
  const token = session.access_token;
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(atob(base64));

  console.log('\n--- JWT Payload ---');
  console.log('Full payload:', payload);
  console.log('\n--- Critical Check: user_metadata in JWT ---');

  if (payload.user_metadata) {
    console.log('✅ user_metadata EXISTS in JWT');
    console.log('   tenant_id:', payload.user_metadata.tenant_id);
    console.log('   role:', payload.user_metadata.role);

    if (payload.user_metadata.tenant_id) {
      console.log('\n✅✅✅ JWT IS CORRECTLY CONFIGURED! ✅✅✅');
      console.log('The JWT hook is working. The issue is elsewhere.');
    } else {
      console.log('\n❌❌❌ tenant_id IS MISSING! ❌❌❌');
      console.log('The JWT hook is NOT working correctly.');
    }
  } else {
    console.log('❌❌❌ user_metadata DOES NOT EXIST IN JWT! ❌❌❌');
    console.log('\nThis means the custom access token hook is NOT enabled.');
    console.log('\nFix: Go to Supabase Dashboard → Auth → Hooks');
    console.log('     Enable "Custom Access Token" hook');
    console.log('     Select: public.custom_access_token_hook');
    console.log('\nThen LOG OUT and LOG BACK IN to get a new JWT.');
  }

  console.log('\n=== END DEBUG ===');
})();
