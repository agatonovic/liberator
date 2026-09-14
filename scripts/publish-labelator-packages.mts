/**
 * Generate static .labelator downloads for every compatible Industrial template.
 *
 *   npm run publish:labelator
 *
 * Does not write data/library.json. Package bytes come from buildLabelatorPackage.
 */
import { relative } from "node:path";
import { publishLabelatorPackages } from "../src/lib/labelator-package/publish-disk";

if (process.env.LABELATOR_PUBLISH === "1") {
  const records = publishLabelatorPackages();
  console.log(`Published ${records.length} packages to ${relative(process.cwd(), "public/downloads/labelator")}`);
}
