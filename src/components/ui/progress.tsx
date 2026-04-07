"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClassWithRules } from "@/lib/csp"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  const [indicatorClass, setIndicatorClass] = useState<string | null>(null)

  useEffect(() => {
    // create a class that sets transform according to value
    const v = typeof value === 'number' ? value : 0
    const percent = Math.max(0, Math.min(100, v))
    const cls = createClassWithRules(`transform: translateX(-${100 - percent}%);`)
    setIndicatorClass(cls)
    return () => {
      // no cleanup of injected style tag (cheap); could be improved
    }
  }, [value])

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClass || undefined)}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
