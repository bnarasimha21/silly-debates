"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! I'm your Silly Debates AI assistant. Ask me anything about past debates, winners, or statistics! For example:\n\n- \"What was the funniest debate so far?\"\n- \"Who has won the most debates?\"\n- \"Show me debates about food\"\n- \"What are the overall statistics?\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Build conversation history (excluding the initial greeting and the current message)
      const conversationHistory = messages
        .slice(1) // Skip the initial greeting
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      setError(errMsg);
      console.error("Chat error:", errMsg);
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${errMsg}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const clearChat = () => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content:
          "Hi! I'm your Silly Debates AI assistant. Ask me anything about past debates, winners, or statistics! For example:\n\n- \"What was the funniest debate so far?\"\n- \"Who has won the most debates?\"\n- \"Show me debates about food\"\n- \"What are the overall statistics?\"",
      },
    ]);
    setError(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Ask AI</h1>
          <p className="text-gray-600 text-sm">
            Chat with our AI about past debates and statistics
          </p>
        </div>
        <button
          onClick={clearChat}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Clear chat
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white"
                  : "bg-white border border-gray-100 shadow-sm text-gray-800"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤖</span>
                  <span className="text-xs font-medium text-purple-600">
                    Silly Debates AI
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          "What was the funniest debate?",
          "Who's leading the leaderboard?",
          "Show me food debates",
          "What are the stats?",
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => handleSuggestionClick(suggestion)}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about past debates..."
          maxLength={500}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
