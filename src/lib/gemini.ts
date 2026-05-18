import { GoogleGenAI } from "@google/genai";

// 🔑 Your valid Google AI Studio API Key
const apiKey = "AIzaSyDmd2MEdYMync5FEmwzJVBLm9vh1Z6q9q8";

export const ai = new GoogleGenAI({ apiKey: apiKey });

export const getGeminiResponse = async (prompt: string, history: { role: "user" | "model"; content: string }[] = []) => {
  if (!apiKey || apiKey === "GOOGLE_GENERATIVE_AI_API_KEY") {
    throw new Error("Gemini API Key is missing. Please check your gemini.ts file.");
  }

  // 🤖 Using the exact Gemini 2.5 Flash model
  const model = "gemini-2.5-flash";
  
  try {
    // 💬 Properly formatting history into the exact structure Gemini SDK expects
    const formattedHistory = history.map(h => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }]
    }));

    // 🚀 Utilizing the official chat session method to handle multi-turn conversations without breaking
    const chat = ai.chats.create({
      model: model,
      history: formattedHistory,
      config: {
        systemInstruction: "You are V-Astra AI, a professional, fast, and responsive chatbot. Your tone is helpful, polite, and technically savvy. You respond with clear, formatted markdown. You represent V-Astra AI, a high-performance AI entity. Keep responses concise but comprehensive.",
      }
    });

    const response = await chat.sendMessage({
      message: prompt
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Chat Error:", error);
    throw error;
  }
};
