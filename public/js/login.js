// login.js - moved from inline <script> in login.html
// Check session by asking server; don't rely on presence of cookie alone
(async function checkSession(){
  try {
    const res = await fetch('/api/session');
    if (res.ok) {
      const json = await res.json();
      if (json.authenticated) {
        window.location.href = '/dashboard';
      }
    }
  } catch (e) {
    // ignore network errors — stay on login
    console.warn('session check failed', e);
  }
})();

(function(){
  const form = document.getElementById('login-form');
  const btnCancel = document.getElementById('btn-cancel');
  const forgot = document.getElementById('forgot-link');
  const togglePassword = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('senha');

  // Setup password visibility toggle
  togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Update the icon to reflect the current state
    togglePassword.innerHTML = type === 'password' 
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    
    // Update the aria-label for accessibility
    togglePassword.setAttribute('aria-label', 
      type === 'password' ? 'Mostrar senha' : 'Ocultar senha'
    );
  });

  btnCancel.addEventListener('click', ()=> {
    form.usuario.value = '';
    form.senha.value = '';
    if(history.length>1) history.back(); else location.href = 'index.html';
  });

  forgot.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Recuperação de senha não implementada neste exemplo.');
  });

  let twoFactorVerificationMode = false;

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position:'fixed', right:'18px', bottom:'18px', padding:'10px 14px',
      background: type === 'success' 
        ? 'linear-gradient(90deg,var(--brand-turquoise),var(--brand-navy))'
        : 'linear-gradient(90deg,#d32f2f,#c62828)',
      color:'#fff', borderRadius:'10px', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', 
      zIndex:9999, fontFamily:'inherit'
    });
    document.body.appendChild(toast);
    setTimeout(()=> toast.style.opacity='0',1400);
    setTimeout(()=> toast.remove(),1800);
  };

  // visible inline message element for users with JS console closed
  const msgEl = document.getElementById('login-msg');
  const showMessage = (text) => {
    if (!msgEl) return;
    msgEl.style.display = 'block';
    msgEl.textContent = text;
  };

  // Global error handler to display unexpected errors on the page
  window.addEventListener('error', (ev) => {
    try { showMessage('Erro no script: ' + (ev && ev.message ? ev.message : 'ver console')); } catch (e) { /* ignore */ }
  });

  const show2FAPrompt = () => {
    twoFactorVerificationMode = true;
    const formContainer = document.querySelector('form');
    formContainer.innerHTML = `
      <div>
        <label for="2fa-code">Código de Verificação</label>
        <input id="2fa-code" name="2faCode" type="text" placeholder="Digite o código de 6 dígitos" required>
      </div>
      <div class="actions">
        <button type="submit" class="btn primary" id="btn-verify">Verificar</button>
      </div>
      <div class="small">Digite o código gerado pelo seu aplicativo autenticador.</div>
    `;
  };

  const handlePasswordReset = async (email) => {
    try {
      const response = await fetch('/api/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      showToast('Email de redefinição de senha enviado. Verifique sua caixa de entrada.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    
    try {
      if (twoFactorVerificationMode) {
        const code = document.getElementById('2fa-code').value;
        const response = await fetch('/api/2fa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: code })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        showToast('Verificação bem sucedida!');
        setTimeout(() => { window.location.href = '/dashboard'; }, 900);
        return;
      }

      const username = form.usuario.value.trim();
      const password = form.senha.value;
      const remember = form.remember.checked;
      
      if (!username || !password) {
        showToast('Preencha usuário e senha.', 'error');
        showMessage('Preencha usuário e senha.');
        btnSubmit.disabled = false;
        return;
      }

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember })
      });

      const data = await response.json();
      if (!response.ok) {
        const msg = data && data.error ? data.error : 'Falha ao autenticar';
        showToast(msg, 'error');
        showMessage(msg);
        throw new Error(msg);
      }

      if (data.requiresTwoFactor) {
        show2FAPrompt();
        btnSubmit.disabled = false;
        return;
      }

      if (data.requiresPasswordChange) {
        window.location.href = '/change-password';
        return;
      }

      showToast('Login efetuado com sucesso!');
      setTimeout(() => { window.location.href = '/dashboard'; }, 900);

    } catch (error) {
      const msg = error && error.message ? error.message : 'Erro desconhecido';
      showToast(msg, 'error');
      showMessage(msg);
      btnSubmit.disabled = false;
    }
  });
})();
