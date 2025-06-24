"use client"

import { useState, useEffect, useCallback } from "react"

const DEBUG_SETTINGS_KEY = "hypescreenerDebugSettings"

interface DebugSettings {
  showMetricsCardLogs: boolean
  showRevenueSyncLogs: boolean // This will be for client-side display, server logs are always on
}

const defaultSettings: DebugSettings = {
  showMetricsCardLogs: false,
  showRevenueSyncLogs: false,
}

export function useDebugSettings() {
  const [settings, setSettings] = useState<DebugSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(DEBUG_SETTINGS_KEY)
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings))
      }
    } catch (error) {
      console.error("Error loading debug settings from localStorage:", error)
    }
    setIsLoaded(true)
  }, [])

  const updateSetting = useCallback(<K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => {
    setSettings((prevSettings) => {
      const newSettings = { ...prevSettings, [key]: value }
      try {
        localStorage.setItem(DEBUG_SETTINGS_KEY, JSON.stringify(newSettings))
      } catch (error) {
        console.error("Error saving debug settings to localStorage:", error)
      }
      return newSettings
    })
  }, [])

  const log = useCallback(
    (type: keyof DebugSettings, ...args: any[]) => {
      if (isLoaded && settings[type]) {
        console.log(...args)
      }
    },
    [settings, isLoaded],
  )

  const error = useCallback(
    (type: keyof DebugSettings, ...args: any[]) => {
      if (isLoaded && settings[type]) {
        console.error(...args)
      }
    },
    [settings, isLoaded],
  )

  return { settings, updateSetting, log, error, isLoaded }
}
