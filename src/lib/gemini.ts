import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined. AI features will not work.");
}

export const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const getGeminiResponse = async (
  prompt: string, 
  history: { role: "user" | "model"; content: string }[] = [],
  enableSearch: boolean = false
) => {
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please check your environment variables.");
  }

  const model = "gemini-3.5-flash";
  
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
    const config: any = {
      systemInstruction: "You are V-Astra AI, a professional, fast, and responsive chatbot. Your tone is helpful, polite, and technically savvy. You respond with clear, formatted markdown. You represent V-Astra AI, a high-performance AI entity. Keep responses concise but comprehensive.",
    };

    if (enableSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
