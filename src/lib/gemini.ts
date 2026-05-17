import { GoogleGenAI } from "@google/genai";

// 🔑 Paste your valid Google AI Studio API Key here:
const apiKey = "GOOGLE_GENERATIVE_AI_API_KEY";

export const ai = new GoogleGenAI({ apiKey: apiKey });

export const getGeminiResponse = async (prompt: string, history: { role: "user" | "model"; content: string }[] = []) => {
  if (!apiKey || apiKey === "YOUR_ACTUAL_API_KEY_HERE") {
    throw new Error("Gemini API Key is missing. Please check your gemini.ts file.");
  }

  // 🤖 Using the exact Gemini 2.5 Flash model
  const model = "gemini-2.5-flash";
  
  // Transform history to model-expected format
  const contents = history.map(h => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.content }]
  }));

  // Add the current prompt
  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: "You are V-Astra AI, a professional, fast, and responsive chatbot. Your tone is helpful, polite, and technically savvy. You respond with clear, formatted markdown. You represent V-Astra AI, a high-performance AI entity. Keep responses concise but comprehensive.",
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
