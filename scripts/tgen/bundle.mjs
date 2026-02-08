
const supportedTargets = ["default"];
let bundleTargets = [];

if (process.argv[2] === undefined) {
  bundleTargets = supportedTargets;
} else {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (!supportedTargets.includes(arg.toLowerCase())) {
      console.error(`unknown target: ${arg}`);
      process.exit(1);
    }
  }
  bundleTargets = args;
}

for (const target of bundleTargets) {
  await import(`./${target}/build.mjs`);
}