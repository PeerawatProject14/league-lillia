const { Jimp } = require("jimp");

async function runTest() {
  try {
    const img = new Jimp({ width: 100, height: 100, color: 0x111217ff });
    console.log("Resizing with positional args (48, 48)...");
    try {
      img.resize(48, 48);
      console.log("Positional args worked!");
    } catch (e) {
      console.error("Positional args failed:", e.message || e);
    }

    console.log("Resizing with object { w: 48, h: 48 }...");
    try {
      img.resize({ w: 48, h: 48 });
      console.log("Object with w/h worked!");
    } catch (e) {
      console.error("Object with w/h failed:", e.message || e);
    }
  } catch (e) {
    console.error("Setup failed:", e);
  }
}

runTest();
