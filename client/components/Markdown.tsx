"use client";

import React from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypePrism from "rehype-prism-plus";
import "katex/dist/katex.min.css";
import "prismjs/themes/prism-tomorrow.css";

interface OptimizedMarkdownProps {
  content: string;
}

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const markdownComponents: Components = {
  h1: ({ ...props }) => (
    <h1 className="text-2xl font-bold mt-4 mb-2 break-words" {...props} />
  ),
  h2: ({ ...props }) => (
    <h2 className="text-xl font-semibold mt-3 mb-2 break-words" {...props} />
  ),
  h3: ({ ...props }) => (
    <h3 className="text-lg font-semibold mt-2 mb-1 break-words" {...props} />
  ),

  p: ({ children, ...props }) => {
    const hasPre =
      Array.isArray(children) &&
      children.some(
        (child: React.ReactNode) =>
          React.isValidElement(child) && child.type === "pre"
      );
    if (hasPre) return <>{children}</>;
    return (
      <p className="mb-2 break-words whitespace-pre-wrap" {...props}>
        {children}
      </p>
    );
  },

  ul: ({ ...props }) => (
    <ul className="list-disc ml-5 mb-2 break-words" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="list-decimal ml-5 mb-2 break-words" {...props} />
  ),
  li: ({ ...props }) => <li className="mb-1 break-words" {...props} />,

  table: ({ ...props }) => (
    <div className="overflow-x-auto my-2">
      <table
        className="table-auto border border-border text-sm w-full"
        {...props}
      />
    </div>
  ),
  th: ({ ...props }) => (
    <th
      className="border px-2 py-1 bg-muted font-medium text-left"
      {...props}
    />
  ),
  td: ({ ...props }) => (
    <td className="border px-2 py-1 break-words" {...props} />
  ),

  code: (props: CodeProps) => {
    const { inline, className, children, ...rest } = props;
    const match = /language-(\w+)/.exec(className || "");

    if (inline) {
      return (
        <code
          className="bg-gray-200 text-gray-900 px-1 py-[2px] rounded text-sm break-words"
          {...rest}
        >
          {children}
        </code>
      );
    }

    return (
      <pre
        className={`overflow-x-auto text-sm rounded my-3 p-3 ${
          match ? `language-${match[1]}` : ""
        }`}
      >
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    );
  },

  blockquote: ({ ...props }) => (
    <blockquote
      className="border-l-2 border-muted pl-3 italic text-muted my-2 break-words"
      {...props}
    />
  ),

  img: ({ src, alt, ...props }) => {
    if (!src) return null;


    return (
      <img
        src={src}
        alt={alt || ""}
        className="rounded max-w-full my-2"
        {...props}
      />
    );
  },
  a: ({ ...props }) => (
    <a className="text-blue-600 hover:underline break-all" {...props} />
  ),
  hr: ({ ...props }) => <hr className="my-3 border-gray-300" {...props} />,
};

export default function OptimizedMarkdown({ content }: OptimizedMarkdownProps) {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypePrism]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
