import conexao from '../db/conexao.js';
import bcrypt from 'bcrypt';

(async () => {
  try {
    console.log('Starting users table migration...');

    // 1) If password column doesn't exist but password_hash does, create password and copy
    try {
      await conexao.promise().query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255)");
      const [cols] = await conexao.promise().query("SHOW COLUMNS FROM users LIKE 'password'");
      if (cols.length > 0) {
        // copy from password_hash if exists
        const [pwdHashCol] = await conexao.promise().query("SHOW COLUMNS FROM users LIKE 'password_hash'");
        if (pwdHashCol.length > 0) {
          console.log('Copying password_hash -> password');
          await conexao.promise().query("UPDATE users SET password = password_hash WHERE password IS NULL OR password = ''");
          console.log('Dropping password_hash column');
          await conexao.promise().query("ALTER TABLE users DROP COLUMN password_hash");
        }
      }
    } catch (err) {
      console.warn('Warning during password migration:', err.message);
    }

    // 2) Ensure additional columns exist
    const extraColumns = [
      "email VARCHAR(255) UNIQUE",
      "two_factor_secret VARCHAR(32)",
      "two_factor_enabled BOOLEAN DEFAULT FALSE",
      "reset_token VARCHAR(255)",
      "reset_token_expires DATETIME",
      "last_login DATETIME",
      "last_password_change DATETIME",
      "failed_login_attempts INT DEFAULT 0",
      "locked_until DATETIME",
      "remember_token VARCHAR(255)",
      "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      "status ENUM('active','inactive','locked') DEFAULT 'active'"
    ];

    for (const colDef of extraColumns) {
      const colName = colDef.split(' ')[0];
      await conexao.promise().query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${colDef}`);
      console.log(`Ensured column ${colName}`);
    }

    // 3) Make sure role column exists and has appropriate default
    await conexao.promise().query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'");

    // 4) Update known users' passwords to secure bcrypt hashes
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const userPasswordHash = await bcrypt.hash('user123', 10);

    await conexao.promise().query("UPDATE users SET password = ? WHERE username = 'admin'", [adminPasswordHash]);
    await conexao.promise().query("UPDATE users SET password = ? WHERE username = 'user'", [userPasswordHash]);

    // 5) Set status active for both
    await conexao.promise().query("UPDATE users SET status = 'active' WHERE username IN ('admin','user')");

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
