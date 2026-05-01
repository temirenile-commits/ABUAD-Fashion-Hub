const fs = require('fs');
const path = require('path');

const GLITCH_MAP = {
  'â­ ': '⭐',
  'ðŸ“¢': '📢',
  'ðŸ ª': '🏪',
  'ðŸšš': '🚚',
  'ðŸ‘¤': '👤',
  'ðŸŽ¯': '🎯',
  'ðŸ“£': '📣',
  'ðŸ“©': '📩',
  'ðŸ’°': '💰',
  'ðŸ“¦': '📦',
  'âœ…': '✅',
  'ðŸ›’': '🛒',
  'âš⚡': '⚡',
  'âš ï¸ ': '⚠️',
  'ðŸ”Ž': '🔎',
  'â€”': '—',
  'â‚¦': '₦',
  'ðŸ› ï¸ ': '🛒',
  'âœ¨': '✨',
  'ðŸŒŸ': '🌟',
  'ðŸŽ“': '🎓',
  'ðŸ ¢': '🏢',
  'ðŸ“ˆ': '📈',
  'âš¡': '⚡',
  'ðŸ’»': '💻',
  'âœ"': '✍️',
  'ðŸ›¹': '🛹',
  'ðŸ“§': '📧',
  'ðŸ”🔔': '🔔',
  'â­ ï¸ ': '⭐',
  'ðŸ”¥': '🔥',
  'âœ–ï¸ ': '✖️',
  'ðŸš€': '🚀'
};

function cleanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        cleanDir(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.json') || file.endsWith('.css') || file.endsWith('.module.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      for (const [glitch, fix] of Object.entries(GLITCH_MAP)) {
        if (content.includes(glitch)) {
          content = content.split(glitch).join(fix);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Cleaned:', fullPath);
      }
    }
  }
}

console.log('Starting deep clean v3...');
cleanDir('./src');
cleanDir('./public');
console.log('Deep clean v3 finished!');
