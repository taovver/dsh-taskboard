// 把 client/src 打包进 dsh/client.js（__ModuleLoader__ 工厂 + factory 包装）。
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const banner = [
  'window.__ModuleLoader__.load({ id: "dsh-taskboard", factory: (require) => {',
  "",
  "\t\tvar module = { exports: {} };",
  '\t\tvar exports = module.exports;',
  '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  "",
].join("\n");

const footer = [
  "",
  "\t\treturn module.exports;",
  "\t}",
  "});",
  "",
].join("\n");

await build({
  entryPoints: [path.join(root, "client/src/index.js")],
  bundle: true,
  format: "cjs",
  platform: "neutral",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime", "@deepseek-ai/*"],
  banner: { js: banner },
  footer: { js: footer },
  outfile: path.join(root, "dsh/client.js"),
  sourcemap: true,
  logLevel: "info",
});

console.log("built dsh/client.js");
