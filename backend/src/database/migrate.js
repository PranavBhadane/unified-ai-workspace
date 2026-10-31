import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConnection, testConnection } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('[Migration] Checking database connection...');
  const connTest = await testConnection();
  if (!connTest.connected) {
    console.error('[Migration] Database connection failed:', connTest.error);
    process.exit(1);
  }
  console.log(`[Migration] Connected to MySQL (${connTest.version}), DB: ${connTest.database}`);

  const connection = await getConnection();
  try {
    // Create migrations tracker table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const migrationsDir = path.resolve(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const [rows] = await connection.query(
        'SELECT id FROM schema_migrations WHERE migration_name = ?',
        [file]
      );
      if (rows.length > 0) {
        console.log(`[Migration] Skipping already applied: ${file}`);
        continue;
      }

      console.log(`[Migration] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Remove comment-only lines and clean up SQL
      const cleanSql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

      const statements = cleanSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        console.log(`[Migration] Executing: ${statement.substring(0, 60).replace(/\n/g, ' ')}...`);
        try {
          await connection.query(statement);
        } catch (stmtErr) {
          if (stmtErr.errno === 1060) {
            // Duplicate column name, already added safely
            console.log(`[Migration] Notice: Column already exists, skipping.`);
          } else {
            throw stmtErr;
          }
        }
      }
      await connection.query(
        'INSERT INTO schema_migrations (migration_name) VALUES (?)',
        [file]
      );
      console.log(`[Migration] Successfully applied: ${file}`);
    }

    // Verify all created tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`[Migration] Migration complete. Verified ${tables.length} tables in ${connTest.database}.`);
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigrations();
