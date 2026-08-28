"use client";

import type { FC } from "react";
import { Badge } from "@/components/ui/badge";

type IconComponent = FC<{ className?: string }>;

export type DirectiveTextSegment =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "mention";
      readonly type: string;
      readonly label: string;
      readonly id: string;
    };

export type DirectiveTextFormatter = {
  parse(text: string): readonly DirectiveTextSegment[];
};

export type CreateDirectiveTextOptions = {
  iconMap?: Record<string, IconComponent>;
  fallbackIcon?: IconComponent;
};

/** Creates a text component that parses directive syntax and renders inline chips. */
export function createDirectiveText(
  formatter: DirectiveTextFormatter,
  options?: CreateDirectiveTextOptions,
): FC<{ text: string }> {
  const iconMap = options?.iconMap;
  const fallbackIcon = options?.fallbackIcon;

  const Component: FC<{ text: string }> = ({ text }) => {
    const segments = formatter.parse(text);

    if (segments.length === 1 && segments[0]!.kind === "text") {
      return <>{text}</>;
    }

    return (
      <>
        {segments.map((segment, index) => {
          if (segment.kind === "text") {
            return (
              <span key={index} className="whitespace-pre-wrap">
                {segment.text}
              </span>
            );
          }

          const Icon = iconMap?.[segment.type] ?? fallbackIcon;
          return (
            <Badge
              key={index}
              variant="secondary"
              data-slot="directive-text-chip"
              data-directive-type={segment.type}
              data-directive-id={segment.id}
              aria-label={`${segment.type}: ${segment.label}`}
              className="aui-directive-chip items-baseline px-1.5 py-0.5 text-[13px] leading-none [&_svg]:self-center"
            >
              {Icon && <Icon />}
              {segment.label}
            </Badge>
          );
        })}
      </>
    );
  };
  Component.displayName = "DirectiveText";
  return Component;
}
