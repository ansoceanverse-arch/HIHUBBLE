const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Replace privacy icons on posts with globe
c = c.replace(/data-lucide="facebook"/g, 'data-lucide="globe"');
c = c.replace(/data-lucide="twitter"/g, 'data-lucide="globe"');
c = c.replace(/data-lucide="instagram"/g, 'data-lucide="globe"');

// Replace comment icons on posts with message-circle, EXCEPT in the radial nav (which we don't touch per user request)
// We know action-circle-btn wraps the ones we DO want to change.
c = c.replace(/<button class="action-circle-btn"><i data-lucide="message-square"><\/i><\/button>/g, '<button class="action-circle-btn"><i data-lucide="message-circle"></i></button>');

// We also need to fix the one in the reels
c = c.replace(/<button class="action-circle-btn"><i data-lucide="message-circle"><\/i><\/button>/g, '<button class="action-circle-btn"><i data-lucide="message-circle"></i></button>'); // just in case

// Fix inbox filters
c = c.replace(/data-lucide="sliders-horizontal"/g, 'data-lucide="filter"');

// Fix new broadcast
c = c.replace(/data-lucide="radio"/g, 'data-lucide="megaphone"');

fs.writeFileSync('index.html', c);
console.log('Icons fixed successfully!');
