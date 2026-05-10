import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDocs,
  Timestamp
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType } from "./lib/firebase";
import { getGeminiResponse } from "./lib/gemini";
import { MessageCircle, Plus, LogOut, Menu, X, Moon, Sun, Send, Trash2, Bot, User as UserIcon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "model";
  timestamp: any;
}

interface ChatSession {
  id: string;
  title: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth State
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Load user theme preference
        try {
          const userDoc = await getDocs(query(collection(db, "users"), where("__name__", "==", u.uid)));
          if (!userDoc.empty) {
            const data = userDoc.docs[0].data();
            if (data.themePreference) {
              setTheme(data.themePreference as "dark" | "light");
            }
          } else {
            // Initialize user profile correctly with uid as document id
            const { setDoc } = await import("firebase/firestore");
            await setDoc(doc(db, "users", u.uid), {
              displayName: u.displayName || "",
              photoURL: u.photoURL || "",
              themePreference: theme
            });
          }
        } catch (error) {
           console.error("Error loading user profile:", error);
        }
      } else {
        setSessions([]);
        setMessages([]);
        setCurrentSessionId(null);
      }
    });
  }, []);

  // Fetch Sessions
  useEffect(() => {
    if (!user) return;

    setIsHistoryLoading(true);
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ChatSession[];
      setSessions(sessionList);
      setIsHistoryLoading(false);
    }, (error) => {
       // Only handle if it's not a race condition on logout
       if (auth.currentUser) {
         handleFirestoreError(error, OperationType.LIST, "sessions");
       }
    });

    return unsubscribe;
  }, [user]);

  // Fetch Messages for current session
  useEffect(() => {
    if (!currentSessionId || !user) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "sessions", currentSessionId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ChatMessage[];
      setMessages(messageList);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, `sessions/${currentSessionId}/messages`);
      }
    });

    return unsubscribe;
  }, [currentSessionId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createNewSession = async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, "sessions"), {
        title: "New Chat",
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCurrentSessionId(docRef.id);
      setInput("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "sessions");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const docRef = await addDoc(collection(db, "sessions"), {
          title: input.slice(0, 30) + (input.length > 30 ? "..." : ""),
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        sessionId = docRef.id;
        setCurrentSessionId(sessionId);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "sessions");
        return;
      }
    }

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // 1. Add User Message
      try {
        await addDoc(collection(db, "sessions", sessionId, "messages"), {
          content: userMessage,
          role: "user",
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `sessions/${sessionId}/messages`);
      }

      // 2. Get Gemini Response
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const aiResponse = await getGeminiResponse(userMessage, history);

      // 3. Add AI Message
      try {
        await addDoc(collection(db, "sessions", sessionId, "messages"), {
          content: aiResponse || "Sorry, I couldn't process that.",
          role: "model",
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `sessions/${sessionId}/messages`);
      }

      // 4. Update Session updatedAt and optionally title
      try {
        const updateData: any = {
          updatedAt: serverTimestamp()
        };
        
        // If this is the start of a conversation, update the title
        if (messages.length === 0) {
          updateData.title = userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "");
        }

        await updateDoc(doc(db, "sessions", sessionId), updateData);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
      }

    } catch (error) {
      console.error("Error in chat flow:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        // We use setDoc with merge: true to ensure the document exists
        const { setDoc } = await import("firebase/firestore");
        await setDoc(userRef, { themePreference: newTheme }, { merge: true });
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    }
  };

  if (!user) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4 transition-colors duration-300",
        theme === "dark" ? "bg-[#010409] text-white" : "bg-gray-50 text-gray-900"
      )}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "max-w-md w-full p-8 rounded-2xl shadow-2xl border flex flex-col items-center text-center",
            theme === "dark" ? "bg-[#0d1117] border-[#30363d]" : "bg-white border-gray-200"
          )}
        >
          <div className="w-16 h-16 bg-[#00d4ff]/10 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,212,255,0.2)]">
            <Bot className="w-10 h-10 text-[#00d4ff]" />
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">V-Astra AI</h1>
          <p className={cn(
            "mb-8",
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          )}>
            The fast and professional AI companion for your daily needs.
          </p>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-3 px-4 bg-white text-black font-semibold rounded-lg flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-lg"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/hf/google.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
          
          <div className="mt-8 flex items-center gap-4">
             <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-500/10 transition-colors">
                {theme === "dark" ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
             </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex h-screen overflow-hidden transition-colors duration-300 font-sans",
      theme === "dark" ? "bg-[#010409] text-gray-100" : "bg-white text-gray-900"
    )}>
      {/* Sidebar Overlay for Mobile */}
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

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? "280px" : "0px",
          x: isSidebarOpen ? 0 : -280
        }}
        className={cn(
          "fixed md:relative z-30 h-full flex flex-col border-r overflow-hidden transition-colors duration-300",
          theme === "dark" ? "bg-[#0d1117] border-[#30363d]" : "bg-gray-50 border-gray-200"
        )}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#00d4ff]" />
            <span className="font-bold text-lg tracking-tight">V-Astra AI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <button 
          onClick={createNewSession}
          className="mx-4 mb-4 mt-2 flex items-center gap-2 p-3 border rounded-lg hover:bg-[#00d4ff]/10 hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all group"
          style={{ borderColor: theme === "dark" ? "#30363d" : "#e5e7eb" }}
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          {isHistoryLoading ? (
             <div className="flex justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
             </div>
          ) : sessions.map((session) => (
            <button 
              key={session.id}
              onClick={() => {
                setCurrentSessionId(session.id);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all relative group",
                currentSessionId === session.id 
                  ? (theme === "dark" ? "bg-[#161b22] text-[#00d4ff] border-r-2 border-[#00d4ff]" : "bg-white text-[#00d4ff] shadow-sm border-r-2 border-[#00d4ff]")
                  : (theme === "dark" ? "hover:bg-[#161b22]" : "hover:bg-gray-200")
              )}
            >
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate text-sm font-medium">{session.title}</span>
            </button>
          ))}
        </div>

        <div className={cn(
          "p-4 border-t",
          theme === "dark" ? "border-[#30363d]" : "border-gray-200"
        )}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00d4ff]/20 flex items-center justify-center overflow-hidden">
               {user.photoURL ? <img src={user.photoURL} alt="User" /> : <UserIcon className="w-5 h-5 text-[#00d4ff]" />}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-sm font-medium truncate">{user.displayName || "User"}</p>
            </div>
            <button onClick={() => auth.signOut()} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
             <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-500/10 transition-colors flex items-center gap-2 text-sm font-medium">
                {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
             </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative h-full">
        {/* Header */}
        <header className={cn(
          "h-14 border-b flex items-center px-4 justify-between transition-colors duration-300 sticky top-0 z-10",
          theme === "dark" ? "bg-[#010409]/80 border-[#30363d] backdrop-blur-md" : "bg-white/80 border-gray-200 backdrop-blur-md"
        )}>
          <button onClick={() => setIsSidebarOpen(true)} className={cn("p-2 rounded-lg hover:bg-gray-500/10", isSidebarOpen && "md:hidden")}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 px-4 flex justify-center">
             <h2 className="text-sm font-semibold truncate max-w-xs">
                {sessions.find(s => s.id === currentSessionId)?.title || "V-Astra Chat"}
             </h2>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 rounded-3xl bg-[#00d4ff]/10 flex items-center justify-center shadow-[0_0_30px_rgba(0,212,255,0.15)] bg-gradient-to-br from-[#00d4ff]/20 to-transparent"
              >
                <Bot className="w-12 h-12 text-[#00d4ff]" />
              </motion.div>
              <div className="max-w-md">
                <h3 className="text-2xl font-bold mb-2">Welcome to V-Astra AI</h3>
                <p className={cn(
                  "text-lg",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}>
                  I'm your professional assistant. How can I help you excel today?
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                 {[
                   "Write a professional email",
                   "Explain quantum computing",
                   "Help me debug this code",
                   "Plan a week-long trip"
                 ].map((suggestion) => (
                   <button 
                     key={suggestion}
                     onClick={() => setInput(suggestion)}
                     className={cn(
                       "p-4 text-left rounded-xl border hover:border-[#00d4ff] hover:bg-[#00d4ff]/5 transition-all transition-duration-300",
                       theme === "dark" ? "bg-[#0d1117] border-[#30363d]" : "bg-gray-50 border-gray-200"
                     )}
                   >
                     {suggestion}
                   </button>
                 ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <motion.div 
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 w-full max-w-4xl mx-auto",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
                message.role === "user" ? "bg-indigo-600" : "bg-[#00d4ff]/20"
              )}>
                {message.role === "user" ? <UserIcon className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-[#00d4ff]" />}
              </div>
              <div className={cn(
                "flex-1 px-4 py-3 rounded-2xl overflow-hidden",
                message.role === "user" 
                  ? (theme === "dark" ? "bg-[#161b22] border border-[#30363d]" : "bg-indigo-50 border border-indigo-100") 
                  : (theme === "dark" ? "bg-transparent" : "bg-transparent")
              )}>
                <div className={cn(
                  "prose prose-sm max-w-none leading-relaxed",
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
               className="flex gap-4 w-full max-w-4xl mx-auto"
            >
              <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <div className="flex items-center gap-2 px-4 py-3">
                 <Loader2 className="w-4 h-4 animate-spin text-[#00d4ff]" />
                 <span className="text-sm italic text-gray-500">V-Astra is thinking...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={cn(
          "p-4 md:p-6 border-t transition-colors duration-300",
          theme === "dark" ? "bg-[#010409] border-[#30363d]" : "bg-white border-gray-200"
        )}>
           <form 
            onSubmit={handleSendMessage}
            className={cn(
              "max-w-4xl mx-auto relative flex items-center gap-2 p-2 rounded-2xl border transition-all shadow-lg focus-within:ring-2 ring-[#00d4ff]/20",
              theme === "dark" ? "bg-[#0d1117] border-[#30363d]" : "bg-gray-50 border-gray-200"
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
                placeholder="Message V-Astra AI..."
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 px-3 min-h-[44px] max-h-40 custom-scrollbar text-sm md:text-base"
                rows={1}
              />
              <button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-3 rounded-xl transition-all shadow-md group",
                  input.trim() && !isLoading 
                    ? "bg-[#00d4ff] text-black hover:scale-105 active:scale-95" 
                    : "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                )}
              >
                <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
           </form>
           <p className={cn(
            "text-[10px] text-center mt-3",
            theme === "dark" ? "text-gray-500" : "text-gray-400"
           )}>
             V-Astra AI can make mistakes. Verify important info.
           </p>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? '#30363d' : '#e5e7eb'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #00d4ff;
        }
        pre {
          background: #0d1117 !important;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 1rem !important;
          margin: 1rem 0 !important;
          overflow-x: auto;
        }
        code {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.9em;
        }
        .prose p { margin-bottom: 1rem; }
        .prose ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
        .prose ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
        .prose li { margin-bottom: 0.5rem; }
        .prose h1, .prose h2, .prose h3 { font-weight: bold; margin-top: 1.5rem; margin-bottom: 1rem; }
        .prose a { color: #00d4ff; text-decoration: underline; }
        .prose blockquote { border-left: 4px solid #30363d; padding-left: 1rem; font-style: italic; color: #8b949e; }
      `}</style>
    </div>
  );
}
