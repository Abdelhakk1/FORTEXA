/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/\\(dashboard\\)/**/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/<div className="overflow-x-auto">\s*<table className="w-full text-sm">/g, '<div className="overflow-x-auto w-full">\n          <table className="w-full text-sm min-w-[1100px]">');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log(`Updated table in ${file}`);
  }
}
