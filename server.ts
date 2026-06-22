import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is defined as empty or missing.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// API endpoint for poetic log generation
app.post("/api/generate-poetry", async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    const ai = getGeminiClient();
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const prompt = `Based on this technical user activity in the firefly forest: "${description}", please generate an ambient, poetic reflection in Chinese. Format it like a minimalist log entry of a night walker, focusing on nature, the light of the firefly, and the tactile feeling. Keep it beautiful, atmospheric, and under 80 characters. Do not include any meta text or titles, just return the poetic text directly.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the silent spirit of the firefly forest. You translate raw user actions into atmospheric, highly poetic, sensory-rich Chinese travel logs. Avoid fluff, avoid clichés, focus on the warmth, wetness, shadows, and the gentle brief glow of the fireflies in the deep night.",
      },
    });

    const text = response.text || "萤光微茫，在指尖留下了夜的余温。";
    res.json({ poetry: text.trim().replace(/^["']|["']$/g, '') });
  } catch (error: any) {
    console.error("Gemini API Error:", error.message);
    // Provide an elegant fallback poetry so experience continues offline/without API keys
    const fallbackLogEntries = [
      "指尖轻启，星芒跃出掌心。夜风拂过蕨类植物，空气中弥漫着清凉的水汽与短暂的温暖。",
      "林间无声，那一抹暖黄在树影中黯淡下去，融入深深浅浅的绿。呼吸间皆是泥土的湿润。",
      "握拢是执念，松开是自然。萤火化作草木间的行吟，带着微温，归于沉静的黑夜中。",
      "苔藓潮湿，野露微茫。微弱的生物光闪烁，如同夜空对林深处的温柔耳语。"
    ];
    const randomIndex = Math.floor(Math.random() * fallbackLogEntries.length);
    res.json({ poetry: fallbackLogEntries[randomIndex] });
  }
});

async function startServer() {
  // Vite dev server vs production static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
