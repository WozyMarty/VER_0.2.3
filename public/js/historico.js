document.addEventListener('DOMContentLoaded', function() {
  if (typeof $ === 'undefined') {
    console.error('jQuery is required for historico.js');
    return;
  }

  async function carregar() {
    try {
      const res = await fetch('/api/historico');
      if (!res.ok) throw new Error('Falha ao carregar histórico');
      const dados = await res.json();
      const tbody = document.querySelector('#tabela tbody');
      tbody.innerHTML = '';

      dados.forEach(r => {
        const tr = document.createElement('tr');
        const pesoVal = (r.peso_valor == null) ? '' : Number(r.peso_valor).toFixed(2);
        tr.innerHTML = `<td>${r.tipo}</td>
                        <td>${r.id}</td>
                        <td>${r.nome}</td>
                        <td>${r.pn || ''}</td>
                        <td>${r.sn || ''}</td>
                        <td>${r.categoria || ''}</td>
                        <td>${r.setor || ''}</td>
                        <td>${pesoVal}</td>
                        <td>${r.peso_tipo || ''}</td>
                        <td>${r.quantidade}</td>
                        <td>${r.quantidade_minima || ''}</td>
                        <td>${r.data ? new Date(r.data).toLocaleString() : ''}</td>`;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  }

  function initDataTable() {
    if ($.fn.dataTable.isDataTable('#tabela')) {
      $('#tabela').DataTable().clear().destroy();
    }

    const dt = $('#tabela').DataTable();

    if (window.__colResize) {
      try {
        window.__colResize.watch('#tabela', dt);
        const btn = document.getElementById('resetCols');
        if (btn) btn.addEventListener('click', () => window.__colResize.reset('#tabela'));
      } catch (e) {
        console.warn('colResize init failed', e);
      }
    }
  }

  // expose for other windows
  window.carregarHistorico = carregar;

  function goHome(){ if (history.length>1) history.back(); else window.location.href = '/dashboard'; }
  const homeIcon = document.querySelector('.home-icon');
  if (homeIcon) homeIcon.addEventListener('click', goHome);

  (async function(){
    await carregar();
    initDataTable();
  })();
});
