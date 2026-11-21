const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attributes]) => !/\bsrc\s*=/.test(attributes))
  .filter(([, attributes]) => !/\btype\s*=\s*["']application\//i.test(attributes));

if (inlineScripts.length === 0) throw new Error('No inline JavaScript was found in index.html');

for (const [index, [, , source]] of inlineScripts.entries()) {
  new vm.Script(source, { filename: `index.html inline script ${index + 1}` });
}

const motionDirectory = path.join(root, 'motion');
for (const filename of fs.readdirSync(motionDirectory).filter((name) => name.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(motionDirectory, filename), 'utf8'), { filename });
}

const sourceDirectory = path.join(root, 'src');
for (const filename of fs.readdirSync(sourceDirectory).filter((name) => name.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(sourceDirectory, filename), 'utf8'), {
    filename: `src/${filename}`,
  });
}

console.log(
  `Syntax check passed: ${inlineScripts.length} inline script, motion, and extracted JavaScript files.`,
);
