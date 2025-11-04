// dashboard.js — externalized dashboard behavior (replaces inline scripts)
(function(){
  const routeMap = {
    estoque: '/estoque',
    cadastrar: '/cadastrar',
    baixa: '/baixa',
    historico: '/historico'
  };

  function goHome(){
    window.location.href = '/';
  }

  function menuAction(pagina){
    window.location.href = pagina;
  }

  function toast(text){
    const t = document.createElement('div');
    t.textContent = text;
    Object.assign(t.style,{
      position:'fixed',right:'18px',bottom:'18px',padding:'10px 14px',
      background:'linear-gradient(90deg,var(--brand-turquoise),var(--brand-navy))',
      color:'#fff',borderRadius:'10px',boxShadow:'0 8px 30px rgba(0,0,0,0.12)',zIndex:9999,fontFamily:'inherit'
    });
    document.body.appendChild(t);
    setTimeout(()=> t.style.opacity='0',1400);
    setTimeout(()=> t.remove(),1800);
  }

  // Attach listeners to action buttons using data-action attribute
  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('[data-action]').forEach(btn=>{
      const action = btn.getAttribute('data-action');
      // If the element already has a click listener via other JS, leave it — we attach anyway
      btn.addEventListener('click', (e)=>{
        // handle navigation actions
        if (routeMap[action]) {
          toast('Abrindo ' + action);
          btn.animate([{transform:'translateY(-6px)'},{transform:'translateY(0)'}],{duration:180});
          menuAction(routeMap[action]);
          return;
        }

        // other named actions
        if (action === 'logout') {
          // logout handled by common.js via data-action selector; do nothing here
          return;
        }
      });
    });

    // icon buttons: show title as toast
    document.querySelectorAll('.icon-btn').forEach(btn=>{
      // avoid double-handling of logout icon (which also has data-action=logout)
      if (btn.getAttribute('data-action') === 'logout') return;
      btn.addEventListener('click', ()=> toast(btn.getAttribute('title') || 'Ação'));
    });

    // wire any explicit home buttons (keeps compatibility)
    document.querySelectorAll('#btn-home').forEach(b => b.addEventListener('click', ()=> goHome()));
  });
})();
