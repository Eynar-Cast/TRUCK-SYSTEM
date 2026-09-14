const crypto=require('crypto');
const fs=require('fs'),path=require('path');
function cargarEnv(){const r=path.join(__dirname,'..','.env.local'); for(const l of fs.readFileSync(r,'utf8').split(/\r?\n/)){const m=l.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/); if(m){process.env.DATABASE_URL=m[1].trim().replace(/^["']|["']$/g,''); break;}}}
cargarEnv();
const {Pool}=require('pg');
const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
async function main(){
  const token='MTTO-'+crypto.randomBytes(6).toString('hex').toUpperCase()+'-'+Date.now().toString(36).toUpperCase();
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const expira=new Date(Date.now()+72*3600*1000).toISOString();
  await pool.query(`INSERT INTO mantenimientos (hash, expira) VALUES ($1, $2)`, [hash, expira]);
  console.log('TOKEN (entregar al cliente vía WhatsApp, 1 uso, 72h):');
  console.log(token);
  console.log('HASH:', hash);
  console.log('Expira:', expira);
  await pool.end();
}
main().catch(e=>{console.error(e); process.exit(1)});
