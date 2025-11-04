document.addEventListener('DOMContentLoaded', async function(){
  // Check user role immediately
  try {
    const res = await fetch('/api/user/role');
    const data = await res.json();
    if (data.role) {
      document.body.setAttribute('data-role', data.role);
    }
  } catch (err) {
    console.warn('Failed to fetch user role', err);
  }

  const formEl = document.getElementById('form');
  const msgEl = document.getElementById('msg');

  formEl.addEventListener('submit', async e => {
    e.preventDefault();
    const nome = document.getElementById('nome').value.trim();
    const pn = document.getElementById('pn').value.trim();
    const sn = document.getElementById('sn').value.trim();
    const categoria = document.getElementById('categoria').value.trim();
    const setor = document.getElementById('setor').value.trim();
    const quantidade = Number(document.getElementById('quantidade').value || 0);
    const qtyMin = Number(document.getElementById('qty_min').value || 0);

    try {
      const peso_valor = Number(document.getElementById('peso_valor').value || 0) || null;
      const peso_tipo = document.getElementById('peso_tipo').value.trim() || null;

      const res = await fetch('/api/cadastrar', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ nome, pn, sn, categoria, setor, quantidade, peso_valor, peso_tipo, qtyMin })
      });

      let data = {};
      try { data = await res.json(); } catch (err) { /* non-json response */ }

      msgEl.textContent = data.mensagem || data.erro || (res.ok ? 'Operação concluída.' : 'Erro desconhecido');
    } catch (err) {
      msgEl.textContent = 'Falha na requisição: ' + err.message;
    }

    formEl.reset();

    if (window.opener && typeof window.opener.carregarHistorico === 'function') {
      window.opener.carregarHistorico();
    }
  });

  function goHome(){ if (history.length>1) history.back(); else window.location.href = '/dashboard'; }
  document.getElementById('btn-home').addEventListener('click', ()=> { if(history.length>1) history.back(); else window.location.href = '/'; });
  document.getElementById('btn-config').addEventListener('click', ()=> { alert('Abrir configurações (implementação pendente).'); });
});
