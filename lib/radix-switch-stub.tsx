"use client"

import * as React from "react"

/* ----------------------------------------------------------------
   Lightweight, fully-controlled stub for @radix-ui/react-switch
   – exports Root, Thumb, and a convenience default (Switch)
   – keeps same prop-shape Radix expects: checked, onCheckedChange, disabled
----------------------------------------------------------------- */

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (value: boolean) => void
}

/* Root ------------------------------------------------------------------- */
export const Root = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, defaultChecked, onCheckedChange, disabled, className = "", ...rest }, ref) => {
    const [internal, setInternal] = React.useState(!!defaultChecked)
    const isControlled = checked !== undefined
    const isChecked = isControlled ? !!checked : internal

    function toggle() {
      if (disabled) return
      if (!isControlled) setInternal(!isChecked)
      onCheckedChange?.(!isChecked)
    }

    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        data-state={isChecked ? "checked" : "unchecked"}
        onClick={toggle}
        ref={ref}
        className={[
          "inline-flex h-5 w-9 items-center rounded-full transition-colors",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          isChecked ? "bg-emerald-500" : "bg-gray-300",
          className,
        ].join(" ")}
        {...rest}
      >
        <Thumb data-state={isChecked ? "checked" : "unchecked"} />
      </button>
    )
  },
)
Root.displayName = "Switch.Root"

/* Thumb ------------------------------------------------------------------ */
export const Thumb = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className = "", ...rest }, ref) => (
    <span
      ref={ref}
      className={[
        "block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]",
        className,
      ].join(" ")}
      {...rest}
    />
  ),
)
Thumb.displayName = "Switch.Thumb"

/* Convenience default export (matches shadcn/ui pattern) ------------------ */
const Switch = Object.assign(Root, { Thumb })
export default Switch
