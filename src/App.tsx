import React, { useState, useRef, useEffect } from "react";
import { Bot, User, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getGeminiResponse } from "./lib/gemini";

interface Message {
  role: "user" | "model";
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    
    // 1. UI-ലേക്ക് യൂസർ മെസ്സേജ് ചേർക്കുന്നു
    const newMessages = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // 2. നിലവിലുള്ള ഹിസ്റ്ററി കൃത്യമായി gemini-ലേക്ക് അയക്കുന്നു
      const aiResponse = await getGeminiResponse(userMsg, messages);
      
      // 3. AI മറുപടി UI-ലേക്ക് ചേർക്കുന്നു
      setMessages([...newMessages, { role: "model" as const, content: aiResponse }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white font-sans">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center px-6 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-[#00d4ff]" />
          <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-[#00d4ff]">V-Astra AI System</h1>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <Bot className="w-16 h-16 mb-4 text-[#00d4ff] animate-pulse" />
            <h2 className="text-2xl font-bold">V-Astra AI</h2>
            <p className="text-sm mt-2">Ready to assist you. Send a message to start.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === "user" ? "bg-[#00d4ff] text-black" : "bg-white/10 text-[#00d4ff]"}`}>
              {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <div className={`p-4 rounded-2xl border ${msg.role === "user" ? "bg-white/[0.06] border-white/10" : "bg-white/[0.02] border-white/5"}`}>
              <div className="prose prose-invert max-w-none text-gray-200">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 max-w-4xl mx-auto opacity-50">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><Bot className="w-5 h-5 animate-spin" /></div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs tracking-widest uppercase text-[#00d4ff]">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <footer className="p-4 md:p-6 bg-black/20 border-t border-white/5">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-2 focus-within:border-[#00d4ff]/40 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 bg-transparent border-none outline-none px-4 text-white placeholder:text-gray-600"
          />
          <button type="submit" disabled={!input.trim() || isLoading} className="w-12 h-12 rounded-xl bg-[#00d4ff] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
