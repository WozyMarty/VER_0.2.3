import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import mysql from "mysql2";
import conexao from "./db/conexao.js";
import bodyParser from "body-parser";
import cors from "cors";
import bcrypt from "bcrypt";
import session from "express-session";
import nodemailer from "nodemailer";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import moment from "moment";
import helmet from "helmet";
import { createServerlessHandler } from "@vercel/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const app = express();

// Security Headers
app.use(helmet());

// Rate limiting has been removed per configuration (no global or login-specific limiter)

app.use(cors());
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true, // prevents client side access to the cookie 
    sameSite: 'strict' // protects against CSRF
  },
  rolling: true // reset the cookie expiration on every response
}));

// Email configuration
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "your-email@gmail.com", // Replace with your email
    pass: "your-app-specific-password" // Replace with your app password
  }
});

// Activity Logger Middleware
const logActivity = async (userId, action, description, req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  try {
    await conexao.promise().query(
      'INSERT INTO user_activity_log (user_id, action, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [userId, action, description, ip, userAgent]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Auto-logout on inactivity middleware
app.use((req, res, next) => {
  if (req.session && req.session.lastActivity) {
    const currentTime = Date.now();
    const inactivityPeriod = 30 * 60 * 1000; // 30 minutes

    if (currentTime - req.session.lastActivity > inactivityPeriod) {
      return req.session.destroy(() => {
        res.redirect('/');
      });
    }
  }
  req.session.lastActivity = Date.now();
  next();
});

// API endpoint para buscar produtos
app.get('/api/produtos/busca', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  const searchTerm = req.query.q;
  if (!searchTerm || searchTerm.length < 2) {
    return res.status(400).json({ erro: 'Termo de busca muito curto' });
  }

  try {
    const [rows] = await conexao.promise().query(
      `SELECT id, nome, codigo, pn, quantidade
       FROM produtos 
       WHERE id = ? OR 
             nome LIKE ? OR 
             pn LIKE ? OR
             codigo LIKE ?
       LIMIT 10`,
      [
        searchTerm,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`
      ]
    );

    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ erro: 'Erro interno ao buscar produtos' });
  }
});

// Password validation middleware
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return password.length >= minLength && hasUpperCase && hasLowerCase && 
         hasNumbers && hasSpecialChar;
};

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/');
    }

    // Check if user still exists and is active
    const [rows] = await conexao.promise().query(
      'SELECT status, two_factor_enabled FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (rows.length === 0 || rows[0].status !== 'active') {
      req.session.destroy();
      return res.redirect('/?error=account-inactive');
    }

    // If 2FA is enabled and not verified for this session
    if (rows[0].two_factor_enabled && !req.session.twoFactorVerified) {
      return res.redirect('/2fa-verify');
    }

    // Update last activity
    await conexao.promise().query(
      'UPDATE user_sessions SET last_activity = NOW() WHERE user_id = ? AND token = ?',
      [req.session.userId, req.sessionID]
    );

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).send('Internal server error');
  }
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/');
    }

    const [rows] = await conexao.promise().query(
      'SELECT role, status FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (rows.length === 0 || rows[0].status !== 'active' || rows[0].role !== 'admin') {
      return res.status(403).send({ 
        error: 'Acesso negado. Requer privilégios de administrador.' 
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).send('Internal server error');
  }
};

// Servir arquivos estáticos (HTML, CSS, JS, imagens) sob o prefixo /static
// Isso evita que o middleware sirva automaticamente um index.html na raiz.
// Servir arquivos estáticos sem entregar automaticamente index.html
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use('/lib', express.static(path.join(__dirname, 'lib')));






// Nota: arquivos estáticos já expostos em /static e /lib

// ---------- ROTAS DE PÁGINAS ----------
app.get("/", (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, "public", "login.html"));
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  const { username, password, remember } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e senha são obrigatórios' });
  }

  try {
    const [users] = await conexao.promise().query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = users[0];

    // Check if account is locked
    if (user.locked_until && moment(user.locked_until).isAfter(moment())) {
      return res.status(401).json({ 
        error: 'Conta bloqueada. Tente novamente mais tarde.' 
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      // Increment failed login attempts
      await conexao.promise().query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?',
        [user.id]
      );

      // Check if we should lock the account
      if (user.failed_login_attempts >= 4) { // Lock after 5 attempts
        await conexao.promise().query(
          'UPDATE users SET locked_until = ?, status = ? WHERE id = ?',
          [moment().add(30, 'minutes').format('YYYY-MM-DD HH:mm:ss'), 'locked', user.id]
        );
      }

      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Reset failed attempts on successful login
    await conexao.promise().query(
      'UPDATE users SET failed_login_attempts = 0, last_login = NOW(), status = ? WHERE id = ?',
      ['active', user.id]
    );

    // Create session
    req.session.userId = user.id;
    req.session.userRole = user.role;

    // Handle remember me
    if (remember) {
      const rememberToken = await bcrypt.hash(user.id.toString(), 10);
      await conexao.promise().query(
        'UPDATE users SET remember_token = ? WHERE id = ?',
        [rememberToken, user.id]
      );
      
      // Set remember me cookie (30 days)
      res.cookie('remember_token', rememberToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false // set to true in production with HTTPS
      });
    }

    // Log activity
    await logActivity(user.id, 'login', 'User logged in successfully', req);

    // If 2FA is enabled
    if (user.two_factor_enabled) {
      req.session.awaitingTwoFactor = true;
      return res.json({ 
        success: true, 
        requiresTwoFactor: true 
      });
    }

    res.json({ 
      success: true, 
      role: user.role,
      requiresPasswordChange: moment().diff(moment(user.last_password_change), 'days') > 90
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Two-factor authentication setup
app.post('/api/2fa/setup', requireAuth, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret();
    const [user] = await conexao.promise().query(
      'SELECT email FROM users WHERE id = ?',
      [req.session.userId]
    );

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: user[0].email,
      issuer: 'TecnoTooling'
    });

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    await conexao.promise().query(
      'UPDATE users SET two_factor_secret = ? WHERE id = ?',
      [secret.base32, req.session.userId]
    );

    res.json({ 
      secret: secret.base32,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Erro ao configurar 2FA' });
  }
});

// Verify 2FA token
app.post('/api/2fa/verify', async (req, res) => {
  const { token } = req.body;

  try {
    const [user] = await conexao.promise().query(
      'SELECT two_factor_secret FROM users WHERE id = ?',
      [req.session.userId]
    );

    const verified = speakeasy.totp.verify({
      secret: user[0].two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (verified) {
      req.session.twoFactorVerified = true;
      await logActivity(req.session.userId, '2fa_verify', 'Two-factor authentication verified', req);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Código inválido' });
    }
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Erro ao verificar 2FA' });
  }
});

// Password reset request
app.post('/api/reset-password-request', async (req, res) => {
  const { email } = req.body;

  try {
    const resetToken = await bcrypt.hash(Date.now().toString(), 10);
    const expires = moment().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');

    await conexao.promise().query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
      [resetToken, expires, email]
    );

    const resetLink = `http://localhost:${PORT}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: '"TecnoTooling" <noreply@tecnotooling.com>',
      to: email,
      subject: 'Redefinição de Senha',
      html: `
        <p>Você solicitou a redefinição de sua senha.</p>
        <p>Clique no link abaixo para redefinir sua senha:</p>
        <a href="${resetLink}">Redefinir Senha</a>
        <p>Este link expira em 1 hora.</p>
      `
    });

    res.json({ success: true, message: 'Email de redefinição enviado' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Erro ao solicitar redefinição de senha' });
  }
});

// Password reset
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!validatePassword(newPassword)) {
    return res.status(400).json({ 
      error: 'A senha deve ter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais' 
    });
  }

  try {
    const [users] = await conexao.promise().query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await conexao.promise().query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL, last_password_change = NOW() WHERE id = ?',
      [hashedPassword, users[0].id]
    );

    await logActivity(users[0].id, 'password_reset', 'Password reset successfully', req);

    res.json({ success: true });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
});

// Change password
app.post('/api/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!validatePassword(newPassword)) {
    return res.status(400).json({ 
      error: 'A senha deve ter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais' 
    });
  }

  try {
    const [user] = await conexao.promise().query(
      'SELECT password FROM users WHERE id = ?',
      [req.session.userId]
    );

    const match = await bcrypt.compare(currentPassword, user[0].password);

    if (!match) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await conexao.promise().query(
      'UPDATE users SET password = ?, last_password_change = NOW() WHERE id = ?',
      [hashedPassword, req.session.userId]
    );

    await logActivity(req.session.userId, 'password_change', 'Password changed', req);

    res.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// Rota de logout
app.post("/api/logout", (req, res) => {
  const userId = req.session && req.session.userId;
  // destroy session
  req.session.destroy(async (err) => {
    try {
      if (userId) {
        // remove remember token from DB
        await conexao.promise().query('UPDATE users SET remember_token = NULL WHERE id = ?', [userId]);
      }
    } catch (e) {
      console.error('Error clearing remember token:', e);
    }

    // clear remember cookie
    res.clearCookie('remember_token');

    if (err) {
      return res.status(500).json({ error: 'Erro ao fazer logout' });
    }
    res.json({ success: true });
  });
});

// Session status endpoint
app.get('/api/session', async (req, res) => {
  try {
    if (req.session && req.session.userId) {
      const [rows] = await conexao.promise().query('SELECT id, username, role FROM users WHERE id = ?', [req.session.userId]);
      if (rows.length === 0) return res.json({ authenticated: false });
      return res.json({ authenticated: true, user: { id: rows[0].id, username: rows[0].username, role: rows[0].role } });
    }
    // not authenticated
    res.json({ authenticated: false });
  } catch (err) {
    console.error('Session check error:', err);
    res.status(500).json({ authenticated: false });
  }
});

// Rotas protegidas
app.get("/dashboard", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/estoque", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "estoque.html")));
app.get("/cadastrar", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "cadastrar.html")));
app.get("/baixa", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "baixa.html")));
app.get("/historico", requireAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));
app.get("/configuracao", requireAuth, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, "public", "configuracao.html")));

