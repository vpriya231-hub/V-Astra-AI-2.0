// 🔑 Your valid Google AI Studio API Key
const apiKey = "AIzaSyDmd2MEdYMync5FEmwzJVBLm9vh1Z6q9q8";

export const getGeminiResponse = async (prompt: string, history: { role: string; content: string }[] = []) => {
  if (!apiKey || apiKey === "GOOGLE_GENERATIVE_AI_API_KEY") {
    throw new Error("Gemini API Key is missing. Please check your gemini.ts file.");
  }

  // 🌐 Correct endpoint structure for the official Google Gemini API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // 💬 Transform chat history array into the exact format Gemini API expects
  const contents = history.map(h => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.content }]
  }));

  // Append the current user prompt to the contents array
  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  try {
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
      console.error("Google API Response Error:", errorData);
      throw new Error(`Google API responded with status ${response.status}`);
    }

    const data = await response.json();
    
    // Safety check to ensure valid response structure from Google
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.error("Unexpected API structure:", data);
      return "System error: Received empty response from intelligence node.";
    }

  } catch (error) {
    console.error("Gemini API Direct Fetch Error:", error);
    return "Connection interrupted. Please verify configuration and retry.";
  }
};

