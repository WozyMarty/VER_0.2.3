document.addEventListener('DOMContentLoaded', function(){
  const form = document.getElementById('form-saida');
  const destino = document.getElementById('destino');
  const refContainer = document.getElementById('ref-container');
  const btnCancel = document.getElementById('btn-cancel');
  const btnHome = document.getElementById('btn-home');
  const btnConfig = document.getElementById('btn-config');
  const codigoItemInput = document.getElementById('codigo_item');
  const idProdutoInput = document.getElementById('id_produto');

  const datalist = document.getElementById('sugestoes_items');
  let timeoutId = null;
  let lastSearch = '';

  async function buscarProdutos(termo) {
    try {
      const response = await fetch(`/api/produtos/busca?q=${encodeURIComponent(termo)}`);
      if (!response.ok) throw new Error('Erro ao buscar produtos');
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      return [];
    }
  }

  async function atualizarSugestoes(termo) {
    if (termo === lastSearch) return;
    lastSearch = termo;
    
    const produtos = await buscarProdutos(termo);
    datalist.innerHTML = '';
    
    produtos.forEach(produto => {
      const option = document.createElement('option');
      option.value = produto.nome;
      option.dataset.id = produto.id;
      option.label = `[ID: ${produto.id}] ${produto.nome} (P/N: ${produto.pn || 'N/A'})`;
      datalist.appendChild(option);
    });
  }

  codigoItemInput.addEventListener('input', () => {
    const termo = codigoItemInput.value.trim();
    if (termo.length < 2) return;
    
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => atualizarSugestoes(termo), 300);
  });

  codigoItemInput.addEventListener('change', async () => {
    const termo = codigoItemInput.value.trim();
    if (termo) {
      const selectedOption = Array.from(datalist.options).find(
        option => option.value === termo || option.label.includes(termo)
      );
      
      if (selectedOption) {
        idProdutoInput.value = selectedOption.dataset.id;
      } else {
        alert('Por favor, selecione um item da lista de sugestões.');
        codigoItemInput.value = '';
        idProdutoInput.value = '';
      }
    }
  });

  destino.addEventListener('change', () => {
    const v = destino.value;
    if (v === 'ordem_servico' || v === 'projeto') {
      refContainer.style.display = '';
    } else {
      refContainer.style.display = 'none';
      const refEl = document.getElementById('referencia');
      if (refEl) refEl.value = '';
    }
  });

  btnCancel.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else window.location.href = '/';
  });

  btnHome.addEventListener('click', ()=> {
    if (history.length > 1) history.back(); else window.location.href = '/';
  });
  btnConfig.addEventListener('click', ()=> {
    alert('Abrir configurações (implementação pendente).');
  });

  const btnSave = document.getElementById('btn-save');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      codigo_item: form.codigo_item.value.trim(),
      quant_retirar: parseInt(form.quant_retirar.value, 10) || 0,
      destino: form.destino.value,
      referencia: form.referencia ? form.referencia.value.trim() : '',
      observacoes: form.observacoes.value.trim()
    };

    if (!data.codigo_item || !form.id_produto.value || data.quant_retirar < 1 || !data.destino) {
      alert('Preencha os campos obrigatórios corretamente e certifique-se que o código do item é válido.');
      return;
    }
    if ((data.destino === 'ordem_servico' || data.destino === 'projeto') && !data.referencia) {
      alert('Informe a referência para Ordem de Serviço ou Projeto.');
      return;
    }

    const payload = {
      id_produto: form.id_produto.value,
      nome: data.codigo_item,
      quantidade: data.quant_retirar,
      destino: data.destino,
      referencia: data.referencia,
      observacoes: data.observacoes
    };

    try {
      btnSave.disabled = true;
      const res = await fetch('/api/baixa', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });

      let json = {};
      try { json = await res.json(); } catch (err) { /* non-json response */ }

      if (!res.ok) {
        alert(json.erro || json.mensagem || ('Erro ao registrar baixa: ' + res.status));
        return;
      }

      const toast = document.createElement('div');
      toast.textContent = json.mensagem || 'Saída registrada com sucesso';
      Object.assign(toast.style, {
        position:'fixed', right:'18px', bottom:'18px', padding:'10px 14px',
        background:'linear-gradient(90deg,var(--brand-turquoise),var(--brand-navy))',
        color:'#fff', borderRadius:'10px', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', zIndex:9999, fontFamily:'inherit'
      });
      document.body.appendChild(toast);
      setTimeout(()=> toast.style.opacity='0',1400);
      setTimeout(()=> toast.remove(),1800);

      setTimeout(()=> { if (history.length>1) history.back(); else window.location.href = '/'; }, 900);

    } catch (err) {
      alert('Falha na requisição: ' + err.message);
    } finally {
      btnSave.disabled = false;
    }
  });
});
