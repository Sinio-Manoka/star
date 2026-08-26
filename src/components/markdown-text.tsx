"use client";

import "katex/dist/katex.min.css";

import { StreamdownTextPrimitive } from "@assistant-ui/react-streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo } from "react";

const MarkdownTextImpl = () => (
  <StreamdownTextPrimitive
    containerClassName="aui-md"
    plugins={{ code, cjk, math, mermaid }}
    controls={{ code: true, table: true, mermaid: true }}
    linkSafety={{ enabled: true }}
    caret="circle"
    defer
  />
);

export const MarkdownText = memo(MarkdownTextImpl);
