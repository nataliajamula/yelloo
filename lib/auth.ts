// Authentication utilities and API calls

interface User {
  id: number
  email: string
  username?: string
  createdAt: string
  lastLogin?: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface AuthResponse {
  message: string
  user: User
  tokens: AuthTokens
}

interface RefreshResponse {
  tokens: AuthTokens
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"

// Token management
export const tokenManager = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null
    return localStorage.getItem("accessToken")
  },

  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null
    return localStorage.getItem("refreshToken")
  },

  setTokens: (tokens: AuthTokens): void => {
    if (typeof window === "undefined") return
    localStorage.setItem("accessToken", tokens.accessToken)
    localStorage.setItem("refreshToken", tokens.refreshToken)
  },

  clearTokens: (): void => {
    if (typeof window === "undefined") return
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
  },

  isTokenExpired: (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      return payload.exp * 1000 < Date.now()
    } catch {
      return true
    }
  },
}

// API request wrapper with automatic token refresh
const apiRequest = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`
  let accessToken = tokenManager.getAccessToken()

  // Check if access token is expired and refresh if needed
  if (accessToken && tokenManager.isTokenExpired(accessToken)) {
    const refreshToken = tokenManager.getRefreshToken()
    if (refreshToken && !tokenManager.isTokenExpired(refreshToken)) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        })

        if (refreshResponse.ok) {
          const data: RefreshResponse = await refreshResponse.json()
          tokenManager.setTokens(data.tokens)
          accessToken = data.tokens.accessToken
        } else {
          // Refresh failed, clear tokens
          tokenManager.clearTokens()
          throw new Error("Session expired")
        }
      } catch (error) {
        tokenManager.clearTokens()
        throw new Error("Session expired")
      }
    } else {
      tokenManager.clearTokens()
      throw new Error("Session expired")
    }
  }

  // Add authorization header if we have a token
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

// Authentication API functions
export const authAPI = {
  register: async (email: string, password: string, username?: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username }),
    })

    if (!response.ok) {
      const error = await response.json()
      
      // If we have detailed validation errors, format them nicely
      if (error.details && Array.isArray(error.details)) {
        const messages = error.details.map((detail: any) => detail.message).join('. ')
        throw new Error(messages)
      }
      
      throw new Error(error.error || "Registration failed")
    }

    return response.json()
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Login failed")
    }

    return response.json()
  },

  logout: async (): Promise<void> => {
    const refreshToken = tokenManager.getRefreshToken()
    
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      })
    } catch (error) {
      console.error("Logout API call failed:", error)
    } finally {
      tokenManager.clearTokens()
    }
  },

  logoutAll: async (): Promise<void> => {
    try {
      await apiRequest("/auth/logout-all", {
        method: "POST",
      })
    } catch (error) {
      console.error("Logout all API call failed:", error)
    } finally {
      tokenManager.clearTokens()
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiRequest("/auth/me")

    if (!response.ok) {
      throw new Error("Failed to get user profile")
    }

    const data = await response.json()
    return data.user
  },

  updateProfile: async (username: string): Promise<User> => {
    const response = await apiRequest("/auth/me", {
      method: "PUT",
      body: JSON.stringify({ username }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Profile update failed")
    }

    const data = await response.json()
    return data.user
  },

  refreshToken: async (): Promise<AuthTokens> => {
    const refreshToken = tokenManager.getRefreshToken()
    
    if (!refreshToken) {
      throw new Error("No refresh token available")
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      throw new Error("Token refresh failed")
    }

    const data: RefreshResponse = await response.json()
    return data.tokens
  },
}

export type { User, AuthTokens, AuthResponse }