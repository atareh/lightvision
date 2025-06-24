"use client"

/**
 * Minimal, accessible replacement for `@radix-ui/react-switch`.
 * It intentionally mimics the Radix API surface (`Root`, `Thumb`)
 * so the rest of the codebase can stay untouched.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchRootProps extends Omit<React.ComponentPropsWithoutRef<"button">, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export const Root = React.forwardRef<HTMLButtonElement, SwitchRootProps>(
  ({ checked = false, onCheckedChange, className, children, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      ref={ref}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className,
      )}
      {...props}
    >
      {/* children slot so the real <Thumb /> can sit inside */}
      {children}
    </button>
  ),
)
Root.displayName = "SwitchRoot"

export interface SwitchThumbProps extends React.ComponentPropsWithoutRef<"span"> {
  checked?: boolean
}

export const Thumb = React.forwardRef<HTMLSpanElement, SwitchThumbProps>(
  ({ checked = false, className, ...props }, ref) => (
    <span
      ref={ref}
      data-checked={checked ? "true" : "false"}
      className={cn(
        "pointer-events-none inline-block h-4 w-4 translate-x-0 rounded-full bg-background shadow transition-transform",
        checked ? "translate-x-4" : "translate-x-0",
        className,
      )}
      {...props}
    />
  ),
)
Thumb.displayName = "SwitchThumb"

/**
 * Convenience re-export for files that do
 * `import { Switch } from "@/components/ui/switch"`
 */
export const Switch = Object.assign(Root, { Thumb })
