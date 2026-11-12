
import { CONFIG } from "../config.js";
import crypto from "node:crypto";

function checkKey(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const key = req.method === "GET"
    ? req.query.key
    : req.body?.key;

  if (!checkKey(key, CONFIG.API_ACCESS_KEY)) {
    return res.status(401).json({
      success: false,
      error: "Invalid API key"
    });
  }

  const message = req.method === "GET"
    ? req.query.message
    : req.body?.message;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: "Message is required"
    });
  }

  if (message.length > 8000) {
    return res.status(413).json({
      success: false,
      error: "Message too long"
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": CONFIG.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: message.trim() }]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || "Gemini API error"
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("") || "";

    return res.status(200).json({
      success: true,
      answer,
      model: CONFIG.MODEL
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
}
