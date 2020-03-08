#!/usr/bin/env node

const pbjs = require("protobufjs/cli/pbjs");
const pbts = require("protobufjs/cli/pbts");

console.log("Compile the proto files into Javascript and Typescript via protobufjs.");

pbjs.main([
    "--out",
    "index.js",
    "--target",
    "static-module",
    "--wrap",
    "commonjs",
    "./proto/*.proto"
], function (err) {
    if (err)
        throw err;
});

pbts.main([
    "--out",
    "index.d.ts",
    "index.js"
], function(err) {
    if (err)
        throw err;
});
