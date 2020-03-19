# Development Guide

Moonset is a monopackage managed by lerna.  You can use the following commands
to prepare the develop environment and invoke the CLI for development.

```bash
cd Moonset/
npm install
npx lerna bootstrap
./packages/cli/cli.js --help
./packages/cli/cli.js deploy --job '{}'
```

All packages should maintain the same version by lerna. The following are some
sample commands:

```
npx lerna version patch
npx lerna exec -- npm publish --access public
```

Here are some helper commands.

```bash
# compile the typescript continously
npx lerna run --parallel watch
# check the diff of this deployment and online cloudformation
npx cdk diff --app ./build/cdk.out
# update the dependencies in package.json
npx npm-check-updates
```

The packages are publish in NPM. Here are some links:

* https://www.npmjs.com/package/moonset
* https://www.npmjs.com/package/@moonset/model
* https://www.npmjs.com/package/@moonset/executor
* https://www.npmjs.com/package/@moonset/util

