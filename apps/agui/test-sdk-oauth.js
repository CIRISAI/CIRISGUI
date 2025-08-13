// Test script for OAuth permission request SDK functionality
const { CIRISClient } = require('./lib/ciris-sdk');

async function testOAuthSDK() {
  // Initialize client
  const client = new CIRISClient({
    baseURL: 'https://agents.ciris.ai',
    debug: true
  });

  try {
    console.log('=== Testing OAuth Permission Request SDK ===\n');

    // 1. Login as admin
    console.log('1. Logging in as admin...');
    await client.auth.login('admin', 'ciris_admin_password');
    console.log('✓ Logged in successfully\n');

    // 2. Test getPermissionRequests
    console.log('2. Getting permission requests...');
    const requests = await client.users.getPermissionRequests();
    console.log(`✓ Found ${requests.length} permission requests`);
    if (requests.length > 0) {
      console.log('First request:', JSON.stringify(requests[0], null, 2));
    }
    console.log();

    // 3. Test user details with OAuth fields
    console.log('3. Getting current user details...');
    const currentUser = await client.auth.getCurrentUser();
    const userDetails = await client.users.get(currentUser.user_id);
    console.log('✓ User details retrieved');
    console.log('OAuth fields:', {
      oauth_name: userDetails.oauth_name || null,
      oauth_picture: userDetails.oauth_picture || null,
      permission_requested_at: userDetails.permission_requested_at || null,
      custom_permissions: userDetails.custom_permissions || []
    });
    console.log();

    // 4. Test requestPermissions (will fail for admin user)
    console.log('4. Testing requestPermissions (should fail for admin)...');
    try {
      await client.users.requestPermissions();
      console.log('✗ Unexpected success');
    } catch (error) {
      console.log('✓ Expected error:', error.message);
    }
    console.log();

    // 5. Test grantPermissions
    console.log('5. Testing grantPermissions...');
    if (requests.length > 0) {
      const firstRequest = requests[0];
      console.log(`Granting permissions to user: ${firstRequest.username}`);
      try {
        const updatedUser = await client.users.grantPermissions(firstRequest.user_id, {
          permissions: ['send_messages']
        });
        console.log('✓ Permissions granted successfully');
        console.log('Custom permissions:', updatedUser.custom_permissions);
      } catch (error) {
        console.log('✗ Error granting permissions:', error.message);
      }
    } else {
      console.log('⚠ No permission requests to test with');
    }

    console.log('\n=== SDK Tests Complete ===');
  } catch (error) {
    console.error('Test failed:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    // Logout
    client.auth.logout();
  }
}

// Run the tests
testOAuthSDK().catch(console.error);
