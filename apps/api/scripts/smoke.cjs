#!/usr/bin/env node
/**
 * Regression guard: ensures @nestjs/platform-express, multer, and busboy
 * (and thus streamsearch) are loadable. Run with: pnpm smoke:api
 * Exit 0 if all loadable, else print error and exit 1.
 */
const modules = [
  '@nestjs/platform-express',
  'multer',
  'busboy',
];

for (const id of modules) {
  try {
    require(id);
  } catch (err) {
    console.error(`smoke: failed to load "${id}":`, err.message);
    process.exit(1);
  }
}
console.log('smoke: all required modules resolvable');
process.exit(0);
