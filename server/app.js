import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import farmingPrompt from "./farmingPrompt.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/farming", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ reply: "❌ Message required" });
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000",
          "X-Title": process.env.SITE_TITLE || "CropGuard AI",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1-0528",
          messages: [
            { role: "system", content: farmingPrompt },
            { role: "user", content: userMessage }
          ],
          temperature: 0.4,
          max_tokens: 800
        })
      }
    );

    const data = await response.json();

    const reply = data?.choices?.[0]?.message?.content;

    res.json({
      reply: reply || "⚠ AI se valid response nahi mila"
    });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ reply: "⚠ Server Error" });
  }
});

app.listen(3000, () =>
  console.log("🚀 CropGuard Backend Running: http://localhost:3000")
);
