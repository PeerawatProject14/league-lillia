const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

try {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const envFileContent = fs.readFileSync(envPath, "utf-8");
    envFileContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const firstEq = trimmed.indexOf("=");
      if (firstEq === -1) return;
      const key = trimmed.substring(0, firstEq).trim();
      const val = trimmed.substring(firstEq + 1).trim().replace(/^['"]|['"]$/g, "");
      process.env[key] = val;
    });
  }
} catch (e) {
  console.error(e);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function test() {
  console.log("Gemini API Key:", GEMINI_API_KEY ? `${GEMINI_API_KEY.slice(0, 5)}...` : "undefined");
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Available Models:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

test();
