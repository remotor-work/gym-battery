/**
 * fix_images4.js — Final 7 failures from run 3
 * Run: node fix_images4.js
 *
 * All URLs verified 200 before inclusion.
 * Substitutes used where exact exercise GIF not available on site.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, 'assets', 'img', 'exercises');

const FINAL_URLS = {
  // Flat dumbbell press — site renamed file to Dumbbell-Press-1.gif
  'chest-flat-dumbbell':        'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Press-1.gif',
  // Neutral-grip flat press — no exact GIF; use alternate dumbbell press
  'chest-flat-neutral':         'https://fitnessprogramer.com/wp-content/uploads/2021/09/Alternate-Dumbbell-Bench-Press.gif',
  // Cable chest press — original URL gone; seated cable press confirmed 200
  'chest-flat-cable':           'https://fitnessprogramer.com/wp-content/uploads/2022/02/Seated-Cable-Chest-Press.gif',
  // Behind-neck pulldown — exact GIF not on site; Cable Rear Pulldown confirmed 200
  'back-pulldown-behind-neck':  'https://fitnessprogramer.com/wp-content/uploads/2021/08/Cable-Rear-Pulldown.gif',
  'back-pulldown-machine-behind':'https://fitnessprogramer.com/wp-content/uploads/2021/08/Cable-Rear-Pulldown.gif',
  // Reverse preacher curl — no exact GIF on site; cable reverse EZ-bar curl confirmed 200
  'bi-curl-reverse-preacher':   'https://fitnessprogramer.com/wp-content/uploads/2022/02/Cable-Reverse-Grip-EZ-bar-Biceps-Curl.gif',
  // Single-leg RDL — exact GIF not on site; dumbbell RDL confirmed 200
  'legs-rdl-single':            'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Romanian-Deadlift.gif',
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ keepAlive: false });
    const req = https.get(url, {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer':    'https://fitnessprogramer.com/',
        'Connection': 'close',
      },
      timeout: 20000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadGif(key, url, attempt) {
  const outPath = path.join(OUT_DIR, key + '.gif');
  try {
    process.stdout.write(`  [${attempt}] ${key} ← ${url.split('/').pop()} ... `);
    const buf = await fetchUrl(url);
    if (buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46) {
      console.log(`✗ (not a GIF)`);
      return false;
    }
    fs.writeFileSync(outPath, buf);
    console.log(`✓ (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) {
    console.log(`✗ (${e.message})`);
    return false;
  }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const keys = Object.keys(FINAL_URLS);
  console.log(`\nFinal pass: ${keys.length} exercises...\n`);

  await delay(500);

  const results = { ok: [], fail: [] };

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = FINAL_URLS[key];
    const ok = await downloadGif(key, url, `${i+1}/${keys.length}`);
    if (ok) results.ok.push(key);
    else results.fail.push({ key, url });
    await delay(300);
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✓ Success: ${results.ok.length}`);
  console.log(`✗ Failed:  ${results.fail.length}`);

  if (results.fail.length > 0) {
    console.log('\nStill failing:');
    results.fail.forEach(({ key, url }) => console.log(`  ${key}: ${url}`));
  }

  // Update audit report
  const reportPath = path.join(__dirname, 'image_audit_report.json');
  let prev = { downloaded: [], failed: [] };
  try { prev = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch {}

  const newDownloaded = [...new Set([...prev.downloaded, ...results.ok])];
  const newFailed = prev.failed.filter(k => !results.ok.includes(k));
  results.fail.forEach(({ key }) => { if (!newFailed.includes(key)) newFailed.push(key); });

  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    downloaded: newDownloaded,
    failed: newFailed,
  }, null, 2));
  console.log('\nReport updated: image_audit_report.json');

  // Final tally
  const total = newDownloaded.length + newFailed.length;
  console.log(`\nFINAL: ${newDownloaded.length}/${total} exercises have GIFs`);
}

main().catch(console.error);
