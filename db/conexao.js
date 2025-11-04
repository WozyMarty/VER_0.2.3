import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config();

const conexao = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "estoque_db",
  multipleStatements: true
});

conexao.connect(err => {
  if (err) {
    console.error("Erro ao conectar no MySQL:", err.message);
    return;
  }
  console.log("✅ Conectado ao MySQL!");
});

export default conexao;
