
import { CONFIG } from "../config.js";
import crypto from "node:crypto";

function checkKey(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));

  return (
    x.length === y.length &&
    crypto.timingSafeEqual(x, y)
  );
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");

    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  // Check API access key
  const key = req.method === "GET"
    ? req.query.key
    : req.body?.key;

  if (!checkKey(key, CONFIG.API_ACCESS_KEY)) {
    return res.status(401).json({
      success: false,
      error: "Invalid API access key"
    });
  }

  // Get message
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

  if (!CONFIG.GEMINI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "Gemini API key missing"
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
          contents: [
            {
              role: "user",
              parts: [
                { text: message.trim() }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(response.status).json({
        success: false,
        error: data?.error?.message || "Gemini API error",
        status: data?.error?.status || "UNKNOWN",
        code: data?.error?.code || response.status,
        details: data?.error?.details || []
      });
    }

    const answer = (
      data.candidates?.[0]?.content?.parts || []
    )
      .filter(part => typeof part.text === "string")
      .map(part => part.text)
      .join("");

    if (!answer) {
      return res.status(502).json({
        success: false,
        error: "Gemini returned an empty response"
      });
    }

    return res.status(200).json({
      success: true,
      answer,
      model: CONFIG.MODEL
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
}
