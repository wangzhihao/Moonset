# Development Guide

Moonset is a monopackage managed by lerna.  You can use the following commands
to prepare the develop environment and invoke the CLI for development.

```bash
cd Moonset/
npm install
npx lerna bootstrap
cd ./packages/cli/
npm run cli -- --help
npm run cli -- run  \
    --plugin $(readlink -f ../plugins/platform-emr/)  \
    --plugin $(readlink -f ../plugins/data-glue/)  \
    --job  '{}'
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
npx lerna exec -- npx npm-check-updates -u
```

The packages are publish in NPM. Here are some links:

* https://www.npmjs.com/package/moonset
* https://www.npmjs.com/search?q=%40moonset

