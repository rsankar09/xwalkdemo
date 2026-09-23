import { exec } from "node:child_process";

const run = (cmd) => new Promise((resolve, reject) => exec(
  cmd,
  (error, stdout) => {
    if (error) reject(error);
    else resolve(stdout);
  }
));

const changeset = await run('git diff --cached --name-only --diff-filter=ACMR');
const modifiedFiles = changeset.split('\n').filter(Boolean);

// check if there are any model files staged
const modifledPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*.json/));
if (modifledPartials.length > 0) {
  const output = await run('npm run build:json --silent');
  console.log(output);
  await run('git add component-models.json component-definition.json component-filters.json');
}

/*
 * Structural preflight. Runs on every commit that touches a block, a model,
 * an icon or the importer, because each of the checks it makes corresponds
 * to something that shipped broken and was only caught by a human reading
 * code a run later. It is ~0.3s, so the cost of always running it is far
 * below the cost of missing one.
 */
const touchesStructure = modifiedFiles.some((file) => (
  file.startsWith('blocks/')
  || file.startsWith('models/')
  || file.startsWith('icons/')
  || file.startsWith('tools/importer/')
));

if (touchesStructure) {
  try {
    console.log(await run('node tools/importer/preflight.mjs'));
  } catch (error) {
    console.error(error.stdout || error.message);
    console.error('\npre-commit: preflight failed — fix the errors above, or '
      + 'commit with --no-verify if you know why it is wrong.');
    process.exit(1);
  }
}
