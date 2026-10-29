import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { nodeFileTrace } from "@vercel/nft";

const root = process.cwd();
const output = join(root, ".vercel", "output");
const func = join(output, "functions", "index.func");

rmSync(output, { recursive: true, force: true });
mkdirSync(func, { recursive: true });
cpSync(join(root, "build", "client"), join(output, "static"), { recursive: true });
cpSync(join(root, "build", "server"), join(func, "server-build"), { recursive: true });

const handler = `import { createRequestListener } from "@react-router/node";
import * as build from "./server-build/index.js";

const listener = createRequestListener({
  build,
  mode: process.env.NODE_ENV,
});

export default function handler(req, res) {
  return listener(req, res);
}
`;
writeFileSync(join(func, "index.mjs"), handler);
writeFileSync(
  join(func, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

const traced = await nodeFileTrace(
  [join(func, "index.mjs"), join(func, "server-build", "index.js")],
  { base: root },
);
for (const file of traced.fileList) {
  if (!file.startsWith("node_modules/")) continue;
  const destination = join(func, file);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(root, file), destination);
}

writeFileSync(
  join(output, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        {
          src: "^/assets/(.*)$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        { src: "^/(.*)$", dest: "/index" },
      ],
    },
    null,
    2,
  ),
);

const missing = [...traced.warnings];
if (missing.length) console.log(missing.join("\n"));
console.log("Wrote .vercel/output");
