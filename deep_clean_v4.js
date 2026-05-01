const fs = require('fs');
const path = require('path');

const GLITCH_MAP = {
  'ðŸ¢': '🏢',
  'ðŸ›’': '🛒',
  'ðŸ’³': '💳',
  'ðŸŽ“': '🎓',
  'ðŸ› ï¸ ': '🛒',
  'ðŸ—ï¸ ': '🗺️',
  'ðŸ’°': '💰',
  'ðŸ“¦': '📦',
  'ðŸ“£': '📣',
  'ðŸ“¢': '📢',
  'ðŸ ª': '🏪',
  'ðŸšš': '🚚',
  'ðŸ‘¤': '👤',
  'ðŸŽ¯': '🎯',
  'ðŸ“©': '📩',
  'â­ ': '⭐',
  'âœ✅': '✅',
  'âš¡': '⚡',
  'âœ✨': '✨',
  'ðŸŒ🌟': '🌟',
  'ðŸŽ🎓': '🎓'
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

console.log('Starting deep clean v4...');
cleanDir('./src');
cleanDir('./public');
console.log('Deep clean v4 finished!');
