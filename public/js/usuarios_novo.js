document.addEventListener('DOMContentLoaded', function(){
  const form = document.getElementById('form-user');
  const msg = document.getElementById('msg');
  const btnCancel = document.getElementById('btn-cancel');

  btnCancel.addEventListener('click', ()=>{
    history.length>1 ? history.back() : window.location.href = '/dashboard';
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent = '';
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value || 'user';

    if (!username || !password) {
      msg.textContent = 'Preencha usuário e senha.';
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username, email, password, role })
      });
      const data = await res.json();
      if (!res.ok) {
        msg.textContent = data.error || data.erro || 'Falha ao criar usuário';
        return;
      }
      msg.textContent = 'Usuário criado com sucesso.';
      setTimeout(()=> window.location.href = '/dashboard', 900);
    } catch (err) {
      console.error(err);
      msg.textContent = 'Erro na requisição.';
    }
  });
});
