// Simple rate limiting utility
export function rateLimit({ uniqueTokenPerInterval = 500, interval = 60000 }) {
  const tokens = new Map()

  return {
    check: (res: any, token: string, limit: number) => {
      const now = Date.now()
      const tokenCount = tokens.get(token) || [0]

      if (tokenCount[0] === 0) {
        tokens.set(token, [1, now])
        return Promise.resolve()
      }

      if (now - tokenCount[1] > interval) {
        // Reset if outside interval
        tokens.set(token, [1, now])
        return Promise.resolve()
      }

      // If within interval and exceeding limit
      if (tokenCount[0] >= limit) {
        return Promise.reject()
      }

      // Increment count
      tokens.set(token, [tokenCount[0] + 1, tokenCount[1]])
      return Promise.resolve()
    },
  }
}
