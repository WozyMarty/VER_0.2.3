// Use global fetch (Node 18+)
const BASE = 'http://localhost:6060';

async function run(){
  try{
    console.log('1) POST /api/login with user/user123');
    const loginResp = await fetch(BASE + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user', password: 'user123' })
    });

    console.log('Login status:', loginResp.status);
    const loginText = await loginResp.text();
    console.log('Login body:', loginText);

    const setCookie = loginResp.headers.get('set-cookie') || loginResp.headers.get('Set-Cookie');
    console.log('Set-Cookie header:', setCookie);

    let cookie = null;
    if (setCookie) {
      // Extract the cookie name=value (first part before ;)
      cookie = setCookie.split(';')[0];
      console.log('Using cookie:', cookie);
    } else {
      console.warn('No Set-Cookie header received from login. Session may not be established.');
    }

    console.log('\n2) GET /dashboard using cookie');
    const dashboardResp = await fetch(BASE + '/dashboard', {
      method: 'GET',
      headers: cookie ? { 'Cookie': cookie } : {}
    });

    console.log('Dashboard status:', dashboardResp.status);
    // if redirect, show location
    const location = dashboardResp.headers.get('location');
    if (location) console.log('Dashboard Location header:', location);

    const contentType = dashboardResp.headers.get('content-type') || '';
    console.log('Dashboard content-type:', contentType);

    const bodySnippet = await dashboardResp.text();
    console.log('Dashboard body length:', bodySnippet.length);
    console.log('Dashboard body snippet (first 300 chars):\n', bodySnippet.slice(0,300));

  }catch(err){
    console.error('Test error:', err);
    process.exit(1);
  }
}

run();
