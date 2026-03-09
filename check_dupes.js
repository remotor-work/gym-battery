const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = path.join(__dirname, 'assets', 'img', 'exercises');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gif'));
const byHash = {};
for (const f of files) {
  const buf = fs.readFileSync(path.join(dir, f));
  const h = crypto.createHash('md5').update(buf).digest('hex');
  (byHash[h] = byHash[h] || []).push(f);
}
const dupes = Object.values(byHash).filter(a => a.length > 1);
if (dupes.length === 0) {
  console.log('No duplicates — all ' + files.length + ' GIFs are unique!');
} else {
  console.log(dupes.length + ' groups of shared GIFs:');
  dupes.forEach(g => console.log('  ' + g.join('  |  ')));
}
