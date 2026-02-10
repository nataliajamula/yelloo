"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { authAPI, tokenManager, type User } from "@/lib/auth"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, username?: string) => Promise<void>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  updateProfile: (username: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user

  // Load user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const accessToken = tokenManager.getAccessToken()
        const refreshToken = tokenManager.getRefreshToken()

        if (!accessToken || !refreshToken) {
          setIsLoading(false)
          return
        }

        // If access token is expired, try to refresh
        if (tokenManager.isTokenExpired(accessToken)) {
          if (tokenManager.isTokenExpired(refreshToken)) {
            tokenManager.clearTokens()
            setIsLoading(false)
            return
          }

          try {
            const tokens = await authAPI.refreshToken()
            tokenManager.setTokens(tokens)
          } catch (error) {
            console.error("Token refresh failed:", error)
            tokenManager.clearTokens()
            setIsLoading(false)
            return
          }
        }

        // Load user profile
        const userData = await authAPI.getCurrentUser()
        setUser(userData)
      } catch (error) {
        console.error("Failed to load user:", error)
        tokenManager.clearTokens()
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true)
      const response = await authAPI.login(email, password)
      
      tokenManager.setTokens(response.tokens)
      setUser(response.user)
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const register = useCallback(async (email: string, password: string, username?: string) => {
    try {
      setIsLoading(true)
      const response = await authAPI.register(email, password, username)
      
      tokenManager.setTokens(response.tokens)
      setUser(response.user)
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      setIsLoading(true)
      await authAPI.logout()
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      tokenManager.clearTokens()
      setUser(null)
      setIsLoading(false)
    }
  }, [])

  const logoutAll = useCallback(async () => {
    try {
      setIsLoading(true)
      await authAPI.logoutAll()
    } catch (error) {
      console.error("Logout all failed:", error)
    } finally {
      tokenManager.clearTokens()
      setUser(null)
      setIsLoading(false)
    }
  }, [])

  const updateProfile = useCallback(async (username: string) => {
    try {
      const updatedUser = await authAPI.updateProfile(username)
      setUser(updatedUser)
    } catch (error) {
      throw error
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authAPI.getCurrentUser()
      setUser(userData)
    } catch (error) {
      console.error("Failed to refresh user:", error)
      throw error
    }
  }, [])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    logoutAll,
    updateProfile,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export default AuthContext