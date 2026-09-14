import Link from "next/link";
import type { ReactNode } from "react";
import { publishedPackages } from "@/lib/labelator-package";
import { publicPath } from "@/lib/public-path";

const sections = [
  ["what", "What is .labelator?"],
  ["design", "Design in LABELATOR"],
  ["download", "Download a template"],
  ["render", "Render locally"],
  ["install", "Python installation"],
  ["api", "Python API"],
  ["cli", "CLI"],
  ["data", "Input data"],
  ["offline", "Offline production rendering"],
  ["compatibility", "Compatibility"],
  ["capabilities", "Supported capabilities"],
  ["catalog", "Template downloads"],
  ["example", "Example"],
  ["versioning", "Versioning"],
  ["limits", "Limitations"],
] as const;

export function IntegrationView() {
  const packages = publishedPackages();
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Developer integration</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">LABELATOR Developer Integration</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Design labels visually. Use portable .labelator templates in your own application.
        </p>
        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-[#1b4f9c] underline-offset-2 hover:underline">
              {label}
            </a>
          ))}
        </nav>

        <Section id="what" title="What is .labelator?">
          <p>
            .labelator is LABELATOR&apos;s portable production template package. It is a store-only ZIP: the template
            definition, the fonts it uses, and any images it needs. Format id <code>labelator.package</code>, version 1.
            The contract is frozen.
          </p>
          <p>
            A template is designed in LABELATOR, downloaded as .labelator, installed in another application, and
            rendered locally. The first production runtime is the Python package <code>labelator_renderer</code>.
          </p>
        </Section>

        <Section id="design" title="Design in LABELATOR">
          <p>
            Use Designer for layout, bindings, barcodes, and type. That is design time. Saving a template does not
            publish a production renderer.
          </p>
          <pre>{`LABELATOR
    ↓
.labelator export
    ↓
download / install
    ↓
external application
    ↓
Python renderer
    ↓
PDF`}</pre>
        </Section>

        <Section id="download" title="Download a template">
          <p>There are two downloads. They are not the same file.</p>
          <ul>
            <li>
              <strong>Designer — Download .labelator</strong> exports the current working template with the same
              exporter the catalog uses. It reflects unsaved edits on the canvas.
            </li>
            <li>
              <strong>Templates and this page</strong> download the published catalog package from a stable static URL.
              That file does not include later edits until the catalog is republished.
            </li>
          </ul>
          <p>JSON download is still the raw template definition. .labelator is the self-contained production package.</p>
        </Section>

        <Section id="render" title="Render locally">
          <p>
            Install the renderer next to your application. Pass the downloaded file and your production rows. LABELATOR
            does not need to be running.
          </p>
        </Section>

        <Section id="install" title="Python installation">
          <p>From a checkout of this repository:</p>
          <pre>pip install -e tools/labelator_renderer</pre>
          <p>
            Runtime dependencies are PyMuPDF, Pillow, and fontTools. The package includes the <code>labelator-render</code>{" "}
            command.
          </p>
        </Section>

        <Section id="api" title="Python API">
          <pre>{`from labelator_renderer import render

render(
    template_package="warehouse.labelator",
    data=rows,
    output_pdf="labels.pdf",
)`}</pre>
          <p>
            <code>rows</code> is a list of dictionaries. Keys match the package data contract, case-insensitively.
          </p>
        </Section>

        <Section id="cli" title="CLI">
          <pre>{`labelator-render \\
    --template warehouse.labelator \\
    --data labels.json \\
    --output labels.pdf`}</pre>
        </Section>

        <Section id="data" title="Input data">
          <p>Both JSON forms are accepted:</p>
          <pre>{`[
  { "warehouse_code": "WG6.99.123" }
]`}</pre>
          <pre>{`{
  "rows": [
    { "warehouse_code": "WG6.99.123" }
  ]
}`}</pre>
          <p>
            Bindings, fallbacks, and transforms such as <code>barcode_pct</code> are applied by the renderer from the
            package. An empty bound field paints blank. It does not fall back to the sample text designed into the
            template.
          </p>
        </Section>

        <Section id="offline" title="Offline production rendering">
          <p>LABELATOR does not need to be running during production rendering.</p>
          <p>Production rendering does not require:</p>
          <ul>
            <li>LABELATOR</li>
            <li>IndexedDB</li>
            <li>data/library.json</li>
            <li>a browser</li>
            <li>LABELATOR public assets</li>
            <li>a network</li>
            <li>Google Fonts</li>
          </ul>
          <p>Fonts and images come from the package. Template JSON is data. It is not executed.</p>
        </Section>

        <Section id="compatibility" title="Compatibility">
          <p>
            .labelator is broader than the current Python renderer. A package can be a valid v1 package and still use a
            capability this renderer does not draw.
          </p>
          <p>
            Compatible means the document only uses capabilities in the current Python renderer profile. That package is
            safe for the current renderer.
          </p>
          <p>
            Incompatible means the current Python renderer cannot render it completely. The package may still be a valid
            .labelator file. Incompatibility is not a package-format failure. The template is not rewritten to force a
            match.
          </p>
          <p>
            Designer shows that result before exporting the working copy and still downloads unless packaging itself
            fails. The catalog download list below contains only packages the analyzer accepted for the current
            renderer.
          </p>
        </Section>

        <Section id="capabilities" title="Supported capabilities">
          <p>The current Python renderer supports:</p>
          <ul>
            <li>Text, rectangle, line, image (stretch), arrow, and double arrow</li>
            <li>Code39 and Code128</li>
            <li>Transforms: ga_magacin, ga_regal_letter, ga_regal_number, ga_nivo, arrow, part_number, barcode_pct</li>
            <li>Fonts: Artifakt Element, Artifakt Element Black, Open Sans, Inter 700</li>
            <li>1-up, and sheet packing when the package print mode is sheet</li>
          </ul>
          <p>
            Not supported by this renderer: QR, EAN-13, ellipse, unused polygons, dashed strokes, non-zero corner
            radius, part, and partIndex.
          </p>
        </Section>

        <Section id="catalog" title="Template downloads">
          <p>
            These are the published Industrial templates the current Python renderer can draw. Each file is a static
            asset. No server generates it when you click.
          </p>
          <p>
            A catalog package prints one label per page unless the listed print mode is sheet. A template can still
            contain a sheet layout. Designer can export the current working copy with sheet packing.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Template</th>
                  <th className="px-3 py-2 font-medium">Page</th>
                  <th className="px-3 py-2 font-medium">Print</th>
                  <th className="px-3 py-2 font-medium">Python</th>
                  <th className="px-3 py-2 font-medium">Download</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((item) => (
                  <tr key={item.fileName} className="border-t border-border">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.pageMm}</td>
                    <td className="px-3 py-2">{item.printMode === "sheet" ? "Sheet" : "1-up"}</td>
                    <td className="px-3 py-2 text-emerald-800">Compatible</td>
                    <td className="px-3 py-2">
                      <a
                        href={publicPath(item.href)}
                        download={item.fileName}
                        className="text-[#1b4f9c] underline-offset-2 hover:underline"
                      >
                        .labelator
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="example" title="Example">
          <ol>
            <li>Download a package from the table above.</li>
            <li>Place it next to your application.</li>
            <li>Write production rows as a JSON array or a <code>rows</code> object.</li>
            <li>Call <code>render</code> or <code>labelator-render</code>.</li>
            <li>Print the local PDF.</li>
          </ol>
        </Section>

        <Section id="versioning" title="Versioning">
          <p>
            Package format version is 1. Renderer package version is 0.1.0. Those numbers are independent. A renderer
            release can change its CLI without changing the package format. A format change would be a new format
            version, which this renderer would refuse.
          </p>
          <p>Catalog filenames end in <code>_v1</code> for this format. That is the file name, not a manifest field you need to edit.</p>
        </Section>

        <Section id="limits" title="Limitations">
          <p>
            This page is the integration contract. It is not an HTTP API. There are no API keys, OAuth, webhooks, remote
            rendering, upload endpoints, or template synchronization.
          </p>
          <p>
            Published downloads are generated from the catalog and served as static files. They do not follow an unsaved
            Designer edit. Use Designer export for the working copy.
          </p>
          <p>
            <Link href="/templates" className="text-[#1b4f9c] underline-offset-2 hover:underline">
              Browse templates
            </Link>
          </p>
        </Section>
      </article>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_li]:ml-4 [&_li]:list-disc [&_ol]:list-decimal [&_ol_li]:ml-4 [&_ol_li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-[12px] [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
