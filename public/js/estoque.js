// estoque.js — externalized from estoque.html

async function carregar() {
  const res = await fetch('/api/estoque');
  const dados = await res.json();
  const tbody = document.querySelector('#tabela tbody');
  tbody.innerHTML = '';

  dados.forEach(p => {
    const tr = document.createElement('tr');
    const pesoVal = (p.peso_valor == null) ? '' : Number(p.peso_valor).toFixed(2);
    tr.innerHTML = `<td>${p.id}</td>
                    <td>${p.codigo || ''}</td>
                    <td>${p.nome}</td>
                    <td>${p.pn}</td>
                    <td>${p.sn}</td>
                    <td>${p.categoria || ''}</td>
                    <td>${p.setor || ''}</td>
                    <td>${p.quantidade ?? 0}</td>
                    <td>${p.quantidade_minima ?? ''}</td>
                    <td>${pesoVal}</td>
                    <td>${p.peso_tipo || ''}</td>`;
    tbody.appendChild(tr);
  });
}

function goHome() {
  window.location.href = "/dashboard";
}

// wire up home action and initialize DataTable when document ready
document.addEventListener('DOMContentLoaded', ()=>{
  // attach click for home-icon if present
  document.querySelectorAll('[data-action="home"]').forEach(el => el.addEventListener('click', goHome));
  
  // Attach home icon behavior (no inline onclick)
  function goHome() {
    if (history.length > 1) history.back(); else window.location.href = '/dashboard';
  }

  const homeIcon = document.querySelector('.home-icon');
  if (homeIcon) homeIcon.addEventListener('click', goHome);
});

// jQuery part: wait until jQuery is ready
(function waitForJQuery(){
  if (typeof window.jQuery === 'undefined') {
    setTimeout(waitForJQuery, 50);
    return;
  }

  $(document).ready( async function () {
    // Load data first, then initialize DataTable so it picks up rows reliably
    await carregar();

    // If DataTable was already initialized, destroy it first to avoid duplicate init
    if ( $.fn.dataTable.isDataTable('#tabela') ) {
      $('#tabela').DataTable().clear().destroy();
    }

    const dt = $('#tabela').DataTable({
      order: [[0, 'desc']] // Sort by first column (ID) in descending order
    });
    
    // initialize column resizer after DataTable init and watch for column changes
    if (window.__colResize) {
      window.__colResize.watch('#tabela', dt);
      const btn = document.getElementById('resetCols');
      if(btn) btn.addEventListener('click', ()=> window.__colResize.reset('#tabela'));
    }
  });
})();
