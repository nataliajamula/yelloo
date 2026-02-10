const express = require("express")
const { query, transaction } = require("../config/database")
const { 
  hashPassword, 
  comparePassword, 
  generateTokenPair, 
  verifyRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  revokeAllUserTokens
} = require("../utils/auth")
const { authenticateToken } = require("../middleware/auth")
const { 
  validateRegistration, 
  validateLogin, 
  handleValidationErrors 
} = require("../middleware/validation")
const { authLimiter } = require("../middleware/rateLimiting")

const router = express.Router()

// User Registration
router.post("/register", 
  authLimiter,
  validateRegistration,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, username } = req.body

      // Check if user already exists
      const existingUser = await query(
        "SELECT id FROM users WHERE email = $1 OR username = $2",
        [email, username]
      )

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ 
          error: "User with this email or username already exists" 
        })
      }

      // Hash password
      const passwordHash = await hashPassword(password)

      // Create user
      const result = await query(
        "INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username, created_at",
        [email, passwordHash, username]
      )

      const user = result.rows[0]

      // Generate tokens
      const { accessToken, refreshToken } = await generateTokenPair(user.id, user.email)

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken
        }
      })

    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  }
)

// User Login
router.post("/login",
  authLimiter,
  validateLogin,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body

      // Find user
      const userResult = await query(
        "SELECT id, email, username, password_hash, is_active FROM users WHERE email = $1",
        [email]
      )

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" })
      }

      const user = userResult.rows[0]

      if (!user.is_active) {
        return res.status(401).json({ error: "Account is deactivated" })
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.password_hash)

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" })
      }

      // Update last login
      await query(
        "UPDATE users SET last_login = NOW() WHERE id = $1",
        [user.id]
      )

      // Generate tokens
      const { accessToken, refreshToken } = await generateTokenPair(user.id, user.email)

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        },
        tokens: {
          accessToken,
          refreshToken
        }
      })

    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  }
)

// Token Refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" })
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken)
    
    // Check if token exists in database and is valid
    const isValid = await isRefreshTokenValid(refreshToken)
    
    if (!isValid) {
      return res.status(401).json({ error: "Invalid or expired refresh token" })
    }

    // Get user data
    const userResult = await query(
      "SELECT id, email, username, is_active FROM users WHERE id = $1",
      [decoded.userId]
    )

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return res.status(401).json({ error: "User not found or inactive" })
    }

    const user = userResult.rows[0]

    // Revoke old refresh token and generate new tokens
    await revokeRefreshToken(refreshToken)
    const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair(user.id, user.email)

    res.json({
      tokens: {
        accessToken,
        refreshToken: newRefreshToken
      }
    })

  } catch (error) {
    console.error("Token refresh error:", error)
    res.status(401).json({ error: "Invalid refresh token" })
  }
})

// Logout (revoke refresh token)
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (refreshToken) {
      await revokeRefreshToken(refreshToken)
    }

    res.json({ message: "Logout successful" })

  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Logout from all devices
router.post("/logout-all", authenticateToken, async (req, res) => {
  try {
    await revokeAllUserTokens(req.user.id)
    res.json({ message: "Logged out from all devices" })

  } catch (error) {
    console.error("Logout all error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get current user profile
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userResult = await query(
      "SELECT id, email, username, created_at, last_login FROM users WHERE id = $1",
      [req.user.id]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({ user: userResult.rows[0] })

  } catch (error) {
    console.error("Get user profile error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Update user profile
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const { username } = req.body

    if (!username) {
      return res.status(400).json({ error: "Username is required" })
    }

    // Check if username is already taken by another user
    const existingUser = await query(
      "SELECT id FROM users WHERE username = $1 AND id != $2",
      [username, req.user.id]
    )

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Username already taken" })
    }

    // Update username
    const result = await query(
      "UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, username, updated_at",
      [username, req.user.id]
    )

    res.json({
      message: "Profile updated successfully",
      user: result.rows[0]
    })

  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router