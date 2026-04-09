"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  activeCommodity: string;
  commodityName: string;
  selectedDate: string | null;
};

export function ChatPanel({ activeCommodity, commodityName, selectedDate }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setError(null);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          commodity_slug: activeCommodity,
          selected_date: selectedDate,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || "Chat failed");
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
        setIsSending(false);
        return;
      }

      // Consume SSE stream
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              );
            }
          } catch {
            // Skip
          }
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1f2233]">
        <h3 className="text-xs font-semibold text-white">Chat</h3>
        <span className="text-[9px] text-gray-600">{commodityName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && !error && (
          <p className="py-4 text-center text-[10px] text-gray-700 italic">
            Ask about {commodityName} prices, trends, or news...
          </p>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <p className="text-[10px] text-red-400">{error}</p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-lg px-3 py-1.5 text-[11px] leading-relaxed ${
                m.role === "user"
                  ? "bg-[#c9a44a]/20 text-[#e8d5a0]"
                  : "bg-[#1f2233] text-gray-300"
              }`}
            >
              {m.content || (
                <span className="inline-block animate-pulse text-gray-600">●●●</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-[#1f2233] px-3 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask about this commodity..."
          disabled={isSending}
          className="flex-1 rounded-lg border border-[#3a3d4a] bg-[#252838] px-3 py-1.5 text-xs text-gray-300 outline-none placeholder:text-gray-700 focus:border-[#c9a44a] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="rounded-lg bg-[#c9a44a] px-2.5 py-1.5 text-xs font-semibold text-[#0f1117] transition-colors hover:bg-[#d4b45a] disabled:opacity-30"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
