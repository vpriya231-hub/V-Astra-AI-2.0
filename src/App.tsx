import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Plus, Menu, X, Send, Trash2, Bot, User as UserIcon, Zap, ExternalLink, Database, Grid3X3, Terminal, Sun, Moon, Settings } from "lucide-react";
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [username, setUsername] = useState("");
  const [tempName, setTempName] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [isNewSession, setIsNewSession] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState<boolean>(true);
  const [isCapabilitiesExpanded, setIsCapabilitiesExpanded] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem("v_astra_sessions");
    const savedTheme = localStorage.getItem("v_astra_theme") as "light" | "dark";
    const savedUsername = localStorage.getItem("v_astra_username") || "";
    const savedWebSearch = localStorage.getItem("v_astra_web_search");
    
    if (savedSessions) setSessions(JSON.parse(savedSessions));
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme("light");
    }

    if (savedWebSearch !== null) {
      setEnableWebSearch(savedWebSearch === "true");
    } else {
      setEnableWebSearch(true);
    }

    if (savedUsername) {
      setUsername(savedUsername);
      setTempName(savedUsername);
      const sessionActive = sessionStorage.getItem("v_astra_session_active");
      if (!sessionActive) {
        setIsNewSession(true);
        sessionStorage.setItem("v_astra_session_active", "true");
      }
    } else {
      setShowNamePrompt(true);
    }
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

  const handleSaveName = () => {
    if (tempName.trim()) {
      const name = tempName.trim();
      localStorage.setItem("v_astra_username", name);
      setUsername(name);
      setIsNewSession(false);
      setIsSettingsOpen(false);
    }
  };

  const handleDeleteName = () => {
    localStorage.removeItem("v_astra_username");
    setUsername("");
    setTempName("");
    setIsNewSession(false);
    setIsSettingsOpen(false);
    setShowNamePrompt(true);
  };

  const getTimeBasedGreeting = (name: string) => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return `Good Morning ${name}`;
    } else if (hour >= 12 && hour < 17) {
      return `Good Afternoon ${name}`;
    } else if (hour >= 17 && hour < 22) {
      return `Good Evening ${name}`;
    } else {
      return `Good Night ${name}`;
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
      const aiResponse = await getGeminiResponse(userMessage, history, enableWebSearch);

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

  return (
    <div className={cn(
      "flex h-screen overflow-hidden font-sans selection:bg-[#00d4ff]/30 transition-colors duration-500",
      theme === "dark" ? "text-white" : "text-black"
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

        {/* Settings button in the side menu */}
        <div className={cn(
          "p-6 border-t",
          theme === "dark" ? "border-white/10 bg-white/[0.02]" : "border-black/5 bg-black/[0.01]"
        )}>
          <button 
            onClick={() => {
              setTempName(username);
              setIsSettingsOpen(true);
            }}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left shadow-sm group",
              theme === "dark" 
                ? "bg-white/[0.03] border-white/10 hover:bg-white/[0.08]" 
                : "bg-black/[0.02] border-black/5 hover:bg-black/[0.05]"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:rotate-45 duration-300",
              theme === "dark" ? "bg-[#00d4ff]/10 text-[#00d4ff]" : "bg-[#1c32c4]/10 text-[#1c32c4]"
            )}>
              <Settings className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm">Settings</span>
          </button>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        <header className={cn(
          "h-20 border-b flex items-center px-8 justify-between glass sticky top-0 z-10 animate-in fade-in slide-in-from-top-4 duration-700",
          theme === "dark" ? "border-white/10" : "border-black/5"
        )}>
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(true)} className={cn("p-3 rounded-2xl hover:bg-black/5 transition-colors", isSidebarOpen && "md:hidden")}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className={cn(
              "text-lg font-black tracking-tight",
              theme === "dark" ? "text-white" : "text-black"
            )}>
              {username ? (isNewSession ? `${username} Returns!` : getTimeBasedGreeting(username)) : ""}
            </h2>
          </div>
          <div className="flex items-center gap-3">
             {/* Theme toggle moved to Settings menu */}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar space-y-12">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-12 max-w-4xl mx-auto py-20">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative"
              >
                <div className={cn(
                  "absolute inset-0 blur-[100px] opacity-20 rounded-full animate-pulse",
                  theme === "dark" ? "bg-[#00d4ff]" : "bg-[#1c32c4]"
                )} />
                <div className={cn(
                  "w-32 h-32 rounded-[40px] glass-card flex items-center justify-center border shadow-2xl relative z-10",
                  theme === "dark" ? "border-white/20" : "border-black/5 bg-white/40"
                )}>
                   <Bot className={cn(
                     "w-16 h-16 drop-shadow-[0_0_15px_rgba(0,212,255,0.8)]",
                     theme === "dark" ? "text-[#00d4ff]" : "text-[#1c32c4]"
                   )} />
                </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-10">
                 {[
                   "Draft a complex technical proposal",
                   "Explain implementation of Q-Learning",
                   "Write a highly performant Rust module",
                   "Architect a decentralized grid system"
                 ].map((suggestion, i) => (
                   <motion.button 
                     key={suggestion}
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: i * 0.1 }}
                     onClick={() => setInput(suggestion)}
                     className={cn(
                       "p-8 text-left glass-card group relative overflow-hidden",
                       theme === "dark" ? "hover:bg-[#00d4ff]/5 hover:border-[#00d4ff]/40" : "bg-white/40 border-black/5 hover:bg-[#00d4ff]/5 hover:border-[#00d4ff]/30 shadow-md"
                     )}
                   >
                     <div className="absolute top-0 right-0 w-32 h-32 bg-[#00d4ff]/5 blur-3xl -mr-16 -mt-16 rounded-full group-hover:bg-[#00d4ff]/10 transition-colors" />
                     <p className={cn(
                       "font-black text-[11px] tracking-[0.3em] uppercase mb-4",
                       theme === "dark" ? "text-[#00d4ff] drop-shadow-[0_0_8px_rgba(0,212,255,0.4)]" : "text-[#1c32c4]"
                     )}>NODE SECURE {i + 1}</p>
                     <p className="font-display font-bold text-lg leading-snug">{suggestion}</p>
                   </motion.button>
                 ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <motion.div 
              key={message.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-8 w-full max-w-5xl mx-auto",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-14 h-14 rounded-[20px] flex items-center justify-center flex-shrink-0 shadow-2xl relative overflow-hidden ring-1",
                message.role === "user" 
                  ? (theme === "dark" ? "bg-gradient-to-br from-[#00d4ff] to-[#1c32c4] ring-white/10" : "bg-gradient-to-br from-[#00d4ff] to-[#1c32c4] ring-black/10 shadow-indigo-500/20") 
                  : (theme === "dark" ? "glass ring-white/5 bg-white/5" : "glass ring-black/5 bg-white/60 shadow-lg")
              )}>
                {message.role === "user" ? <UserIcon className="w-7 h-7 text-white" /> : <Bot className={cn(
                   "w-7 h-7 drop-shadow-[0_0_8px_rgba(0,212,255,0.6)]",
                   theme === "dark" ? "text-[#00d4ff]" : "text-[#1c32c4]"
                )} />}
              </div>
              <div className={cn(
                "flex-1 px-10 py-8 glass-card border shadow-2xl relative",
                message.role === "user" 
                  ? (theme === "dark" 
                      ? "bg-white/[0.08] border-white/10 shadow-[#00d4ff]/5" 
                      : "bg-white/70 border-black/5 shadow-gray-200") 
                  : (theme === "dark"
                      ? "bg-white/[0.03] border-white/5" 
                      : "bg-white/40 border-black/5 shadow-sm")
              )}>
                <div className={cn(
                  "prose max-w-none prose-p:leading-[1.8] prose-p:font-medium",
                  theme === "dark" ? "prose-invert" : "prose-slate"
                )}>
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
                {message.role === "model" && (
                  <div className={cn(
                    "mt-4 pt-4 border-t text-xs font-bold tracking-wide",
                    theme === "dark" ? "border-white/10 text-white opacity-60" : "border-black/5 text-black opacity-60"
                  )}>
                    V-Astra is AI, and can make mistakes
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="flex gap-8 w-full max-w-5xl mx-auto"
            >
              <div className={cn(
                "w-14 h-14 rounded-[20px] glass flex items-center justify-center flex-shrink-0 border",
                theme === "dark" ? "border-white/10 bg-white/5" : "border-black/5 bg-white/60"
              )}>
                <Bot className={cn(
                  "w-7 h-7 animate-pulse",
                  theme === "dark" ? "text-[#00d4ff]" : "text-[#1c32c4]"
                )} />
              </div>
              <div className={cn(
                "flex-1 px-10 py-8 glass-card border flex items-center gap-6 shadow-2xl",
                theme === "dark" ? "bg-white/[0.03] border-white/5" : "bg-white/40 border-black/5 shadow-sm"
              )}>
                 <div className="flex gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full animate-bounce [animation-delay:-0.3s]",
                      theme === "dark" ? "bg-[#00d4ff] shadow-[0_0_15px_rgba(0,212,255,0.8)]" : "bg-[#1c32c4] shadow-lg"
                    )}></div>
                    <div className={cn(
                      "w-3 h-3 rounded-full animate-bounce [animation-delay:-0.15s]",
                      theme === "dark" ? "bg-[#00d4ff] shadow-[0_0_15px_rgba(0,212,255,0.8)]" : "bg-[#1c32c4] shadow-lg"
                    )}></div>
                    <div className={cn(
                      "w-3 h-3 rounded-full animate-bounce",
                      theme === "dark" ? "bg-[#00d4ff] shadow-[0_0_15px_rgba(0,212,255,0.8)]" : "bg-[#1c32c4] shadow-lg"
                    )}></div>
                 </div>
                 <span className={cn(
                   "text-[10px] font-black tracking-[0.5em] uppercase",
                   theme === "dark" ? "text-[#00d4ff]" : "text-[#1c32c4]"
                 )}>Processing Data</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} className="h-32" />
        </div>

        <div className="p-8 md:p-16 relative">
           <div className="max-w-5xl mx-auto">
             <form 
              onSubmit={handleSendMessage}
              className={cn(
                "relative flex items-center gap-4 p-4 glass-input border transition-all shadow-2xl group",
                theme === "dark" ? "border-white/10 bg-black/20 focus-within:border-[#00d4ff]/40" : "border-black/5 bg-white/60 focus-within:border-[#1c32c4]/30"
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
                  className={cn(
                    "flex-1 bg-transparent border-none focus:ring-0 resize-none py-4 px-8 min-h-[64px] max-h-60 custom-scrollbar text-lg font-bold tracking-tight",
                    theme === "dark" ? "text-white placeholder:text-gray-600" : "text-black placeholder:text-gray-400"
                  )}
                  rows={1}
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-16 h-16 rounded-[24px] transition-all flex items-center justify-center shadow-2xl relative overflow-hidden group",
                    input.trim() && !isLoading 
                      ? "bg-gradient-to-br from-[#00d2ff] to-[#1c32c4] text-white hover:scale-105 active:scale-95 shadow-[0_10px_40px_rgba(0,210,255,0.3)] border border-white/20" 
                      : (theme === "dark" ? "bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed opacity-50" : "bg-black/5 text-gray-400 border border-black/5 cursor-not-allowed opacity-50")
                  )}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
                  <Send className="w-7 h-7 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
             </form>
             
             <div className="flex flex-col items-center gap-4 mt-8">
                <p className="text-[9px] font-bold tracking-[0.1em] opacity-40 uppercase text-center px-4">
                  V-Astra is AI, and can make mistakes. Verify critical information.
                </p>
                <div className="flex justify-center gap-10">
                   <p className="text-[10px] font-black tracking-[0.4em] uppercase text-white/20 hover:text-white/40 transition-colors cursor-default">V-Astra v4.1.0 // Matrix v2</p>
                   <div className={cn(
                     "w-1.5 h-1.5 rounded-full animate-pulse",
                     theme === "dark" ? "bg-[#00d4ff] shadow-[0_0_8px_rgba(0,212,255,0.8)]" : "bg-[#1c32c4] shadow-lg"
                   )}></div>
                   <p className="text-[10px] font-black tracking-[0.4em] uppercase text-white/20 hover:text-white/40 transition-colors cursor-default">Autonomous Logic Engine</p>
                </div>
             </div>
           </div>
        </div>
      </main>

      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className={cn(
                "relative w-full max-w-md p-8 rounded-[32px] border glass shadow-2xl z-10 overflow-hidden",
                theme === "dark" ? "border-white/10 bg-neutral-900/90 text-white" : "border-black/5 bg-white/95 text-black"
              )}
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#00d4ff]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#1c32c4]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-8 relative z-10">
                <h3 className="font-display font-black text-2xl tracking-tight">Settings</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    theme === "dark" ? "hover:bg-white/10" : "hover:bg-black/5"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between p-4 rounded-2xl border bg-black/[0.02] border-black/5 dark:bg-white/[0.02] dark:border-white/5">
                  <div>
                     <p className="font-bold text-sm">Theme Mode</p>
                     <p className="text-xs opacity-50">Toggle between Light and Dark themes</p>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className={cn(
                      "p-3 rounded-2xl border transition-all flex items-center gap-2 font-bold text-xs",
                      theme === "dark" 
                        ? "bg-white/[0.05] border-white/10 hover:bg-white/10 text-yellow-400" 
                        : "bg-black/[0.02] border-black/5 hover:bg-black/5 text-indigo-600"
                    )}
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun className="w-4 h-4" />
                        <span>Light Mode</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4" />
                        <span>Dark Mode</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col gap-4 p-5 rounded-2xl border bg-black/[0.02] border-black/5 dark:bg-white/[0.02] dark:border-white/5">
                  <div className="flex items-center justify-between border-b pb-3 border-black/5 dark:border-white/5">
                    <div>
                      <p className="font-bold text-sm">Name Profile</p>
                      <p className="text-xs opacity-50">Current: <span className="font-black text-[#00d4ff]">{username || "Not set"}</span></p>
                    </div>
                    {username && (
                      <button 
                        onClick={handleDeleteName}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                      >
                        Delete Name
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-bold opacity-60">Edit Name</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        placeholder="Enter new name..."
                        className={cn(
                          "flex-1 px-4 py-2 rounded-xl border text-sm font-bold focus:ring-0 focus:outline-none transition-colors",
                          theme === "dark" 
                            ? "bg-white/[0.05] border-white/10 focus:border-[#00d4ff]/40 text-white" 
                            : "bg-black/[0.02] border-black/5 focus:border-[#1c32c4]/30 text-black"
                        )}
                      />
                      <button 
                        onClick={handleSaveName}
                        className="px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 bg-gradient-to-r from-[#00d4ff] to-[#1c32c4] text-white hover:opacity-90"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 p-5 rounded-2xl border bg-black/[0.02] border-black/5 dark:bg-white/[0.02] dark:border-white/5">
                  <div>
                    <p className="font-bold text-sm">Try our Apps</p>
                    <p className="text-xs opacity-50">Discover more powerful tools from V-Astra</p>
                  </div>
                  
                  <div className="space-y-3">
                    <a 
                      href="https://play.google.com/store/apps/details?id=com.vastra.vtrans" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99]",
                        theme === "dark" 
                          ? "bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/10" 
                          : "bg-black/[0.01] border-black/5 hover:bg-black/[0.03] hover:border-black/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm",
                          theme === "dark" ? "bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20" : "bg-[#1c32c4]/10 text-[#1c32c4] border border-[#1c32c4]/10"
                        )}>
                          VT
                        </div>
                        <div>
                          <p className="font-bold text-xs">V-Trans</p>
                          <p className="text-[10px] opacity-60">Voice & Text Translator</p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 opacity-40 hover:opacity-100" />
                    </a>

                    <div 
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border opacity-70",
                        theme === "dark" 
                          ? "bg-white/[0.01] border-white/5" 
                          : "bg-black/[0.005] border-black/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs",
                          theme === "dark" ? "bg-white/5 text-white/40" : "bg-black/5 text-black/40"
                        )}>
                          VX
                        </div>
                        <div>
                          <p className="font-bold text-xs">Vocalix</p>
                          <p className="text-[10px] opacity-60">Malayalam AI Voice Over</p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                        theme === "dark" ? "bg-white/5 border-white/10 text-white/50" : "bg-black/5 border-black/5 text-black/50"
                      )}>
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col rounded-2xl border bg-black/[0.02] border-black/5 dark:bg-white/[0.02] dark:border-white/5 overflow-hidden">
                  <button 
                    onClick={() => setIsCapabilitiesExpanded(!isCapabilitiesExpanded)}
                    className="flex items-center justify-between p-5 w-full text-left font-bold text-sm transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <div>
                      <p className="font-bold text-sm">Capabilities</p>
                      <p className="text-xs font-normal opacity-50">Manage V-Astra smart services</p>
                    </div>
                    <span className={cn(
                      "text-xs font-bold px-3 py-1 rounded-lg border transition-all",
                      theme === "dark" 
                        ? "bg-white/5 border-white/10 hover:bg-white/10" 
                        : "bg-black/[0.02] border-black/5 hover:bg-black/5"
                    )}>
                      {isCapabilitiesExpanded ? "Hide" : "Configure"}
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isCapabilitiesExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-black/5 dark:border-white/5 p-5 bg-black/[0.01] dark:bg-white/[0.01]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold">Web Search</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = !enableWebSearch;
                              setEnableWebSearch(nextVal);
                              localStorage.setItem("v_astra_web_search", String(nextVal));
                            }}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                              enableWebSearch ? "bg-gradient-to-r from-[#00d4ff] to-[#1c32c4]" : "bg-neutral-300 dark:bg-neutral-700"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
                                enableWebSearch ? "translate-x-6" : "translate-x-1"
                              )}
                            />
                          </button>
                        </div>
                        <p className="text-xs opacity-50 leading-relaxed">
                          V Astra will automatically search the web when it determines it needs current information.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showNamePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
              className={cn(
                "relative w-full max-w-md p-10 rounded-[40px] border shadow-2xl overflow-hidden",
                theme === "dark" ? "border-white/10 bg-neutral-900/90 text-white" : "border-black/5 bg-white/95 text-black"
              )}
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#00d4ff]/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#1c32c4]/20 rounded-full blur-3xl pointer-events-none" />

              <div className="text-center space-y-6 relative z-10">
                <div className={cn(
                  "w-20 h-20 mx-auto rounded-3xl flex items-center justify-center border shadow-xl",
                  theme === "dark" ? "bg-[#00d4ff]/20 border-[#00d4ff]/30" : "bg-[#00d4ff]/10 border-[#1c32c4]/20"
                )}>
                   <Bot className="w-10 h-10 text-[#00d4ff]" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-display font-black text-3xl tracking-tight">Welcome to V-Astra</h3>
                  <p className="text-sm opacity-60 max-w-xs mx-auto">
                    Before we initialize our logic structures, please provide your name.
                  </p>
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (tempName.trim()) {
                      const name = tempName.trim();
                      localStorage.setItem("v_astra_username", name);
                      setUsername(name);
                      setShowNamePrompt(false);
                      sessionStorage.setItem("v_astra_session_active", "true");
                    }
                  }}
                  className="space-y-4"
                >
                  <input 
                    type="text" 
                    required
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Your name..."
                    className={cn(
                      "w-full px-6 py-4 rounded-[20px] border text-lg font-bold focus:ring-0 focus:outline-none transition-colors text-center",
                      theme === "dark" 
                        ? "bg-white/[0.05] border-white/10 focus:border-[#00d4ff]/40 text-white" 
                        : "bg-black/[0.02] border-black/5 focus:border-[#1c32c4]/30 text-black"
                    )}
                    autoFocus
                  />
                  <button 
                    type="submit"
                    className="w-full py-4 rounded-[20px] font-bold text-md tracking-wider bg-gradient-to-r from-[#00d4ff] to-[#1c32c4] text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(0,212,255,0.2)] border border-white/10"
                  >
                    Initialize Interface
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #00d4ff44;
        }
        pre {
          background: ${theme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)'} !important;
          border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
          border-radius: 20px;
          padding: 2rem !important;
          margin: 2rem 0 !important;
          overflow-x: auto;
          box-shadow: ${theme === 'dark' ? 'inset 0 2px 10px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.1)'};
          backdrop-filter: blur(10px);
        }
        code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9em;
          color: ${theme === 'dark' ? '#00d4ff' : '#1c32c4'} !important;
        }
        .prose h1, .prose h2, .prose h3 { font-family: 'Space Grotesk', sans-serif; font-weight: 800; letter-spacing: -0.05em; color: ${theme === 'dark' ? '#ffffff' : '#000000'} !important; }
        .prose p, .prose li, .prose ol, .prose ul { color: ${theme === 'dark' ? '#ffffff' : '#000000'} !important; font-weight: 500; }
        .prose strong { color: ${theme === 'dark' ? '#00d4ff' : '#1c32c4'}; font-weight: 800; }
        .prose blockquote { border-left: 4px solid #1c32c4; background: ${theme === 'dark' ? 'rgba(28, 50, 196, 0.05)' : 'rgba(28, 50, 196, 0.1)'}; padding: 1.5rem 2rem; border-radius: 0 20px 20px 0; color: ${theme === 'dark' ? '#cbd5e1' : '#475569'} !important; }
        .prose ul li::marker { color: ${theme === 'dark' ? '#00d4ff' : '#1c32c4'}; }
      `}</style>
    </div>
  );
}
