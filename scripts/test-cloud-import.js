/**
 * Run this in browser console to test the HR import end-to-end
 *
 * This will:
 * 1. Check JWT claims
 * 2. Check environment variables
 * 3. Test a small import
 * 4. Monitor the job status
 */

async function testCloudImport() {
  console.log('🧪 Starting Cloud Import Test\n');

  // Step 1: Check JWT
  console.log('Step 1: Checking JWT claims...');
  try {
    const session = (await supabase.auth.getSession()).data.session;
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));

    if (!payload.user_metadata?.tenant_id) {
      console.error('❌ FAIL: tenant_id missing from JWT');
      console.error('   Fix: Enable custom access token hook in Supabase Dashboard');
      console.error('   Then log out and log back in');
      return;
    }

    console.log('✅ PASS: JWT has tenant_id:', payload.user_metadata.tenant_id);
    console.log('✅ PASS: JWT has role:', payload.user_metadata.role);
  } catch (error) {
    console.error('❌ FAIL: Could not check JWT:', error);
    return;
  }

  // Step 2: Check env vars (optional, endpoint might not exist yet)
  console.log('\nStep 2: Checking environment variables...');
  try {
    const env = await fetch('/api/admin/debug-env').then(r => r.json());
    console.log('📋 NEXT_PUBLIC_APP_URL:', env.NEXT_PUBLIC_APP_URL);
    console.log('📋 Process endpoint will be:', env.processEndpoint);
  } catch (error) {
    console.log('ℹ️  Debug endpoint not available (that\'s ok)');
  }

  // Step 3: Test small import
  console.log('\nStep 3: Testing import with sample data...');

  const testData = [
    {
      Email: 'test.user@example.com',
      FirstName: 'Test',
      LastName: 'User',
      EmployeeNumber: 'TEST-001',
      HireDate: '2024-01-15',
      Department: 'Engineering',
      Status: 'Active'
    }
  ];

  const config = {
    systemName: 'TestImport',
    fieldMapping: {
      Email: 'email',
      FirstName: 'first_name',
      LastName: 'last_name',
      EmployeeNumber: 'employee_number',
      HireDate: 'hire_date'
    },
    sourceFields: ['Email', 'FirstName', 'LastName', 'EmployeeNumber', 'HireDate', 'Department', 'Status'],
    requiredFields: ['email', 'first_name', 'last_name', 'employee_number']
  };

  try {
    const startResponse = await fetch('/api/admin/hr-import/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: testData,
        config: config,
        departments: []
      })
    });

    if (!startResponse.ok) {
      const error = await startResponse.json();
      console.error('❌ FAIL: Could not start import:', error);
      return;
    }

    const { jobId } = await startResponse.json();
    console.log('✅ PASS: Import job created:', jobId);

    // Step 4: Monitor job status
    console.log('\nStep 4: Monitoring job status (will check for 30 seconds)...');

    let attempts = 0;
    const maxAttempts = 15; // 30 seconds (2 sec intervals)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await fetch(`/api/admin/hr-import/status/${jobId}`);

      if (!statusResponse.ok) {
        console.error('❌ FAIL: Could not fetch job status');
        console.error('   This might mean RLS is blocking the query');
        console.error('   Response:', await statusResponse.text());
        return;
      }

      const job = await statusResponse.json();
      attempts++;

      console.log(`   [${attempts}/${maxAttempts}] Status: ${job.status} (${job.processed_rows || 0}/${job.total_rows} rows)`);

      if (job.status === 'completed') {
        console.log('\n✅✅✅ SUCCESS! Import completed ✅✅✅');
        console.log('   Success:', job.success_count);
        console.log('   Failed:', job.failed_count);
        console.log('   Auth Created:', job.auth_created_count);
        console.log('   Duration:', job.result?.duration ? `${(job.result.duration / 1000).toFixed(1)}s` : 'N/A');
        return;
      }

      if (job.status === 'failed') {
        console.error('\n❌ FAIL: Import failed');
        console.error('   Errors:', job.errors);
        return;
      }

      if (job.status === 'pending' && attempts > 5) {
        console.warn('\n⚠️  WARNING: Job stuck at pending for 10+ seconds');
        console.warn('   This means background processing is not working');
        console.warn('   Check Vercel logs for errors');
        console.warn('   Continuing to monitor...');
      }
    }

    console.error('\n❌ TIMEOUT: Job did not complete within 30 seconds');
    console.error('   Check Vercel logs for details');

  } catch (error) {
    console.error('\n❌ FAIL: Unexpected error:', error);
  }
}

console.log('Test function loaded. Run: testCloudImport()');
