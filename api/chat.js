// api/chat.js - Daily 15 Message Limit + 2.5 Flash
import { GoogleGenerativeAI } from "@google/generative-ai";

const FREE_DAILY_LIMIT = 15;
const REWARD_BONUS = 5;
const MAX_OUTPUT_TOKENS = 500;

const userLimits = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method!== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { userId, message, watchAd } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const today = new Date().toISOString().split('T')[0];
    const userKey = `${userId}_${today}`;
    let userData = userLimits.get(userKey) || { count: 0, bonusCount: 0 };

    if (watchAd === true) {
      userData.bonusCount += REWARD_BONUS;
      userLimits.set(userKey, userData);
      const newTotal = FREE_DAILY_LIMIT + userData.bonusCount;
      return res.status(200).json({
        success: true,
        type: 'ad_reward',
        message: `+${REWARD_BONUS} Messages Added! 🎉`,
        remaining: newTotal - userData.count,
        totalLimit: newTotal
      });
    }

    const totalLimit = FREE_DAILY_LIMIT + userData.bonusCount;
    if (userData.count >= totalLimit) {
      return res.status(429).json({
        success: false,
        error: 'Daily limit reached',
        message: `Daily Limit: ${userData.count}/${totalLimit} Used ✅`,
        remaining: 0,
        canWatchAd: true,
        resetTime: 'Tomorrow 12:00 AM'
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.9 },
      systemInstruction: "You are Vastra AI. Reply in Malayalam. Be friendly and helpful."
    });

    const result = await model.generateContent(message);
    const text = result.response.text();

    userData.count += 1;
    userLimits.set(userKey, userData);

    return res.status(200).json({
      success: true,
      reply: text,
      remaining: totalLimit - userData.count,
      used: userData.count,
      limit: totalLimit,
      model: 'gemini-2.5-flash'
    });

  } catch (error) {
    console.error('Gemini Error:', error);
    return res.status(500).json({ error: 'Server busy', message: 'Try again after 1 minute' });
  }
}
