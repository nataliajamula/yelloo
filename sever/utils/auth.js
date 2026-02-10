const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { query } = require("../config/database")

// Password hashing
const hashPassword = async (password) => {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash)
}

// JWT token generation
const generateAccessToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  )
}

const generateRefreshToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: "refresh" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  )
}

// Token verification
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    throw new Error("Invalid access token")
  }
}

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
  } catch (error) {
    throw new Error("Invalid refresh token")
  }
}

// Refresh token database operations
const saveRefreshToken = async (userId, token) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  await query(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [userId, token, expiresAt]
  )
}

const revokeRefreshToken = async (token) => {
  await query(
    "UPDATE refresh_tokens SET is_revoked = true WHERE token = $1",
    [token]
  )
}

const revokeAllUserTokens = async (userId) => {
  await query(
    "UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1",
    [userId]
  )
}

const isRefreshTokenValid = async (token) => {
  const result = await query(
    "SELECT * FROM refresh_tokens WHERE token = $1 AND is_revoked = false AND expires_at > NOW()",
    [token]
  )
  return result.rows.length > 0
}

// Clean up expired tokens (should be run periodically)
const cleanupExpiredTokens = async () => {
  await query(
    "DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = true"
  )
}

// Generate token pair
const generateTokenPair = async (userId, email) => {
  const accessToken = generateAccessToken(userId, email)
  const refreshToken = generateRefreshToken(userId, email)
  
  await saveRefreshToken(userId, refreshToken)
  
  return { accessToken, refreshToken }
}

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  isRefreshTokenValid,
  cleanupExpiredTokens,
  generateTokenPair,
}