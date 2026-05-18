import { GoogleGenAI } from "@google/genai";

// 🔑 Your valid Google AI Studio API Key from your $300 Mail B account:
const apiKey = "AIzaSyDmd2MEdYMync5FEmwzJVBLm9vh1Z6q9q8";

export const ai = new GoogleGenAI({ apiKey: apiKey });

export const getGeminiResponse = async (prompt: string, history: { role: "user" | "model"; content: string }[] = []) => {
  // Validate if the API Key is set properly
  if (!apiKey || apiKey === "GOOGLE_GENERATIVE_AI_API_KEY") {
    throw new Error("Gemini API Key is missing. Please check your gemini.ts file.");
  }

  // 🤖 Using the exact Gemini 2.5 Flash model
  const model = "gemini-2.5-flash";
  
  // Transform chat history to the format expected by the Google Gen AI SDK
  const contents = history.map(h => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.content }]
  }));

  // Append the current user prompt to the conversation payload
  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        // System Instructions to define V-Astra AI's personality and behavior
        systemInstruction: "You are V-Astra AI, a professional, fast, and responsive chatbot. Your tone is helpful, polite, and technically savvy. You respond with clear, formatted markdown. You represent V-Astra AI, a high-performance AI entity. Keep responses concise but comprehensive.",
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
