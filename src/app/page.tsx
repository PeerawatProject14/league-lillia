import React from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center relative overflow-hidden px-4 selection:bg-purple-600 selection:text-white">
      {/* Decorative background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-900/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-900/20 blur-[150px] pointer-events-none" />
      
      {/* Outer border container */}
      <div className="relative w-full max-w-2xl bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 md:p-12 shadow-2xl transition-all duration-300 hover:border-zinc-700/80">
        
        {/* Top Status Header */}
        <div className="flex justify-between items-center mb-10 border-b border-zinc-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-bold text-xl tracking-wider text-white shadow-lg shadow-purple-500/20">
              L
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                LoL Buddy
              </h1>
              <p className="text-xs text-zinc-500 font-mono">v1.0.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-full font-semibold font-mono animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            BOT READY
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-6 mb-10">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
            ระบบบอทช่วยเหลือ League of Legends ของคุณเปิดใช้งานแล้ว! 🚀
          </h2>
          <p className="text-zinc-400 leading-relaxed">
            นี่คือแอปพลิเคชัน Discord Bot ในระบบ Serverless ที่รันอยู่บน Vercel 
            ตัวบอทจะเชื่อมต่อเข้ากับ **Riot Games API** และ **Gemini AI** เพื่อวิเคราะห์ข้อมูลและให้คำแนะนำผู้เล่นโดยตรงบน Discord
          </p>

          <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-purple-400 tracking-wider uppercase">
              🎮 คำสั่งบอทที่พร้อมใช้งาน
            </h3>
            
            <ul className="space-y-3 font-mono text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-purple-500">/profile</span>
                <span className="text-zinc-500">-</span>
                <span>ดูอันดับแรงค์ อัตราการชนะ และข้อมูลทั่วไปของผู้เล่นพร้อมปุ่มเมนูโต้ตอบ</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">/coach</span>
                <span className="text-zinc-500">-</span>
                <span>ดึงสถิติ 5 เกมล่าสุดและให้ AI Coach วิเคราะห์จุดเด่นจุดด้อยเป็นภาษาไทย</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">/livegame</span>
                <span className="text-zinc-500">-</span>
                <span>ส่องสถานะแมตช์ที่กำลังเล่นอยู่แบบเรียลไทม์ พร้อมรายชื่อเพื่อนและศัตรู</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center text-xs text-zinc-500 border-t border-zinc-800/80 pt-6">
          <p className="font-mono text-center sm:text-left">
            Interactions Endpoint: <code className="text-zinc-400">/api/interactions</code>
          </p>
          <a
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors font-semibold flex items-center gap-1 group"
          >
            ตั้งค่าบน Discord Developer Portal
            <span className="inline-block transform transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>

      </div>
      
      {/* Copyright branding */}
      <footer className="mt-8 text-xs text-zinc-600 font-mono">
        LoL Buddy is not endorsed by Riot Games. Built by Antigravity.
      </footer>
    </div>
  );
}
