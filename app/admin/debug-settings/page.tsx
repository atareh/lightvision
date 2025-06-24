"use client"

import type React from "react"

import { useDebugSettings } from "@/hooks/use-debug-settings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"

export default function DebugSettingsPage() {
  const { settings, updateSetting, isLoaded } = useDebugSettings()
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState("")

  // Check for auth on mount
  useEffect(() => {
    const storedAuth = sessionStorage.getItem("debugSettingsAuthenticated")
    if (storedAuth === "true") {
      setIsAuthenticated(true)
    }
  }, [])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      const response = await fetch("/api/debug-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (response.ok) {
        setIsAuthenticated(true)
        sessionStorage.setItem("debugSettingsAuthenticated", "true")
      } else {
        const data = await response.json()
        setError(data.error || "Authentication failed")
      }
    } catch (err) {
      setError("An error occurred during authentication.")
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPassword("")
    sessionStorage.removeItem("debugSettingsAuthenticated")
  }

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading settings...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authenticate Debug Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Debug Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full">
                Authenticate
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Debug Log Settings</h1>
        <Button onClick={handleLogout} variant="outline">
          Logout
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Toggle Console Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="metrics-card-logs" className="text-lg font-medium">
                Metrics Card Logs
              </Label>
              <p className="text-sm text-muted-foreground">
                Show logs from individual metric cards (e.g., Daily Revenue).
              </p>
            </div>
            <Switch
              id="metrics-card-logs"
              checked={settings.showMetricsCardLogs}
              onCheckedChange={(checked) => updateSetting("showMetricsCardLogs", checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="revenue-sync-logs" className="text-lg font-medium">
                Client-Side Revenue Sync Logs
              </Label>
              <p className="text-sm text-muted-foreground">
                Show client-side logs related to revenue data fetching and display. Server-side cron logs are always
                active.
              </p>
            </div>
            <Switch
              id="revenue-sync-logs"
              checked={settings.showRevenueSyncLogs}
              onCheckedChange={(checked) => updateSetting("showRevenueSyncLogs", checked)}
            />
          </div>
          <p className="text-sm text-muted-foreground pt-4">
            Note: Server-side logs (e.g., from Cron Jobs or API Routes) will always be active on the server and visible
            in your Vercel deployment logs. These toggles only affect logs shown in the browser console.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
