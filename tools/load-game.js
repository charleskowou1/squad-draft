// Loads the game's script files into one Node sandbox, the same way index.html loads them in the browser.
const fs = require('fs'), vm = require('vm'), path = require('path');
function loadGame(files, extra = '') {
  const code = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
  const ctx = { Math, console, JSON, Object, String };
  vm.createContext(ctx);
  vm.runInContext(code + '\n' + extra, ctx);
  return ctx;
}
module.exports = { loadGame };
