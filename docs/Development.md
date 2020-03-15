# Development Guide

Moonset is a monopackage managed by lerna. All packages should maintain the same version by lerna. The following are some sample commands:

```
npx lerna version patch
npx lerna exec -- npm publish --access public
```

The packages are publish in NPM. Here are the links:

* https://www.npmjs.com/package/moonset
* https://www.npmjs.com/package/@moonset/model
* https://www.npmjs.com/package/@moonset/executor

