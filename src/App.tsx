import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Plus, Menu, X, Send, Trash2, Bot, User as UserIcon, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getGeminiResponse } from "./lib/gemini";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "model";
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

const LiquidBackground = ({ theme }: { theme: "light" | "dark" }) => (
  <div className={cn(
    "liquid-bg",
    theme === "dark" ? "bg-[#000000]" : "bg-[#ffffff]"
  )} />
);

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem("v_astra_sessions");
    const savedTheme = localStorage.getItem("v_astra_theme") as "light" | "dark";
    if (savedSessions) setSessions(JSON.parse(savedSessions));
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem("v_astra_sessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("v_astra_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }
    const savedMessages = localStorage.getItem(`v_astra_msgs_${currentSessionId}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      localStorage.setItem(`v_astra_msgs_${currentSessionId}`, JSON.stringify(messages));
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
      userId: "local-user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setInput("");
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    localStorage.removeItem(`v_astra_msgs_${id}`);
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title: input.slice(0, 30) + (input.length > 30 ? "..." : ""),
        userId: "local-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions(prev => [newSession, ...prev]);
      sessionId = newSession.id;
      setCurrentSessionId(sessionId);
    }

    const userMessage = input.trim();
    const userMsgObj: ChatMessage = {
      id: crypto.randomUUID(),
      content: userMessage,
      role: "user",
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsgObj]);
    setInput("");
    setIsLoading(true);

    try {
      const historyPayload = messages.map(m => ({ role: m.role, content: m.content }));
      const aiResponse = await getGeminiResponse(userMessage, historyPayload);

      const aiMsgObj: ChatMessage = {
        id: crypto.randomUUID(),
        content: aiResponse,
        role: "model",
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMsgObj]);

      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            title: s.title === "New Chat" ? userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "") : s.title
          };
        }
        return s;
      }));

    } catch (error) {
      console.error("Error in chat flow:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "flex h-screen overflow-hidden font-sans selection:bg-[#00d4ff]/30 transition-colors duration-500",
      theme === "dark" ? "text-gray-100" : "text-gray-900"
    )}>
      <LiquidBackground theme={theme} />
      
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-20 md:hidden backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? "320px" : "0px",
          x: isSidebarOpen ? 0 : -320
        }}
        className={cn(
          "fixed md:relative z-30 h-full flex flex-col overflow-hidden border-r glass shadow-2xl",
          theme === "dark" ? "border-white/10 bg-white/5" : "border-black/5 bg-black/[0.02]"
        )}
      >
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg",
              theme === "dark" ? "bg-[#00d4ff]/20 border-[#00d4ff]/30" : "bg-[#00d4ff]/10 border-[#1c32c4]/20"
            )}>
               <Bot className="w-7 h-7 text-[#00d4ff]" />
            </div>
            <span className={cn(
              "font-display font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br",
              theme === "dark" ? "from-white to-gray-400" : "from-black to-gray-600"
            )}>V-Astra</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-3 rounded-2xl hover:bg-black/5 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <button 
          onClick={createNewSession}
          className={cn(
            "mx-6 mb-8 flex items-center gap-4 p-5 rounded-[24px] border transition-all group shadow-sm",
            theme === "dark" 
              ? "bg-white/[0.03] border-white/10 hover:bg-[#00d4ff]/10 hover:border-[#00d4ff]/50" 
              : "bg-black/[0.02] border-black/5 hover:bg-[#00d4ff]/5 hover:border-[#00d4ff]/30"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform",
            theme === "dark" ? "bg-[#00d4ff]/10" : "bg-[#00d4ff]/20"
          )}>
            <Plus className="w-6 h-6 text-[#00d4ff]" />
          </div>
          <span className="font-bold text-lg font-display">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3 custom-scrollbar">
          {sessions.length === 0 ? (
             <div className="p-10 text-center opacity-30 text-sm font-medium tracking-wide font-black">
                SYSTEM IDLE.
             </div>
          ) : sessions.map((session) => (
            <div 
              key={session.id}
              onClick={() => {
                setCurrentSessionId(session.id);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full text-left p-5 rounded-[20px] flex items-center gap-4 transition-all relative group cursor-pointer border",
                currentSessionId === session.id 
                  ? (theme === "dark" 
                      ? "bg-white/[0.08] text-[#00d4ff] border-[#00d4ff]/30 shadow-[0_0_25px_rgba(0,212,255,0.08)]"
                      : "bg-[#00d4ff]/10 text-[#1c32c4] border-[#00d4ff]/30 shadow-lg")
                  : (theme === "dark"
                      ? "bg-transparent border-transparent hover:bg-white/[0.04] text-gray-400 hover:text-white"
                      : "bg-transparent border-transparent hover:bg-black/[0.03] text-gray-500 hover:text-black")
              )}
            >
              <MessageCircle className="w-5 h-5 flex-shrink-0 opacity-50" />
              <span className="truncate text-sm font-semibold flex-1 tracking-tight">{session.title}</span>
              <button 
                onClick={(e) => deleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-all font-black"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        <header className={cn(
          "h-20 border-b flex items-center px-8 justify-between glass sticky top-0 z-10",
          theme === "dark" ? "border-white/10" : "border-black/5"
        )}>
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(true)} className={cn("p-3 rounded-2xl hover:bg-black/5 transition-colors", isSidebarOpen && "md:hidden")}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className={cn(
              "text-[11px] font-black tracking-[0.4em] uppercase drop-shadow-[0_0_10px_rgba(0,212,255,0.5)]",
              theme === "dark" ? "text-[#00d4ff]" : "text-[#1c32c4]"
            )}>
               V-Astra Autonomous Intelligence System
            </h2>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={toggleTheme} className="p-3 rounded-2xl hover:bg-black/5 transition-colors border border-black/5 group">
                {theme === "dark" ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar space-y-12">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-12 max-w-4xl mx-auto py-20">
              <div className="space-y-6">
                <h3 className="text-6xl md:text-8xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-white/20">V-Astra AI</h3>
                <p className="text-xl md:text-2xl text-gray-400">The future of autonomous reasoning.</p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-8 w-full max-w-5xl mx-auto", message.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div className="w-14 h-14 rounded-[20px] flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10">
                {message.role === "user" ? <UserIcon className="w-7 h-7 text-white" /> : <Bot className="w-7 h-7 text-[#00d4ff]" />}
              </div>
              <div className="flex-1 px-10 py-8 glass-card border border-white/5 bg-white/[0.03] rounded-3xl">
                <div className="prose prose-invert max-w-none text-gray-200">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-8 w-full max-w-5xl mx-auto opacity-50">
              <div className="w-14 h-14 rounded-[20px] bg-white/5 flex items-center justify-center border border-white/10"><Bot className="w-7 h-7 animate-pulse text-[#00d4ff]" /></div>
              <div className="flex-1 px-10 py-8 glass-card border border-white/5 bg-white/[0.03] text-xs tracking-widest uppercase text-[#00d4ff]">Processing Data...</div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-32" />
        </div>

        <div className="p-8 md:p-16 relative">
           <div className="max-w-5xl mx-auto">
             <form onSubmit={handleSendMessage} className="relative flex items-center gap-4 p-4 border border-white/10 bg-black/20 rounded-3xl">
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                  placeholder="Initiate command sequence..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-white text-lg p-2"
                  rows={1}
                />
                <button type="submit" disabled={!input.trim() || isLoading} className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[#00d2ff] to-[#1c32c4] text-white flex items-center justify-center">
                  <Send className="w-7 h-7" />
                </button>
             </form>
           </div>
        </div>
      </main>
    </div>
  );
}
