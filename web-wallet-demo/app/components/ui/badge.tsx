import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-white/10 text-white",
                secondary:
                    "border-transparent bg-white/5 text-white/60",
                success:
                    "border-green-500/20 bg-green-500/10 text-green-400",
                destructive:
                    "border-red-500/20 bg-red-500/10 text-red-400",
                warning:
                    "border-orange-500/20 bg-orange-500/10 text-orange-400",
                info:
                    "border-blue-500/20 bg-blue-500/10 text-blue-400",
                outline: "text-white/60 border-white/20",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
