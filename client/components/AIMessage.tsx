"use client";

import { Item } from "@/components/ui/item"; 
import React from "react";
import OptimizedMarkdown from "./Markdown";

interface AIMessageProps {
  content: string;
}

export default function AIMessage({ content }: AIMessageProps) {
  return (
    <Item
      asChild
      className="self-start w-fit  bg-secondary text-secondary-foreground rounded-lg p-3 break-words shadow-sm cursor-default hover:bg-secondary/90"
    >
      <div className="prose prose-sm sm:prose-base break-words">
        <OptimizedMarkdown content={content} />
      </div>
    </Item>
  );
}
