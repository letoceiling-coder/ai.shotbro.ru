import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const out = join(dir, "large-e2e.pdf");
const targetBytes = 9 * 1024 * 1024;

if (!existsSync(out)) {
  const buf = Buffer.alloc(targetBytes, 0x20);
  buf.write("%PDF-1.4\n", 0);
  writeFileSync(out, buf);
  console.log(`Wrote ${out} (${targetBytes} bytes)`);
}
