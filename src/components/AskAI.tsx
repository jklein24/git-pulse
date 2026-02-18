"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface QAPair {
  question: string;
  answer: string | null;
  error?: string;
}

const EXAMPLE_QUESTIONS = [
  "Who merged the most PRs this month?",
  "What's the average PR size by repo?",
  "Which PRs took the longest to merge?",
  "How many PRs were merged last week?",
];

export default function AskAI() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<QAPair[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setInput("");
    setHistory((prev) => [...prev, { question: trimmed, answer: null }]);
    setLoading(true);

    fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: trimmed }),
    })
      .then((r) => r.json())
      .then((data) => {
        setHistory((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (data.error) {
            updated[updated.length - 1] = { ...last, error: data.error };
          } else {
            updated[updated.length - 1] = { ...last, answer: data.answer };
          }
          return updated;
        });
      })
      .catch((err) => {
        setHistory((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, error: err.message };
          return updated;
        });
      })
      .finally(() => setLoading(false));
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 hover:border-accent/50 transition-all shadow-lg shadow-accent/10 flex items-center justify-center"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[560px] h-[600px] bg-bg-secondary border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-sm font-display font-semibold text-text-primary">Ask Your Data</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 border-b border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your engineering data..."
            maxLength={1000}
            className="flex-1 px-3 py-2 text-sm bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-3 py-2 text-sm font-medium bg-accent/15 text-accent border border-accent/30 rounded-lg hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Ask
          </button>
        </form>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {history.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="text-xs px-2.5 py-1.5 bg-bg-tertiary border border-border rounded-lg text-text-secondary hover:text-accent hover:border-accent/30 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((pair, i) => (
            <div key={i} className="space-y-2">
              <div className="text-sm text-text-primary font-medium">{pair.question}</div>
              {pair.answer ? (
                <div className="text-sm text-text-secondary leading-relaxed prose-ai">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: (props) => (
                        <div className="overflow-x-auto my-2">
                          <table className="w-full text-xs border-collapse" {...props} />
                        </div>
                      ),
                      thead: (props) => <thead className="text-left text-text-muted" {...props} />,
                      th: (props) => <th className="px-2 py-1 border-b border-border font-semibold" {...props} />,
                      td: (props) => <td className="px-2 py-1 border-b border-border/40" {...props} />,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes("language-");
                        return isBlock ? (
                          <pre className="bg-bg-tertiary rounded-lg p-2 my-2 overflow-x-auto text-xs font-mono">
                            <code>{children}</code>
                          </pre>
                        ) : (
                          <code className="bg-bg-tertiary rounded px-1 py-0.5 text-xs font-mono">{children}</code>
                        );
                      },
                      pre: ({ children }) => <>{children}</>,
                      p: (props) => <p className="my-1.5" {...props} />,
                      ul: (props) => <ul className="list-disc pl-4 my-1.5 space-y-0.5" {...props} />,
                      ol: (props) => <ol className="list-decimal pl-4 my-1.5 space-y-0.5" {...props} />,
                      strong: (props) => <strong className="font-semibold text-text-primary" {...props} />,
                      h1: (props) => <p className="font-semibold text-text-primary mt-2 mb-1" {...props} />,
                      h2: (props) => <p className="font-semibold text-text-primary mt-2 mb-1" {...props} />,
                      h3: (props) => <p className="font-semibold text-text-primary mt-2 mb-1" {...props} />,
                    }}
                  >
                    {pair.answer}
                  </ReactMarkdown>
                </div>
              ) : pair.error ? (
                <div className="text-sm text-danger/80">{pair.error}</div>
              ) : (
                <div className="flex items-center gap-2 text-text-muted text-sm">
                  <span className="w-3 h-3 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
