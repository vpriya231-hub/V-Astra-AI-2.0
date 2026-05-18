// 🔑 Your valid Google AI Studio API Key from Mail B
const apiKey = "AIzaSyDmd2MEdYMync5FEmwzJVBLm9vh1Z6q9q8";

export const getGeminiResponse = async (prompt: string, history: { role: "user" | "model"; content: string }[] = []) => {
  if (!apiKey || apiKey === "GOOGLE_GENERATIVE_AI_API_KEY") {
    throw new Error("Gemini API Key is missing. Please check your gemini.ts file.");
  }

  // 🤖 Using the exact Gemini 2.5 Flash API endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // Formatting history into standard Google REST API format
  const contents = history.map(h => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.content }]
  }));

  // Append the current message
  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  try {
    // Direct fetch call to Google API with corrected Content-Type header
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: "You are V-Astra AI, a professional, fast, and responsive chatbot. Your tone is helpful, polite, and technically savvy. You respond with clear, formatted markdown. You represent V-Astra AI, a high-performance AI entity. Keep responses concise but comprehensive." }]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error Details:", errorData);
      throw new Error(`Google API responded with status ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("Gemini API Direct Fetch Error:", error);
    throw error;
  }
};
