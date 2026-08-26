"use client";

import type { ComponentProps } from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        outline:
          "border-input text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground border bg-transparent",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        muted:
          "bg-muted text-muted-foreground [a&]:hover:bg-muted/80 [a&]:hover:text-foreground",
        ghost:
          "text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground bg-transparent",
        info: "bg-[color-mix(in_oklch,var(--status-running)_16%,var(--background))] text-[color-mix(in_oklch,var(--status-running)_68%,var(--foreground))] [a&]:hover:bg-[color-mix(in_oklch,var(--status-running)_22%,var(--background))]",
        warning:
          "bg-[color-mix(in_oklch,var(--status-approval)_16%,var(--background))] text-[color-mix(in_oklch,var(--status-approval)_68%,var(--foreground))] [a&]:hover:bg-[color-mix(in_oklch,var(--status-approval)_22%,var(--background))]",
        success:
          "bg-[color-mix(in_oklch,var(--status-completed)_16%,var(--background))] text-[color-mix(in_oklch,var(--status-completed)_68%,var(--foreground))] [a&]:hover:bg-[color-mix(in_oklch,var(--status-completed)_22%,var(--background))]",
        destructive:
          "bg-[color-mix(in_oklch,var(--status-failed)_16%,var(--background))] text-[color-mix(in_oklch,var(--status-failed)_68%,var(--foreground))] [a&]:hover:bg-[color-mix(in_oklch,var(--status-failed)_22%,var(--background))]",
      },
      size: {
        sm: "px-1.5 py-0.5",
        default: "px-2 py-1",
        lg: "px-2.5 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
);

export type BadgeProps = useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, size, render, ...props }: BadgeProps) {
  const dataProps = {
    "data-slot": "badge",
    "data-variant": variant,
    "data-size": size,
  } as ComponentProps<"span">;

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      dataProps,
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props,
    ),
    render,
  });
}

export { Badge, badgeVariants };
