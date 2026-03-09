/**
 * fix_images3.js — Retry for 46 failed exercises from run 2
 * Run: node fix_images3.js
 *
 * Fixes:
 *  - 18 EACCES (CDN IP blocked): retry with Connection:close + delay
 *  - 28 HTTP 404: updated/alternative URLs
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, 'assets', 'img', 'exercises');

// ── Corrected URLs for the 46 failures ──────────────────────────────────────
// EACCES retries (same URLs — CDN may route differently on retry)
// 404 fixes — verified or best available alternative
const RETRY_URLS = {

  // ── Previously EACCES (CDN IP issue) — same URLs, retry ──
  'chest-flat-barbell':           'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Bench-Press.gif',
  'chest-flat-dumbbell':          'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Bench-Press.gif',
  'chest-flat-smith':             'https://fitnessprogramer.com/wp-content/uploads/2021/06/Smith-Machine-Bench-Press.gif',
  'chest-flat-machine':           'https://fitnessprogramer.com/wp-content/uploads/2021/08/Lying-Chest-Press-Machine.gif',
  'chest-flat-cable':             'https://fitnessprogramer.com/wp-content/uploads/2021/09/Cable-Chest-Press.gif',
  'chest-flat-converge':          'https://fitnessprogramer.com/wp-content/uploads/2021/06/Lever-Incline-Chest-Press.gif',
  'chest-flat-neutral':           'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Bench-Press.gif',
  'back-pulldown-wide':           'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lat-Pulldown.gif',
  'back-pullup-weighted':         'https://fitnessprogramer.com/wp-content/uploads/2021/04/Weighted-Pull-up.gif',
  'back-pulldown-machine':        'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lat-Pulldown.gif',
  'back-pulldown-reverse':        'https://fitnessprogramer.com/wp-content/uploads/2021/04/Reverse-Lat-Pulldown.gif',
  'back-pulldown-close-neutral':  'https://fitnessprogramer.com/wp-content/uploads/2021/06/Close-Grip-Lat-Pulldown.gif',
  'back-pullup-assisted':         'https://fitnessprogramer.com/wp-content/uploads/2021/04/Assisted-Pull-up.gif',
  'back-pulldown-behind-neck':    'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lat-Pulldown-Behind-Neck.gif',
  'back-pulldown-machine-behind': 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lat-Pulldown-Behind-Neck.gif',
  'back-pulldown-neutral':        'https://fitnessprogramer.com/wp-content/uploads/2021/06/V-bar-Lat-Pulldown.gif',
  'back-pullup-neutral':          'https://fitnessprogramer.com/wp-content/uploads/2022/08/neutral-grip-pull-up.gif',

  // back-pulldown-single — use alternative URL that avoids blocked CDN node
  'back-pulldown-single':         'https://fitnessprogramer.com/wp-content/uploads/2021/06/Cable-One-Arm-Lat-Pulldown.gif',

  // ── 404 fixes — updated / alternative URLs ──
  'delt-lateral-forepad':         'https://fitnessprogramer.com/wp-content/uploads/2021/07/one-arm-Cable-Lateral-Raise.gif',
  'shoulder-press-machine':       'https://fitnessprogramer.com/wp-content/uploads/2021/06/Standing-Smith-Machine-Shoulder-Press.gif',
  'shoulder-press-alt':           'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Shoulder-Press.gif',

  // Triceps lying extensions
  'tri-dips-weighted':             'https://fitnessprogramer.com/wp-content/uploads/2021/02/Triceps-Dips.gif',
  'tri-extension-barbell-lying':   'https://fitnessprogramer.com/wp-content/uploads/2022/02/Barbell-Lying-Back-of-the-Head-Tricep-Extension.gif',
  'tri-extension-dumbbell-lying':  'https://fitnessprogramer.com/wp-content/uploads/2021/06/Dumbbell-Skull-Crusher.gif',
  'tri-extension-dumbbell-overhead':'https://fitnessprogramer.com/wp-content/uploads/2021/06/Seated-One-Arm-Dumbbell-Triceps-Extension.gif',

  // Bicep curls
  'bi-curl-reverse-preacher':     'https://fitnessprogramer.com/wp-content/uploads/2021/04/Reverse-Preacher-Curl.gif',
  'bi-curl-hammer-cross':         'https://fitnessprogramer.com/wp-content/uploads/2021/08/Dumbbell-Scott-Hammer-Curl.gif',

  // Legs — RDL
  'legs-rdl-smith':               'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Romanian-Deadlift.gif',
  'legs-rdl-single':              'https://fitnessprogramer.com/wp-content/uploads/2021/06/Single-Leg-Romanian-Deadlift.gif',

  // Legs — press
  'legs-press-narrow':            'https://fitnessprogramer.com/wp-content/uploads/2015/11/Leg-Press.gif',
  'legs-press-sumo':              'https://fitnessprogramer.com/wp-content/uploads/2015/11/Leg-Press.gif',

  // Legs — curl
  'legs-curl-cable-lying':        'https://fitnessprogramer.com/wp-content/uploads/2021/04/Cable-Lying-Triceps-Extensions.gif',
  'legs-curl-cable-standing':     'https://fitnessprogramer.com/wp-content/uploads/2022/05/Standing-leg-curl.gif',
  'legs-curl-single':             'https://fitnessprogramer.com/wp-content/uploads/2021/08/Seated-Leg-Curl.gif',

  // Legs — lunge / step
  'legs-lunge-walking':           'https://fitnessprogramer.com/wp-content/uploads/2023/09/dumbbell-lunges.gif',
  'legs-lunge-bulgarian-smith':   'https://fitnessprogramer.com/wp-content/uploads/2021/05/Dumbbell-Bulgarian-Split-Squat.gif',
  'legs-lunge-reverse-smith':     'https://fitnessprogramer.com/wp-content/uploads/2022/08/bodyweight-reverse-lunge.gif',

  // Calf
  'legs-calf-smith':              'https://fitnessprogramer.com/wp-content/uploads/2021/06/Lever-Seated-Calf-Raise.gif',

  // Back rows
  'back-row-chest-support':       'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Row.gif',
  'back-row-lever-hammer':        'https://fitnessprogramer.com/wp-content/uploads/2021/06/Seated-Cable-Rope-Row.gif',
  'back-row-machine-vertical':    'https://fitnessprogramer.com/wp-content/uploads/2021/08/Cable-Rear-Pulldown.gif',
  'back-row-cable-single':        'https://fitnessprogramer.com/wp-content/uploads/2022/02/Single-Arm-Twisting-Seated-Cable-Row.gif',
  'back-row-machine-single':      'https://fitnessprogramer.com/wp-content/uploads/2021/06/Seated-Cable-Rope-Row.gif',
  'back-row-lever-single':        'https://fitnessprogramer.com/wp-content/uploads/2021/06/Seated-Cable-Rope-Row.gif',
  'back-row-cable-side':          'https://fitnessprogramer.com/wp-content/uploads/2022/02/Single-Arm-Twisting-Seated-Cable-Row.gif',
  'back-row-trx-single':          'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Row.gif',
};

// ── HTTP fetch (new agent per request to avoid EACCES) ──────────────────────
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
  const keys = Object.keys(RETRY_URLS);
  console.log(`\nRetrying ${keys.length} exercises...\n`);

  // Warm up: brief pause before starting
  await delay(1000);

  const results = { ok: [], fail: [] };

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = RETRY_URLS[key];
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

  // Merge with previous audit report
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
}

main().catch(console.error);
