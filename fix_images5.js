/**
 * fix_images5.js — Resolve highest-impact duplicate groups
 * Applies unique confirmed-200 GIFs to exercises that were using generic substitutes.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, 'assets', 'img', 'exercises');

const DEDUP_URLS = {
  // Was generic Dumbbell-Row.gif — now proper incline/chest-supported row
  'back-row-chest-support': 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Incline-Dumbbell-Row.gif',
  // Was generic Dumbbell-Row.gif — now proper inverted row (closest to TRX)
  'back-row-trx-single':    'https://fitnessprogramer.com/wp-content/uploads/2021/06/Inverted-Row.gif',
  // All three face-pull variants get the Face-Pull GIF (unique vs rear delt machine)
  'trap-face-pull-cable':   'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif',
  'trap-face-pull-band':    'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif',
  'trap-face-pull-seated':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif',
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
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const keys = Object.keys(DEDUP_URLS);
  console.log(`\nDe-duplication pass: ${keys.length} exercises...\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = DEDUP_URLS[key];
    const outPath = path.join(OUT_DIR, key + '.gif');
    process.stdout.write(`  [${i+1}/${keys.length}] ${key} ← ${url.split('/').pop()} ... `);
    try {
      const buf = await fetchUrl(url);
      if (buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46) {
        console.log('✗ (not a GIF)'); fail++; continue;
      }
      fs.writeFileSync(outPath, buf);
      console.log(`✓ (${(buf.length/1024).toFixed(0)} KB)`);
      ok++;
    } catch(e) {
      console.log(`✗ (${e.message})`); fail++;
    }
    await delay(300);
  }

  console.log(`\n✓ ${ok}  ✗ ${fail}`);

  // Recount duplicates
  const crypto = require('crypto');
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.gif'));
  const byHash = {};
  for (const f of files) {
    const h = crypto.createHash('md5').update(fs.readFileSync(path.join(OUT_DIR, f))).digest('hex');
    (byHash[h] = byHash[h] || []).push(f.replace('.gif',''));
  }
  const dupes = Object.values(byHash).filter(a => a.length > 1);
  console.log(`\nDuplicate groups remaining: ${dupes.length}`);
  dupes.forEach(g => console.log('  ' + g.join(' | ')));
}

main().catch(console.error);
