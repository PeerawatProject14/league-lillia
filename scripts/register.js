const fs = require("fs");
const path = require("path");

// Load .env.local manually
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
    console.log("✅ Loaded environment variables from .env.local");
  } else {
    console.warn("⚠️ .env.local file not found.");
  }
} catch (e) {
  console.error("❌ Failed to parse .env.local:", e.message);
}

const appId = process.env.DISCORD_APP_ID;
const botToken = process.env.DISCORD_TOKEN;

if (!appId || !botToken) {
  console.error("❌ Error: DISCORD_APP_ID or DISCORD_TOKEN is missing in .env.local");
  process.exit(1);
}

const commands = [
  {
    name: "profile",
    description: "ดูสถิติและโปรไฟล์ LoL (Rank, Win Rate, Champion Mastery)",
    options: [
      {
        type: 3, // STRING
        name: "summoner",
        description: "ชื่อในเกม#แท็กสั้น เช่น Name#Tag (เช่น Faker#KR1)",
        required: true,
      },
    ],
  },
  {
    name: "coach",
    description: "วิเคราะห์การเล่น 5 เกมล่าสุด และรับบทเรียนจากโค้ช AI ส่วนตัว",
    options: [
      {
        type: 3, // STRING
        name: "summoner",
        description: "ชื่อในเกม#แท็กสั้น เช่น Name#Tag",
        required: true,
      },
    ],
  },
  {
    name: "livegame",
    description: "เช็คสถานะการเล่นสดว่าผู้เล่นกำลังสู้กับทีมตรงข้ามและใช้แชมป์อะไรอยู่",
    options: [
      {
        type: 3, // STRING
        name: "summoner",
        description: "ชื่อในเกม#แท็กสั้น เช่น Name#Tag",
        required: true,
      },
    ],
  },
  {
    name: "history",
    description: "ดูประวัติการเล่น 10 เกมล่าสุดของผู้เล่น",
    options: [
      {
        type: 3, // STRING
        name: "summoner",
        description: "ชื่อในเกม#แท็กสั้น เช่น Name#Tag",
        required: true,
      },
    ],
  },
  {
    name: "build",
    description: "แนะนำไอเทม รูน ลำดับสกิล และการเล่นสำหรับแชมเปี้ยน",
    options: [
      {
        type: 3, // STRING
        name: "champion",
        description: "ชื่อแชมเปี้ยนที่ต้องการ เช่น Aatrox, Wukong, Lucian, ยาซูโอะ",
        required: true,
      },
    ],
  },
  {
    name: "buildvs",
    description: "แนะนำการลงของแบบ matchup เฉพาะคู่ (เล่นตัวนี้ vs เจอตัวนั้น)",
    options: [
      {
        type: 3, // STRING
        name: "champion",
        description: "แชมเปี้ยนที่คุณเล่น เช่น Yasuo, ยาซูโอะ",
        required: true,
      },
      {
        type: 3, // STRING
        name: "vs",
        description: "แชมเปี้ยนคู่ต่อสู้ที่ต้องการเคาน์เตอร์ เช่น Zed, เซด",
        required: true,
      },
    ],
  },
  {
    name: "tier",
    description: "ดู tier list ของ role ที่เลือก (Master+ จาก u.gg)",
    options: [
      {
        type: 3, // STRING
        name: "role",
        description: "ตำแหน่งที่ต้องการดู",
        required: true,
        choices: [
          { name: "Top", value: "top" },
          { name: "Jungle", value: "jungle" },
          { name: "Mid", value: "mid" },
          { name: "ADC / Bot", value: "adc" },
          { name: "Support", value: "support" },
        ],
      },
    ],
  },
];

async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${appId}/commands`;
  
  console.log(`🌐 Registering slash commands with Discord API...`);
  
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(commands),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`🎉 Successfully registered ${data.length} commands:`);
      data.forEach((cmd) => console.log(` - /${cmd.name} (ID: ${cmd.id})`));
    } else {
      const errText = await res.text();
      console.error(`❌ Failed to register commands: ${res.status} - ${errText}`);
    }
  } catch (error) {
    console.error(`❌ Error connecting to Discord API:`, error);
  }
}

registerCommands();
