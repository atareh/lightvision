"use client"

import DebugAuth from "@/components/debug-auth"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Loader2, CheckCircle, XCircle, RefreshCw, Eye, EyeOff } from "lucide-react"

interface AddTokenResult {
  success: boolean
  message: string
  token?: any
  error?: string
}

interface Token {
  id: string
  contract_address: string
  name: string | null
  symbol: string | null
  enabled: boolean
  is_hidden?: boolean
  created_at: string
  updated_at: string
}

export default function AdminTokensPage() {
  const [contractAddress, setContractAddress] = useState("")
  const [name, setName] = useState("")
  const [symbol, setSymbol] = useState("")
  const [adminSecret, setAdminSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AddTokenResult | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [tokensLoading, setTokensLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({})
  const [visibilityLoading, setVisibilityLoading] = useState<{ [key: string]: boolean }>({})

  const addToken = async (tokenData: { contract_address: string; name?: string; symbol?: string }) => {
    const response = await fetch("/api/admin/add-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...tokenData,
        admin_secret: adminSecret,
      }),
    })

    const result = await response.json()
    return {
      success: response.ok,
      message: result.message || (response.ok ? "Token added successfully" : "Failed to add token"),
      token: result.token,
      error: result.error,
    }
  }

  const loadTokens = async () => {
    if (!adminSecret) return

    setTokensLoading(true)
    try {
      const response = await fetch(`/api/admin/list-tokens?admin_secret=${encodeURIComponent(adminSecret)}`)
      if (response.ok) {
        const data = await response.json()
        setTokens(data.tokens || [])
      }
    } catch (error) {
      console.error("Failed to load tokens:", error)
    } finally {
      setTokensLoading(false)
    }
  }

  useEffect(() => {
    if (adminSecret) {
      loadTokens()
    }
  }, [adminSecret])

  const handleAddToken = async () => {
    if (!contractAddress || !adminSecret) {
      setResult({
        success: false,
        message: "Contract address and admin secret are required",
        error: "Missing required fields",
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const tokenResult = await addToken({
        contract_address: contractAddress,
        name: name || undefined,
        symbol: symbol || undefined,
      })

      setResult(tokenResult)

      if (tokenResult.success) {
        // Clear form on success
        setContractAddress("")
        setName("")
        setSymbol("")
        // Reload tokens list
        loadTokens()
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Network error",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleToken = async (contractAddress: string, currentEnabled: boolean) => {
    setActionLoading((prev) => ({ ...prev, [contractAddress]: true }))

    try {
      const response = await fetch("/api/admin/toggle-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_address: contractAddress,
          enabled: !currentEnabled,
          admin_secret: adminSecret,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        setTokens((prev) =>
          prev.map((token) =>
            token.contract_address === contractAddress ? { ...token, enabled: !currentEnabled } : token,
          ),
        )
      } else {
        alert(`Failed to ${currentEnabled ? "disable" : "enable"} token: ${result.error}`)
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [contractAddress]: false }))
    }
  }

  const deleteToken = async (contractAddress: string, symbol: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete ${symbol || contractAddress}? This will remove all historical data and cannot be undone.`,
      )
    ) {
      return
    }

    setActionLoading((prev) => ({ ...prev, [contractAddress]: true }))

    try {
      const response = await fetch("/api/admin/delete-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_address: contractAddress,
          admin_secret: adminSecret,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Remove from local state
        setTokens((prev) => prev.filter((token) => token.contract_address !== contractAddress))
      } else {
        alert(`Failed to delete token: ${result.error}`)
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [contractAddress]: false }))
    }
  }

  const toggleTokenVisibility = async (contractAddress: string, currentIsHidden: boolean | undefined) => {
    setVisibilityLoading((prev) => ({ ...prev, [contractAddress]: true }))

    try {
      const response = await fetch("/api/admin/toggle-token-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_address: contractAddress,
          is_hidden: !currentIsHidden, // Toggle the current state
          admin_secret: adminSecret,
        }),
      })

      const result = await response.json()

      if (result.success && result.token) {
        setTokens((prev) =>
          prev.map((token) =>
            token.contract_address === contractAddress ? { ...token, is_hidden: result.token.is_hidden } : token,
          ),
        )
      } else {
        alert(`Failed to toggle visibility: ${result.error || "Unknown error"}`)
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setVisibilityLoading((prev) => ({ ...prev, [contractAddress]: false }))
    }
  }

  return (
    <DebugAuth title="Token Admin">
      <div
        className="min-h-screen text-white p-6"
        style={{
          background: 'url("/images/back_lines.svg") 0% 0% / cover no-repeat #062723',
        }}
      >
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold mb-8">Token Administration</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Add Tokens */}
            <div className="space-y-6">
              {/* Admin Secret */}
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardHeader>
                  <CardTitle>Admin Authentication</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="admin-secret">Admin Secret</Label>
                      <div className="relative">
                        <Input
                          id="admin-secret"
                          type={showSecret ? "text" : "password"}
                          placeholder="Enter admin secret"
                          value={adminSecret}
                          onChange={(e) => setAdminSecret(e.target.value)}
                          className="bg-[#2d5a4f] border-[#2d5a4f] text-white pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#868d8f] hover:text-white"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Add Single Token */}
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardHeader>
                  <CardTitle>Add Single Token</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="contract-address">Contract Address *</Label>
                      <Input
                        id="contract-address"
                        placeholder="0x..."
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        className="bg-[#2d5a4f] border-[#2d5a4f] text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Name (Optional)</Label>
                        <Input
                          id="name"
                          placeholder="Token Name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="bg-[#2d5a4f] border-[#2d5a4f] text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="symbol">Symbol (Optional)</Label>
                        <Input
                          id="symbol"
                          placeholder="SYMBOL"
                          value={symbol}
                          onChange={(e) => setSymbol(e.target.value)}
                          className="bg-[#2d5a4f] border-[#2d5a4f] text-white"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleAddToken}
                      disabled={loading || !contractAddress || !adminSecret}
                      className="w-full bg-[#51d2c1] text-black hover:bg-white hover:text-[#51d2c1]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding Token...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Token
                        </>
                      )}
                    </Button>

                    {result && (
                      <div
                        className={`p-4 rounded-lg ${result.success ? "bg-[#20a67d]/10 border border-[#20a67d]" : "bg-[#ed7188]/10 border border-[#ed7188]"}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {result.success ? (
                            <CheckCircle className="h-5 w-5 text-[#20a67d]" />
                          ) : (
                            <XCircle className="h-5 w-5 text-[#ed7188]" />
                          )}
                          <span className={result.success ? "text-[#20a67d]" : "text-[#ed7188]"}>{result.message}</span>
                        </div>
                        {result.error && <p className="text-[#ed7188] text-sm">Error: {result.error}</p>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Current Tokens */}
            <div className="space-y-6">
              {/* Current Tokens List */}
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Current Tokens
                    <Button
                      onClick={loadTokens}
                      disabled={tokensLoading || !adminSecret}
                      variant="ghost"
                      size="sm"
                      className="text-[#51d2c1] hover:text-white"
                    >
                      <RefreshCw className={`h-4 w-4 ${tokensLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!adminSecret ? (
                    <p className="text-[#868d8f] text-center py-8">Enter admin secret to view tokens</p>
                  ) : tokensLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-[#868d8f]">Loading tokens...</p>
                    </div>
                  ) : tokens.length === 0 ? (
                    <p className="text-[#868d8f] text-center py-8">No tokens found</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {tokens.map((token) => (
                        <div key={token.id} className="border border-[#2d5a4f] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium text-white">{token.symbol || "Unknown"}</span>
                              {token.name && <span className="text-[#868d8f] ml-2">{token.name}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={token.enabled ? "bg-[#20a67d] text-black" : "bg-[#868d8f] text-white"}>
                                {token.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                              <Badge className={!token.is_hidden ? "bg-blue-500 text-white" : "bg-gray-500 text-white"}>
                                {!token.is_hidden ? "Visible" : "Hidden"}
                              </Badge>
                              <Button
                                onClick={() => toggleToken(token.contract_address, token.enabled)}
                                disabled={actionLoading[token.contract_address]}
                                size="sm"
                                variant="ghost"
                                className={`h-8 w-8 p-0 ${token.enabled ? "text-orange-400 hover:text-orange-300" : "text-green-400 hover:text-green-300"}`}
                              >
                                {actionLoading[token.contract_address] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : token.enabled ? (
                                  "⏸️"
                                ) : (
                                  "▶️"
                                )}
                              </Button>
                              <Button
                                onClick={() => toggleTokenVisibility(token.contract_address, token.is_hidden)}
                                disabled={
                                  visibilityLoading[token.contract_address] || actionLoading[token.contract_address]
                                }
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-purple-400 hover:text-purple-300"
                                title={token.is_hidden ? "Make Visible" : "Hide Token"}
                              >
                                {visibilityLoading[token.contract_address] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : token.is_hidden ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                onClick={() => deleteToken(token.contract_address, token.symbol || "Unknown")}
                                disabled={actionLoading[token.contract_address]}
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                              >
                                {actionLoading[token.contract_address] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "🗑️"
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="text-[#868d8f] text-xs font-mono">{token.contract_address}</p>
                          <p className="text-[#868d8f] text-xs mt-1">
                            Added: {new Date(token.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card className="bg-[#0f1a1f] border-[#2d5a4f] rounded-2xl">
                <CardHeader>
                  <CardTitle>Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-[#868d8f] text-sm">
                    <p>1. Enter the admin secret (same as debug password)</p>
                    <p>
                      2. Add tokens by contract address - name and symbol are optional and will be fetched automatically
                    </p>
                    <p>3. After adding tokens, they will be tracked automatically by the 5-minute refresh cron job</p>
                    <p>4. Metrics will appear within 5 minutes of adding a token</p>
                    <p>5. Use ⏸️ to disable tracking (keeps data) or 🗑️ to permanently delete</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DebugAuth>
  )
}
