CREATE DATABASE IF NOT EXISTS estoque_db;
USE estoque_db;

CREATE TABLE IF NOT EXISTS produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE,
  nome VARCHAR(100) NOT NULL UNIQUE,
  categoria VARCHAR(100) NOT NULL,
  setor VARCHAR(100) NOT NULL,
  um_valor DECIMAL(10,2),
  um_tipo1 VARCHAR(30),
  um_tipo2 VARCHAR(30),
  um_tipo3 VARCHAR(30),
  localizacao TEXT(100),
  peso_valor DECIMAL(10,2),
  peso_tipo VARCHAR(30),
  quantidade_minima INT,
  quantidade INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS historico (
  id INT NOT NULL, -- mesmo ID do produto
  tipo ENUM('Cadastro','Baixa') NOT NULL,
  codigo VARCHAR(50),
  nome VARCHAR(100) NOT NULL,
  categoria VARCHAR(100),
  setor VARCHAR(100),
  um_valor DECIMAL(10,2),
  um_tipo1 VARCHAR(30),
  um_tipo2 VARCHAR(30),
  um_tipo3 VARCHAR(30),
  localizacao VARCHAR(100),
  peso_valor DECIMAL(10,2),
  peso_tipo VARCHAR(30),
  quantidade_minima INT,
  quantidade INT NOT NULL,
  data DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES produtos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  role ENUM('user', 'admin') DEFAULT 'user',
  two_factor_secret VARCHAR(32),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  reset_token VARCHAR(255),
  reset_token_expires DATETIME,
  last_login DATETIME,
  last_password_change DATETIME,
  failed_login_attempts INT DEFAULT 0,
  locked_until DATETIME,
  remember_token VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('active', 'inactive', 'locked') DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity DATETIME,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default users (admin123/user123)
-- Insert default users (admin123/user123) - only insert if the username isn't already present
INSERT INTO users (username, email, password, role, status)
SELECT 'admin', 'admin@tecnotooling.com', '$2b$10$rHqo4VrxKlJnAP8B1lGgQOFaZB9.cCdOGzXFNgxDOy5hPxqX5PtMq', 'admin', 'active'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO users (username, email, password, role, status)
SELECT 'user', 'user@tecnotooling.com', '$2b$10$zJnRZvGG5RLiBhXHFQg.oujzGtAf1HUCG0HC9Q4TWgHJ3yp8gN9Xy', 'user', 'active'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'user');

