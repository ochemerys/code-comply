// Quick test to verify the nearby permits endpoint with string query params
const testNearbyPermits = async () => {
  const apiUrl = 'http://localhost:4000';
  
  // First, login to get a token
  console.log('Logging in...');
  const loginRes = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'inspector1@example.com',
      password: 'password123'
    })
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.status);
    return;
  }
  
  const { accessToken } = await loginRes.json();
  console.log('Login successful, got token');
  
  // Test nearby permits with string query params (as they come from URLSearchParams)
  console.log('\nTesting nearby permits endpoint...');
  const nearbyRes = await fetch(
    `${apiUrl}/api/permits/nearby?latitude=51.0447&longitude=-114.0719&radius=5000&limit=10`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log('Response status:', nearbyRes.status);
  
  if (nearbyRes.ok) {
    const permits = await nearbyRes.json();
    console.log('✅ Success! Found', permits.length, 'permits');
    console.log('First permit:', permits[0]);
  } else {
    const error = await nearbyRes.json();
    console.error('❌ Error:', error);
  }
};

testNearbyPermits().catch(console.error);
