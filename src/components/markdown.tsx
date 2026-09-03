"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

function CodeBlock({
  language,
  code,
  isDark,
}: {
  language: string;
  code: string;
  isDark: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable in this context; nothing to fall back to
    }
  }

  return (
    <div className="group my-2 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between bg-neutral-100 px-3 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <span>{language || "text"}</span>
        <button
          onClick={copy}
          className="opacity-0 transition-opacity hover:text-neutral-900 group-hover:opacity-100 dark:hover:text-neutral-100"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || undefined}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: "0.75rem",
          fontSize: "0.8rem",
          background: "transparent",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function Markdown({ content, isDark }: { content: string; isDark: boolean }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children } = props as ComponentProps<"code"> & {
              className?: string;
            };
            const match = /language-(\w+)/.exec(className || "");
            const text = String(children);
            const isBlock = Boolean(match) || text.includes("\n");

            if (!isBlock) {
              return (
                <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-[0.85em] dark:bg-neutral-700">
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={match?.[1] ?? ""}
                code={text.replace(/\n$/, "")}
                isDark={isDark}
              />
            );
          },
          pre({ children }: { children?: ReactNode }) {
            return <>{children}</>;
          },
          table({ children }: { children?: ReactNode }) {
            return (
              <div className="my-2 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                <table className="w-full border-collapse text-left text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }: { children?: ReactNode }) {
            return <thead className="bg-neutral-100 dark:bg-neutral-800">{children}</thead>;
          },
          th({ children }: { children?: ReactNode }) {
            return (
              <th className="border-b border-neutral-200 px-3 py-1.5 font-medium dark:border-neutral-700">
                {children}
              </th>
            );
          },
          td({ children }: { children?: ReactNode }) {
            return (
              <td className="border-b border-neutral-100 px-3 py-1.5 dark:border-neutral-800">
                {children}
              </td>
            );
          },
          a({ children, href }: { children?: ReactNode; href?: string }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                {children}
              </a>
            );
          },
          ul({ children }: { children?: ReactNode }) {
            return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
          },
          ol({ children }: { children?: ReactNode }) {
            return <ol className="list-decimal space-y-1 pl-5">{children}</ol>;
          },
          blockquote({ children }: { children?: ReactNode }) {
            return (
              <blockquote className="border-l-2 border-neutral-300 pl-3 text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
