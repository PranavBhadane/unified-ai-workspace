import { testConnection, query } from '../config/db.js';

async function main() {
  console.log('[TestDB] Testing database connection...');
  const res = await testConnection();
  if (!res.connected) {
    console.error('[TestDB] Connection FAILED:', res.error);
    process.exit(1);
  }
  console.log('[TestDB] Connection SUCCESSFUL!');
  console.log(`Database: ${res.database}`);
  console.log(`MySQL Version: ${res.version}`);
  
  const tables = await query('SHOW TABLES');
  console.log(`Total Tables: ${tables.length}`);
  tables.forEach(t => console.log(' - ' + Object.values(t)[0]));
  process.exit(0);
}

main().catch(err => {
  console.error('[TestDB] Unexpected error:', err);
  process.exit(1);
});
