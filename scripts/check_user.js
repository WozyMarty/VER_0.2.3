import conexao from '../db/conexao.js';

(async ()=>{
  try{
    const [cols] = await conexao.promise().query("SHOW COLUMNS FROM users");
    console.log('columns in users table:');
    console.table(cols.map(c => ({Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key, Default: c.Default})));

    const [rows] = await conexao.promise().query("SELECT * FROM users LIMIT 5");
    console.log('sample rows:');
    console.log(rows);
    process.exit(0);
  }catch(err){
    console.error('err', err);
    process.exit(1);
  }
})();
