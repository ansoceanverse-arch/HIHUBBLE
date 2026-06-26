const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
c = c.replace(/data-lucide="check-check"/g, 'data-lucide="diamond"');
fs.writeFileSync('index.html', c);
console.log('Replaced check-check with diamond');