// Page for creating new users (admin-only)
app.get('/usuarios/novo', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'usuarios_novo.html'));
});

// API endpoint to create a new user (admin-only)
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Dados inválidos' });

    // check if username already exists
    const [existing] = await conexao.promise().query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(409).json({ error: 'Username já existe' });

    const hashed = await bcrypt.hash(password, 10);
    await conexao.promise().query(
      'INSERT INTO users (username, email, password, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [username, email || null, hashed, role || 'user', 'active']
    );

    res.json({ mensagem: 'Usuário criado com sucesso' });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Get user role endpoint
app.get("/api/user/role", requireAuth, async (req, res) => {
  try {
    const [rows] = await conexao.promise().query(
      'SELECT role FROM users WHERE id = ?',
      [req.session.userId]
    );
    if (rows.length > 0) {
      res.json({ role: rows[0].role });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error Handling middleware

app.get("/api/estoque", (req, res) => {
  conexao.query("SELECT * FROM produtos", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send({ erro: "Erro no banco" });
    }
    res.json(results);
  });
});

//Cadastro de itens
app.post("/api/cadastrar", (req, res) => {
  const { codigo, nome, pn, sn, categoria, setor, quantidade, peso_valor, peso_tipo, qtyMin } = req.body;
  if (!nome || !categoria || !setor || quantidade == null) return res.status(400).json({ erro: "Dados inválidos" });

  // Find existing product by name OR part number (pn) to merge quantities when appropriate
  let searchSql = "SELECT * FROM produtos WHERE nome = ?";
  const searchParams = [nome];
  if (pn) {
    searchSql = "SELECT * FROM produtos WHERE nome = ? OR pn = ?";
    searchParams.push(pn);
  }

  conexao.query(searchSql, searchParams, (err, results) => {
    if (err) return res.status(500).send({ erro: err.message });

    if (results.length > 0) {
      // Produto já existe (mesmo nome ou mesmo P/N) → atualiza/soma quantidade
      // If multiple rows returned prefer an exact P/N match when pn was provided
      let produto = results[0];
      if (pn && results.length > 1) {
        const byPn = results.find(r => r.pn === pn);
        if (byPn) produto = byPn;
      }
      // Use incoming qtyMin if provided, otherwise keep existing
      const newQtyMin = (typeof qtyMin !== 'undefined' && qtyMin !== null) ? qtyMin : produto.quantidade_minima;

      conexao.query(
        "UPDATE produtos SET quantidade = quantidade + ?, categoria = ?, setor = ?, pn = ?, sn = ?, peso_valor = ?, peso_tipo = ?, codigo = ?, quantidade_minima = ? WHERE id = ?",
        [quantidade, categoria, setor, pn, sn, peso_valor, peso_tipo, codigo, newQtyMin, produto.id],
        (err2) => {
          if (err2) return res.status(500).send({ erro: err2.message });

          // insere no histórico usando o mesmo id
          conexao.query(
            "INSERT INTO historico (id, tipo, codigo, nome, pn, sn, categoria, setor, peso_valor, peso_tipo, quantidade, quantidade_minima) VALUES (?, 'Cadastro', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [produto.id, codigo, nome, pn, sn, categoria, setor, peso_valor, peso_tipo, quantidade, newQtyMin],
            (err3) => {
              if (err3) return res.status(500).send({ erro: err3.message });
              res.json({ mensagem: "Produto atualizado (cadastro) com sucesso." });
            }
          );
        }
      );

    } else {
      // Produto não existe → insere novo
      conexao.query(
        "INSERT INTO produtos (codigo, nome, pn, sn, categoria, setor, quantidade, peso_valor, peso_tipo, quantidade_minima) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [codigo, nome, pn, sn, categoria, setor, quantidade, peso_valor, peso_tipo, qtyMin || null],
        (err2, result) => {
          if (err2) return res.status(500).send({ erro: err2.message });

          const novoId = result.insertId; // pega o id do produto recém criado

          conexao.query(
            "INSERT INTO historico (id, tipo, codigo, nome, pn, sn, categoria, setor, peso_valor, peso_tipo, quantidade, quantidade_minima) VALUES (?, 'Cadastro', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [novoId, codigo, nome, pn, sn, categoria, setor, peso_valor, peso_tipo, quantidade, qtyMin || null],
            (err3) => {
              if (err3) return res.status(500).send({ erro: err3.message });
              res.json({ mensagem: "Produto cadastrado com sucesso." });
            }
          );
        }
      );
    }
  });
});


// Dar baixa
app.post("/api/baixa", (req, res) => {
  const { nome, quantidade } = req.body;
  if (!nome || quantidade == null)
    return res.status(400).json({ erro: "Dados inválidos" });

  conexao.query("SELECT * FROM produtos WHERE nome = ?", [nome], (err, results) => {
    if (err) return res.status(500).send({ erro: err.message });
    if (results.length === 0) return res.status(404).json({ erro: "Produto não encontrado" });

    const produto = results[0];
    if (produto.quantidade < quantidade)
      return res.status(400).json({ erro: "Estoque insuficiente" });

    conexao.query(
      "UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?",
      [quantidade, produto.id],
      (err2) => {
        if (err2) return res.status(500).send({ erro: err2.message });

        conexao.query(
          "INSERT INTO historico (id, tipo, nome, pn, sn, categoria, setor, peso_valor, peso_tipo, quantidade) VALUES (?, 'Baixa', ?, ?, ?, ?, ?, ?, ?, ?)",
          [produto.id, produto.nome, produto.pn || null, produto.sn || null, produto.categoria, produto.setor, produto.peso_valor, produto.peso_tipo, quantidade],
          (err3) => {
            if (err3) return res.status(500).send({ erro: err3.message });
            res.json({ mensagem: "Baixa registrada com sucesso." });
          }
        );
      }
    );
  });
});
// Buscar produto por ID
app.get("/api/produto/:id", (req, res) => {
  const { id } = req.params;
  conexao.query("SELECT * FROM produtos WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (results.length === 0) return res.status(404).json({ erro: "Produto não encontrado" });
    res.json(results[0]);
  });
});

// Remover produto completamente
app.delete("/api/remover/:id", (req, res) => {
  const { id } = req.params;
  conexao.query("SELECT * FROM produtos WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (results.length === 0) return res.status(404).json({ erro: "Produto não encontrado" });

    const produto = results[0];
    conexao.query("DELETE FROM produtos WHERE id = ?", [id], (err2) => {
      if (err2) return res.status(500).json({ erro: err2.message });

      // Registrar no histórico (usa a coluna `id` conforme schema)
      conexao.query(
        "INSERT INTO historico (id, tipo, nome, pn, sn, categoria, setor, peso_valor, peso_tipo, quantidade) VALUES (?, 'Baixa', ?, ?, ?, ?, ?, ?, ?, ?)",
        [produto.id, produto.nome, produto.pn || null, produto.sn || null, produto.categoria, produto.setor, produto.peso_valor, produto.peso_tipo, produto.quantidade],
        (err3) => {
          if (err3) console.error("Erro ao salvar no histórico:", err3);
        }
      );

      res.json({ mensagem: "Produto removido com sucesso." });
    });
  });
});


// Histórico
app.get("/api/historico", (req, res) => {
  conexao.query("SELECT * FROM historico ORDER BY data DESC", (err, results) => {
    if (err) return res.status(500).send({ erro: err.message });
    res.json(results);
  });
});





//Verificador de Banco de Dados automatico
const tempConn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
});

// lê o conteúdo do schema.sql
const schema = fs.readFileSync("./db/schema.sql", "utf8");

// executa o script (cria banco + tabelas se não existirem)
tempConn.query(schema, (err) => {
  if (err) {
    console.error("❌ Erro ao criar banco de dados:", err);
  } else {
    console.log("✅ Banco de dados e tabelas verificados/criados!");
  }
  tempConn.end();
});
