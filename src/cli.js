import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { exportLogSummariesToDatabase } from './database.js';

const [, , inputDir, outputDb] = process.argv;

if (!inputDir || !outputDb) {
  console.error('Usage: node src/cli.js <input-directory> <output-db.sqlite>');
  process.exit(1);
}

const files = readdirSync(inputDir)
  .filter((entry) => statSync(join(inputDir, entry)).isFile())
  .map((entry) => ({
    name: entry,
    text: async () => {
      const { readFile } = await import('node:fs/promises');
      return readFile(join(inputDir, entry), 'utf8');
    }
  }));

await exportLogSummariesToDatabase(files, outputDb);
console.log(`Wrote ${files.length} log(s) to ${outputDb}`);
