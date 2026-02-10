const { Pool } = require("pg")
require("dotenv").config()

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "videochat_db",
  password: process.env.DB_PASSWORD || "password",
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
}

// Create connection pool
const pool = new Pool(dbConfig)

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect()
    console.log("✅ Database connected successfully")
    client.release()
  } catch (error) {
    console.error("❌ Database connection failed:", error.message)
    process.exit(1)
  }
}

// Query helper function
const query = async (text, params) => {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log("📊 Query executed:", { text: text.substring(0, 50), duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error("❌ Database query error:", error.message)
    throw error
  }
}

// Transaction helper
const transaction = async (callback) => {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
}
