import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

function readDbEnv(names: string[], fallback: string) {
  for (const name of names) {
    const value = process.env[name]
    if (value !== undefined && value !== '') {
      return value
    }
  }

  return fallback
}

export function getDbPool() {
  if (!pool) {
    const config = useRuntimeConfig()
    const host = readDbEnv(['DB_HOST', 'MYSQLHOST'], config.dbHost)
    const port = readDbEnv(['DB_PORT', 'MYSQLPORT'], config.dbPort)
    const user = readDbEnv(['DB_USER', 'MYSQLUSER'], config.dbUser)
    const password = readDbEnv(['DB_PASSWORD', 'MYSQLPASSWORD'], config.dbPassword)
    const database = readDbEnv(['DB_NAME', 'MYSQLDATABASE'], config.dbName)
    
    pool = mysql.createPool({
      host,
      port: parseInt(port, 10),
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })
  }
  
  return pool
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getDbPool()
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params)
  return results.length > 0 ? results[0] : null
}
