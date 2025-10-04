"use client";

import { Item } from "@/components/ui/item"; // shadcn Item
import React from "react";

interface UserMessageProps {
  content: string;
}

export default function UserMessage({ content }: UserMessageProps) {
  return (
    <Item
      asChild
      className="self-end w-fit max-w-[75%] bg-primary text-primary-foreground rounded-lg p-3 break-words shadow-sm cursor-default hover:bg-primary/90"
    >
      <div>{content}</div>
    </Item>
  );
}
