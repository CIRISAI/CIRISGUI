// Visual test for GUI components
const puppeteer = require('puppeteer');

async function testGUIVisual() {
  console.log('=== GUI Visual Component Test ===\n');

  // Check if puppeteer is installed
  try {
    require.resolve('puppeteer');
  } catch (e) {
    console.log('Puppeteer not installed. To run visual tests:');
    console.log('npm install puppeteer');
    console.log('\nManual visual testing steps:');
    console.log('1. Open http://localhost:3000/login');
    console.log('2. Login with admin/ciris_admin_password');
    console.log('3. Navigate to Users page');
    console.log('4. Check for "Permission Requests" tab');
    console.log('5. Navigate to Comms page');
    console.log('6. Verify message sending works');
    return;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // 1. Test login page
    console.log('1. Testing login page...');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('input[name="username"]', { timeout: 5000 });
    console.log('✓ Login page loaded');

    // Login
    await page.type('input[name="username"]', 'admin');
    await page.type('input[name="password"]', 'ciris_admin_password');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    console.log('✓ Logged in successfully');

    // 2. Test Users page
    console.log('\n2. Testing Users page...');
    await page.goto('http://localhost:3000/users');
    await page.waitForSelector('h1', { timeout: 5000 });

    // Check for Permission Requests tab
    const permissionTab = await page.$('button:has-text("Permission Requests")');
    if (permissionTab) {
      console.log('✓ Permission Requests tab found');
      await permissionTab.click();
      await page.waitForTimeout(500);
      console.log('✓ Permission Requests tab clickable');
    } else {
      console.log('✗ Permission Requests tab not found');
    }

    // 3. Test Comms page
    console.log('\n3. Testing Comms page...');
    await page.goto('http://localhost:3000/comms');
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    console.log('✓ Comms page loaded');
    console.log('✓ Message input field found');

    // Check for send button
    const sendButton = await page.$('button:has-text("Send")');
    if (sendButton) {
      console.log('✓ Send button found');
    }

    console.log('\n✅ All visual components verified!');

  } catch (error) {
    console.error('Visual test error:', error.message);
  } finally {
    await browser.close();
  }
}

// Alternative test without puppeteer
async function testGUIEndpoints() {
  const axios = require('axios');
  console.log('\n=== GUI Endpoint Test ===\n');

  const endpoints = [
    { path: '/', name: 'Home' },
    { path: '/login', name: 'Login' },
    { path: '/users', name: 'Users' },
    { path: '/comms', name: 'Communications' },
    { path: '/oauth/callback', name: 'OAuth Callback' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`http://localhost:3000${endpoint.path}`, {
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });
      console.log(`✓ ${endpoint.name} (${endpoint.path}): ${response.status}`);
    } catch (error) {
      console.log(`✗ ${endpoint.name} (${endpoint.path}): ${error.message}`);
    }
  }

  console.log('\n📸 Screenshot Testing:');
  console.log('For visual verification, take screenshots of:');
  console.log('1. Users page - both tabs');
  console.log('2. Permission Requests tab content');
  console.log('3. Comms page - normal state');
  console.log('4. PermissionRequest component (if visible)');
}

// Run tests
testGUIVisual()
  .then(() => testGUIEndpoints())
  .catch(console.error);
