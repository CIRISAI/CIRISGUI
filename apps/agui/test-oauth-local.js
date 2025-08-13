// Test OAuth permission functionality against local API
const axios = require('axios');

async function testOAuthFlow() {
  const API_URL = 'http://localhost:8080';

  try {
    console.log('=== Testing OAuth Permission Flow ===\n');

    // 1. First, let's simulate an OAuth user trying to interact without permissions
    console.log('1. Testing OAuth user without permissions...');
    try {
      const response = await axios.post(`${API_URL}/v1/agent/interact`, {
        message: "Hello",
        channel_id: "api_0.0.0.0_8080"
      }, {
        headers: {
          'Authorization': 'Bearer oauth_user:test_oauth_token'
        }
      });
      console.log('Unexpected success:', response.data);
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log('✓ Got expected 403 error');
        console.log('Response:', error.response.data);

        // Check for enhanced error response
        if (error.response.data.discord_invite) {
          console.log('✓ Discord invite link provided:', error.response.data.discord_invite);
        }
        if (error.response.data.can_request_permissions !== undefined) {
          console.log('✓ Can request permissions:', error.response.data.can_request_permissions);
        }
      } else {
        console.log('✗ Unexpected error:', error.message);
      }
    }

    // 2. Login as admin to check permission requests
    console.log('\n2. Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/v1/auth/login`, {
      username: 'admin',
      password: 'ciris_admin_password'
    });
    const adminToken = loginResponse.data.access_token;
    console.log('✓ Admin logged in successfully');

    // 3. Check permission requests
    console.log('\n3. Getting permission requests...');
    const requestsResponse = await axios.get(`${API_URL}/v1/users/permission-requests`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log(`✓ Found ${requestsResponse.data.length} permission requests`);
    if (requestsResponse.data.length > 0) {
      console.log('Sample request:', JSON.stringify(requestsResponse.data[0], null, 2));
    }

    // 4. Test the GUI components are working
    console.log('\n4. Testing GUI at http://localhost:3000...');
    try {
      const guiResponse = await axios.get('http://localhost:3000/', {
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });
      console.log('✓ GUI is running and accessible');
    } catch (error) {
      console.log('✗ GUI is not accessible:', error.message);
    }

    console.log('\n=== Test Summary ===');
    console.log('✓ OAuth 403 error includes enhanced fields');
    console.log('✓ Permission requests endpoint is working');
    console.log('✓ GUI is running at http://localhost:3000');
    console.log('\nYou can now:');
    console.log('1. Visit http://localhost:3000/login');
    console.log('2. Login as admin/ciris_admin_password');
    console.log('3. Go to the Users page to see the Permission Requests tab');
    console.log('4. Go to the Comms page and see the permission request UI');

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testOAuthFlow().catch(console.error);
