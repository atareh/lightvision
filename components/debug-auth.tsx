"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"

interface DebugAuthProps {
  children: React.ReactNode
  title?: string
  onPasswordChange?: (password: string) => void // NEW: Callback for password
}

export default function DebugAuth({ children, title = "Debug Access", onPasswordChange }: DebugAuthProps) {
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Check if already authenticated on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem("debug-auth")
    if (savedAuth === "true") {
      setIsAuthenticated(true)
      // Try to get saved password for API calls
      const savedPassword = sessionStorage.getItem("debug-password")
      if (savedPassword && onPasswordChange) {
        onPasswordChange(savedPassword)
      }
    }
  }, [onPasswordChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/debug-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setIsAuthenticated(true)
        localStorage.setItem("debug-auth", "true")
        sessionStorage.setItem("debug-password", password) // Store for API calls
        if (onPasswordChange) {
          onPasswordChange(password) // Pass password to parent
        }
      } else {
        setError("Invalid password")
      }
    } catch (error) {
      setError("Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPassword("")
    localStorage.removeItem("debug-auth")
    sessionStorage.removeItem("debug-password")
    if (onPasswordChange) {
      onPasswordChange("") // Clear password in parent
    }
  }

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white"
        style={{
          background: 'url("/images/back_lines.svg") 0% 0% / cover no-repeat #062723',
        }}
      >
        <Card className="w-full max-w-md bg-[#0f1a1f] border-[#2d5a4f]">
          <CardHeader>
            <CardTitle className="text-center text-white">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter debug password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#2d5a4f] border-[#2d5a4f] text-white pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#868d8f] hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1]"
              >
                {loading ? "Authenticating..." : "Access"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button onClick={handleLogout} className="fixed top-4 right-4 z-50 bg-red-600 hover:bg-red-700" size="sm">
        Logout
      </Button>
      {children}
    </div>
  )
}
