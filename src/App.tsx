import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Plus, Menu, X, Moon, Sun, Send, Trash2, Bot, User as UserIcon, Loader2 } from "lucide-react";
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

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Sessions and Theme from LocalStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem("v_astra_sessions");
    const savedTheme = localStorage.getItem("v_astra_theme") as "dark" | "light";
    
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    }
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Save Sessions to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem("v_astra_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // Load Messages for current session
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

  // Save Messages to LocalStorage whenever they change
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
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const aiResponse = await getGeminiResponse(userMessage, history);

      const aiMsgObj: ChatMessage = {
        id: crypto.randomUUID(),
        content: aiResponse || "Sorry, I couldn't process that.",
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

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("v_astra_theme", newTheme);
  };

  return (
    <div className={cn(
      "flex h-screen overflow-hidden transition-colors duration-300 font-sans",
      theme === "dark" ? "bg-[#010409] text-gray-100" : "bg-white text-gray-900"
    )}>
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
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
          "fixed md:relative z-30 h-full flex flex-col border-r overflow-hidden transition-colors duration-300 shadow-2xl",
          theme === "dark" ? "bg-[#0d1117] border-[#30363d]" : "bg-gray-50 border-gray-200"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00d4ff]/10 rounded-xl flex items-center justify-center">
               <Bot className="w-6 h-6 text-[#00d4ff]" />
            </div>
            <span className="font-bold text-2xl tracking-tighter text-[#00d4ff]">V-Astra AI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-gray-500/10">
            <X className="w-6 h-6" />
          </button>
        </div>

        <button 
          onClick={createNewSession}
          className="mx-4 mb-6 mt-2 flex items-center gap-3 p-4 border-2 rounded-2xl hover:bg-[#00d4ff]/10 hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all group shadow-sm bg-gradient-to-r from-transparent to-transparent hover:from-[#00d4ff]/5"
          style={{ borderColor: theme === "dark" ? "#30363d" : "#e5e7eb" }}
        >
          <Plus className="w-6 h-6 group-hover:scale-125 transition-transform text-[#00d4ff]" />
          <span className="font-bold text-lg">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
          {sessions.length === 0 ? (
             <div className="p-10 text-center text-gray-500 text-sm font-medium opacity-50">
                No conversations yet.
             </div>
          ) : sessions.map((session) => (
            <div 
              key={session.id}
              onClick={() => {
                setCurrentSessionId(session.id);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-all relative group cursor-pointer border-2",
                currentSessionId === session.id 
                  ? (theme === "dark" ? "bg-[#161b22] text-[#00d4ff] border-[#00d4ff]/50 shadow-[0_0_20px_rgba(0,212,255,0.1)]" : "bg-white text-[#00d4ff] shadow-lg border-[#00d4ff]/50")
                  : (theme === "dark" ? "hover:bg-[#161b22] border-transparent" : "hover:bg-white hover:shadow-md border-transparent")
              )}
            >
              <MessageCircle className="w-5 h-5 flex-shrink-0 opacity-60" />
              <span className="truncate text-sm font-bold flex-1">{session.title}</span>
              <button 
                onClick={(e) => deleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className={cn(
          "p-6 border-t mt-auto",
          theme === "dark" ? "border-[#30363d]" : "border-gray-200"
        )}>
          <button 
            onClick={toggleTheme} 
            className={cn(
              "w-full flex items-center justify-center gap-3 p-4 rounded-2xl transition-all font-bold text-sm border-2",
              theme === "dark" ? "hover:bg-white/5 border-transparent text-gray-300" : "hover:bg-white border-transparent hover:shadow-md text-gray-600"
            )}
          >
            {theme === "dark" ? (
              <><Sun className="w-5 h-5 text-yellow-400" /> Light Mode</>
            ) : (
              <><Moon className="w-5 h-5 text-indigo-600" /> Dark Mode</>
            )}
          </button>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col relative h-full">
        <header className={cn(
          "h-16 border-b flex items-center px-6 justify-between transition-colors duration-300 sticky top-0 z-10",
          theme === "dark" ? "bg-[#010409]/80 border-[#30363d] backdrop-blur-md" : "bg-white/80 border-gray-200 backdrop-blur-md"
        )}>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className={cn("p-2 rounded-lg hover:bg-gray-500/10", isSidebarOpen && "md:hidden")}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xs font-black tracking-widest uppercase text-gray-500">
               {sessions.find(s => s.id === currentSessionId)?.title || "V-Astra Autonomous Intelligence System"}
            </h2>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar space-y-10">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-10 max-w-2xl mx-auto">
              <motion.div 
                initial={{ scale: 0.2, opacity: 0, rotate: -45 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-[#00d4ff] to-[#0072ff] flex items-center justify-center shadow-[0_0_60px_rgba(0,212,255,0.4)]"
              >
                <Bot className="w-16 h-16 text-white drop-shadow-2xl" />
              </motion.div>
              <div className="space-y-4">
                <h3 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-b from-current to-transparent bg-clip-text">V-Astra AI</h3>
                <p className={cn(
                  "text-xl md:text-2xl font-semibold opacity-60",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}>
                  Hyper-efficient intelligence at your service.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                 {[
                   "Draft a complex technical proposal",
                   "Explain the Simulation Theory",
                   "Write a performant sorting algorithm",
                   "Design a sustainable urban layout"
                 ].map((suggestion, i) => (
                   <motion.button 
                     key={suggestion}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ delay: i * 0.1 }}
                     onClick={() => setInput(suggestion)}
                     className={cn(
                       "p-6 text-left rounded-[2rem] border-2 hover:border-[#00d4ff] hover:bg-[#00d4ff]/5 transition-all shadow-sm hover:shadow-xl",
                       theme === "dark" ? "bg-[#0d1117] border-[#30363d]" : "bg-white border-gray-100"
                     )}
                   >
                     <p className="font-black text-[10px] tracking-widest uppercase text-[#00d4ff] mb-2">Prompt Node {i + 1}</p>
                     <p className="font-bold text-base leading-snug">{suggestion}</p>
                   </motion.button>
                 ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <motion.div 
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-6 w-full max-w-4xl mx-auto",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl",
                message.role === "user" ? "bg-gradient-to-br from-[#00d4ff] to-blue-700" : "bg-[#0d1117] border-2 border-[#30363d]"
              )}>
                {message.role === "user" ? <UserIcon className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-[#00d4ff]" />}
              </div>
              <div className={cn(
                "flex-1 px-8 py-5 rounded-[2.5rem] overflow-hidden shadow-sm border-2",
                message.role === "user" 
                  ? (theme === "dark" ? "bg-[#161b22] border-[#30363d]" : "bg-[#f8fafc] border-gray-100") 
                  : "bg-transparent border-transparent"
              )}>
                <div className={cn(
                  "prose prose-sm md:prose-base max-w-none leading-relaxed font-medium",
                  theme === "dark" ? "prose-invert" : "prose-slate"
                )}>
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="flex gap-6 w-full max-w-4xl mx-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0d1117] border-2 border-[#30363d] flex items-center justify-center flex-shrink-0">
                <Bot className="w-6 h-6 text-[#00d4ff]" />
              </div>
              <div className="flex items-center gap-4 px-8 py-5">
                 <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-bounce"></span>
                 </div>
                 <span className="text-xs font-black tracking-[0.2em] text-[#00d4ff] uppercase">Calculating</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={cn(
          "p-6 md:p-12 transition-colors duration-300",
          theme === "dark" ? "bg-[#010409]" : "bg-white"
        )}>
           <div className="max-w-4xl mx-auto relative">
             <form 
              onSubmit={handleSendMessage}
              className={cn(
                "relative flex items-center gap-3 p-3 rounded-[3rem] border-2 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.1)] focus-within:shadow-[#00d4ff]/20",
                theme === "dark" ? "bg-[#0d1117] border-[#30363d] focus-within:border-[#00d4ff]" : "bg-white border-gray-200 focus-within:border-[#00d4ff]"
              )}
             >
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="Initiate command sequence..."
                  className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-4 px-6 min-h-[64px] max-h-56 custom-scrollbar text-lg font-bold placeholder:text-gray-600 placeholder:opacity-50"
                  rows={1}
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-14 h-14 rounded-full transition-all flex items-center justify-center shadow-xl group",
                    input.trim() && !isLoading 
                      ? "bg-[#00d4ff] text-black hover:scale-110 active:scale-95 shadow-[#00d4ff]/40" 
                      : "bg-gray-500/10 text-gray-400 cursor-not-allowed"
                  )}
                >
                  <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
             </form>
             <div className="flex justify-center gap-8 mt-6">
                <p className="text-[10px] font-black tracking-[0.3em] uppercase opacity-20 hover:opacity-100 transition-opacity cursor-default">V-Astra v4.0 // Neural core active</p>
                <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse"></div>
                <p className="text-[10px] font-black tracking-[0.3em] uppercase opacity-20 hover:opacity-100 transition-opacity cursor-default">Autonomous Intelligence</p>
             </div>
           </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? '#30363d' : '#cbd5e1'};
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #00d4ff;
        }
        pre {
          background: #0d1117 !important;
          border: 2px solid #30363d;
          border-radius: 20px;
          padding: 1.5rem !important;
          margin: 2rem 0 !important;
          overflow-x: auto;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
        }
        code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9em;
        }
        .prose p { margin-bottom: 1.5rem; }
        .prose ul, .prose ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
        .prose li { margin-bottom: 0.75rem; }
        .prose h1, .prose h2, .prose h3 { font-weight: 900; margin-top: 2.5rem; margin-bottom: 1.5rem; letter-spacing: -0.05em; }
        .prose a { color: #00d4ff; text-decoration: underline; font-weight: 800; }
        .prose blockquote { border-left: 6px solid #00d4ff; padding-left: 2rem; font-style: italic; color: #64748b; margin: 2rem 0; }
      `}</style>
    </div>
  );
}
