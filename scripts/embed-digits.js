// scripts/embed-digits.js
// public/digits/*.svg を src/digits.js に埋め込む自動生成スクリプト
const fs = require('fs');
const path = require('path');

const digitsDir = path.join(__dirname, '../public/digits');
const outFile = path.join(__dirname, '../src/digits.js');

const digits = {};
for (let i = 0; i <= 9; ++i) {
  const file = path.join(digitsDir, `${i}.svg`);
  digits[i] = fs.readFileSync(file, 'utf8');
}

fs.writeFileSync(
  outFile,
  `// auto generated file: public/digits/*.svg → src/digits.js\nexport const digits = ${JSON.stringify(digits, null, 2)};\n`
);
console.log('src/digits.js generated');
