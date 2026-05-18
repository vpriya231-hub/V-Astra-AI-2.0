const apiKey = "AIzaSyDmd2MEdYMync5FEmwzJVBLm9vh1Z6q9q8";

export const getGeminiResponse = async (prompt: string, history: { role: string; content: string }[] = []) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const contents = history.map(h => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.content }]
  }));

  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: "You are V-Astra AI, a professional and responsive chatbot." }]
        }
      })
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error:", error);
    return "Sorry, please try again.";
  }
};
