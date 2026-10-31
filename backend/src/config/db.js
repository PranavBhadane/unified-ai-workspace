import mysql from 'mysql2/promise';
import config from './env.js';

let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(config.db);
  }
  return pool;
}

/**
 * Execute a query with parameters using the connection pool
 */
export async function query(sql, params = []) {
  const p = getPool();
  const [results, fields] = await p.execute(sql, params);
  return results;
}

/**
 * Acquire a connection from the pool for transactions
 */
export async function getConnection() {
  const p = getPool();
  return await p.getConnection();
}

/**
 * Test MySQL connection
 */
export async function testConnection() {
  try {
    const p = getPool();
    const [rows] = await p.query('SELECT 1 + 1 AS result, DATABASE() as current_db, VERSION() as mysql_version');
    return {
      connected: true,
      database: rows[0].current_db,
      version: rows[0].mysql_version
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

export default {
  getPool,
  query,
  getConnection,
  testConnection
};
