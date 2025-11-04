// common.js - shared helpers (logout and role management)
(function(){
  // Check user role and set it as data attribute on body
  async function checkUserRole() {
    try {
      const res = await fetch('/api/user/role');
      const data = await res.json();
      if (data.role) {
        document.body.setAttribute('data-role', data.role);
      }
    } catch (err) {
      console.warn('Failed to fetch user role', err);
    }
  }

  // Check role when page loads
  document.addEventListener('DOMContentLoaded', checkUserRole);
  async function logout() {
    try {
      const res = await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type':'application/json' } });
      try { await res.json(); } catch(e){}
    } catch (err) {
      console.warn('Logout request failed', err);
    }
    // Clear client cookies to be safe
    document.cookie = 'connect.sid=; Max-Age=0; path=/';
    document.cookie = 'remember_token=; Max-Age=0; path=/';
    window.location.href = '/';
  }

  // Attach to any logout button
  document.addEventListener('click', (e)=>{
    const el = e.target.closest && e.target.closest('[data-action="logout"]');
    if (!el) return;
    e.preventDefault();
    logout();
  });
})();
