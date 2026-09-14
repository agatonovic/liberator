import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { publishedPackages } from "@/lib/labelator-package";
import { publicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";
import { ArrowDown, Download, Package } from "lucide-react";

const sections = [
  ["how", "How it works"],
  ["quick-start", "Quick start"],
  ["package", "What is a .labelator package?"],
  ["boundary", "Production boundary"],
  ["templates", "Reference templates"],
  ["api", "Python API"],
  ["cli", "CLI"],
  ["compatibility", "Validity vs compatibility"],
  ["workflows", "Working vs published"],
  ["troubleshooting", "Troubleshooting"],
  ["docs", "Documentation"],
] as const;

export function IntegrationView() {
  const packages = publishedPackages();
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl px-6 py-8 pb-16">
        <header className="border-b border-border pb-8">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Developer Integration</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Portable label templates for your application
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Design labels in LABELATOR, export them as portable .labelator packages, and render them locally with the
            Python renderer — without running LABELATOR or connecting to the network.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#install" className={cn(buttonVariants({ size: "sm" }))}>
              <Download className="size-3.5" />
              Get Python renderer
            </a>
            <a href="#templates" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              <Package className="size-3.5" />
              Browse templates
            </a>
            <Link href="/templates" className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}>
              Open Templates
            </Link>
          </div>
          <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-[#1b4f9c] underline-offset-2 hover:underline">
                {label}
              </a>
            ))}
          </nav>
        </header>

        <Section id="how" title="How it works">
          <p>
            LABELATOR is required for design, not for production rendering. Your application owns production data,
            template storage, and the output PDF.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FlowCard title="Design time" accent="design">
              <pre className="!bg-transparent !p-0">{`LABELATOR
  ↓
Design / edit template
  ↓
.labelator package`}</pre>
            </FlowCard>
            <FlowCard title="Production" accent="production">
              <pre className="!bg-transparent !p-0">{`Your application
  + .labelator
  + production data
  ↓
local Python renderer
  ↓
PDF`}</pre>
            </FlowCard>
          </div>
        </Section>

        <Section id="quick-start" title="Quick start">
          <p>
            Five steps to a local PDF. The example uses the published Warehouse A3 package and its sample fields.
            Templates define their own bindings — these keys are not universal requirements.
          </p>

          <Step n={1} title="Get a template">
            <p>
              Download a published <code>.labelator</code> file from{" "}
              <a href="#templates" className="text-[#1b4f9c] underline-offset-2 hover:underline">
                Reference templates
              </a>{" "}
              below, or from Templates in LABELATOR. Place it next to your application.
            </p>
          </Step>

          <Step n={2} title="Install the renderer" id="install">
            <p>
              The current distribution is an editable install from this repository. There is no separate package registry
              publish for the renderer yet.
            </p>
            <pre>{`pip install -e tools/labelator_renderer`}</pre>
            <p>
              Runtime dependencies used by the renderer: PyMuPDF, Pillow, and fontTools. The install also provides the{" "}
              <code>labelator-render</code> command.
            </p>
          </Step>

          <Step n={3} title="Prepare data">
            <p>
              Pass a JSON array of row objects, or an object with a <code>rows</code> list. Keys match the package data
              contract (case-insensitive). Empty bound fields paint blank.
            </p>
            <pre>{`[
  {
    "reference": "7358042350",
    "ref4": "QULY",
    "depth": "1",
    "stackability": "4",
    "packaging": "X4202",
    "warehouse_code": "WG6.99.123",
    "barcode": "WG6.99.123"
  }
]`}</pre>
            <p className="text-muted-foreground">
              Warehouse A3 example only. Read each package&apos;s data contract for the keys that template expects.
            </p>
          </Step>

          <Step n={4} title="Render with the Python API">
            <pre>{`from labelator_renderer import render

render(
    template_package="Warehouse_A3_Final_v1.labelator",
    data=rows,
    output_pdf="labels.pdf",
)`}</pre>
          </Step>

          <Step n={5} title="Or render with the CLI">
            <pre>{`labelator-render \\
  --template Warehouse_A3_Final_v1.labelator \\
  --data labels.json \\
  --output labels.pdf`}</pre>
            <p>
              In both paths the <code>.labelator</code> package is the portable template contract. LABELATOR does not need
              to be running.
            </p>
          </Step>
        </Section>

        <Section id="package" title="What is a .labelator package?">
          <p>
            A <code>.labelator</code> file is a portable, versioned template package: a store-only ZIP with format id{" "}
            <code>labelator.package</code> and format version <code>1</code>. The v1 contract is frozen.
          </p>
          <p>It contains the template definition and the packaged resources that template needs.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompareCard title="Included (v1)">
              <ul>
                <li>
                  <code>manifest.json</code>
                </li>
                <li>
                  <code>template.json</code>
                </li>
                <li>
                  <code>assets/index.json</code>
                </li>
                <li>
                  Packaged fonts under <code>fonts/</code>
                </li>
                <li>
                  Packaged images under <code>assets/</code> when used
                </li>
              </ul>
            </CompareCard>
            <CompareCard title="Not required for production">
              <ul>
                <li>LABELATOR runtime</li>
                <li>Browser</li>
                <li>IndexedDB</li>
                <li>
                  <code>library.json</code>
                </li>
                <li>Node.js</li>
                <li>Network access</li>
              </ul>
            </CompareCard>
          </div>
          <p>
            Full contract: <code>docs/LABELATOR_TEMPLATE_PACKAGE_FORMAT.md</code> in this repository.
          </p>
        </Section>

        <Section id="boundary" title="Production boundary">
          <div className="rounded-lg border border-[#1b4f9c]/30 bg-[#1b4f9c]/5 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Production rendering is local.</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed">
              <li>The consuming application owns its data, template storage, and output PDF.</li>
              <li>The Python renderer reads the local package and local row data, then writes the PDF locally.</li>
              <li>No LABELATOR runtime and no network connection are required for rendering.</li>
            </ul>
          </div>
          <p className="text-muted-foreground">
            This page documents developer integration. It is not an HTTP API. There are no API keys, OAuth, webhooks,
            remote rendering, or template synchronization endpoints.
          </p>
        </Section>

        <Section id="templates" title="Reference templates">
          <p>
            Published Industrial packages the current Python renderer can draw. Each download is a static{" "}
            <code>.labelator</code> v1 file. Nothing generates the package when you click.
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Template</th>
                  <th className="px-3 py-2 font-medium">Print mode</th>
                  <th className="px-3 py-2 font-medium">Format</th>
                  <th className="px-3 py-2 font-medium">Download</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((item) => (
                  <tr key={item.fileName} className="border-t border-border align-top">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.pageMm}</div>
                    </td>
                    <td className="px-3 py-2.5">{item.printMode === "sheet" ? "Sheet" : "1-up"}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">.labelator v1</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <a
                        href={publicPath(item.href)}
                        download={item.fileName}
                        className="inline-flex items-center gap-1 font-medium text-[#1b4f9c] underline-offset-2 hover:underline"
                      >
                        <Download className="size-3.5" />
                        {item.fileName}
                      </a>
                      <details className="mt-1.5 text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">SHA-256</summary>
                        <code className="mt-1 block break-all rounded bg-muted px-1.5 py-1 text-[11px] text-foreground">
                          {item.sha256}
                        </code>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground">
            A catalog package prints one label per page unless the listed print mode is sheet. Designer can still export a
            working copy with a different print mode when that is appropriate for the document.
          </p>
        </Section>

        <Section id="api" title="Python API">
          <p>
            Recommended for direct Python application integration. Public entry point: <code>render</code>.
          </p>
          <pre>{`from labelator_renderer import render

render(
    template_package="Warehouse_A3_Final_v1.labelator",
    data=rows,
    output_pdf="labels.pdf",
)`}</pre>
          <p>
            <code>template_package</code> is a <code>.labelator</code> ZIP path or an unpacked directory.{" "}
            <code>data</code> is a list of row dicts (or, via CLI, a JSON file in that shape). The function returns the
            output PDF path.
          </p>
          <p>
            <code>validate_package(path)</code> checks the frozen v1 files and checksums without drawing.
          </p>
        </Section>

        <Section id="cli" title="CLI">
          <p>Useful for process- or file-based integration.</p>
          <pre>{`labelator-render \\
  --template Warehouse_A3_Final_v1.labelator \\
  --data labels.json \\
  --output labels.pdf`}</pre>
          <p>
            The <code>.labelator</code> package is the portable template contract for both the Python API and the CLI.
            Ordinary failures print a single <code>error:</code> line; use <code>--verbose</code> only when you need a
            traceback for an unexpected failure.
          </p>
        </Section>

        <Section id="compatibility" title="Package validity vs renderer compatibility">
          <div className="grid gap-3 sm:grid-cols-2">
            <CompareCard title="Package validity">
              <p>
                The file is a valid <code>.labelator</code> v1 package: required members, checksums, and contract rules
                pass.
              </p>
            </CompareCard>
            <CompareCard title="Renderer compatibility">
              <p>
                A particular renderer supports every capability that package uses (shapes, barcodes, fonts, transforms,
                print mode).
              </p>
            </CompareCard>
          </div>
          <p>
            A package can be valid and still be incompatible with the current Python renderer. Renderer limitations do not
            invalidate the <code>.labelator</code> format. Incompatibility is not a package-format failure.
          </p>
          <p>
            Compatible means the document only uses capabilities in the current Python renderer profile. The published
            list above contains packages accepted for that renderer. Designer still downloads a working-copy package unless
            packaging itself fails.
          </p>
          <p className="font-medium">Current Python renderer supports:</p>
          <ul>
            <li>Text, rectangle, line, image (stretch), arrow, and double arrow</li>
            <li>Code39 and Code128</li>
            <li>
              Transforms: <code>ga_magacin</code>, <code>ga_regal_letter</code>, <code>ga_regal_number</code>,{" "}
              <code>ga_nivo</code>, <code>arrow</code>, <code>part_number</code>, <code>barcode_pct</code>
            </li>
            <li>Fonts: Artifakt Element, Artifakt Element Black, Open Sans, Inter 700</li>
            <li>1-up, and sheet packing when the package print mode is sheet</li>
          </ul>
          <p>
            Not supported by this renderer: QR, EAN-13, ellipse, unused polygons, dashed strokes, non-zero corner radius,{" "}
            <code>part</code>, and <code>partIndex</code>.
          </p>
        </Section>

        <Section id="workflows" title="Working template vs published template">
          <ul>
            <li>
              <strong>Designer — Download .labelator</strong> exports the <em>current working document</em> through the
              same package exporter. It reflects what is on the canvas, including unsaved edits.
            </li>
            <li>
              <strong>Templates and this page</strong> download the <em>stable published catalog package</em> from a fixed
              static URL. That file does not include later Designer edits until the catalog is republished.
            </li>
          </ul>
          <p>
            These are intentionally different workflows. JSON download remains the raw template definition;{" "}
            <code>.labelator</code> is the self-contained production package.
          </p>
        </Section>

        <Section id="troubleshooting" title="Troubleshooting">
          <dl className="space-y-4">
            <div>
              <dt className="font-medium">Package validation failure</dt>
              <dd className="mt-1 text-muted-foreground">
                The path is missing, unreadable, or does not match the frozen v1 contract (members, checksums, or known
                transforms). Fix or replace the <code>.labelator</code> file. The CLI reports these as package errors.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Missing or invalid data</dt>
              <dd className="mt-1 text-muted-foreground">
                Row JSON must be a list of objects, or <code>{"{ \"rows\": [ ... ] }"}</code>. Missing files and invalid
                JSON fail before drawing. Empty bound fields do not fail the render — they paint blank. Keys must match
                that package&apos;s data contract.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Unsupported renderer capability</dt>
              <dd className="mt-1 text-muted-foreground">
                The package is valid but asks for a transform, symbology, or other capability this renderer does not draw.
                That is a compatibility gap, not a format invalidation. Use a compatible template or a renderer that
                supports the missing capability.
              </dd>
            </div>
          </dl>
        </Section>

        <Section id="docs" title="Documentation">
          <p>Deeper references in this repository:</p>
          <ul>
            <li>
              <code>docs/LABELATOR_TEMPLATE_PACKAGE_FORMAT.md</code> — frozen <code>.labelator</code> v1 contract
            </li>
            <li>
              <code>docs/LABELATOR_PYTHON_RENDERER.md</code> — Python API, CLI, install, offline trust
            </li>
            <li>
              <code>docs/LABELATOR_DEVELOPER_INTEGRATION.md</code> — integration boundary and downloads
            </li>
            <li>
              <code>docs/LABELATOR_PORTABLE_RENDERER_ACCEPTANCE.md</code> — acceptance / reference proof
            </li>
            <li>
              <code>docs/LABELATOR_PORTABLE_RENDERING_COVERAGE.md</code> — capability coverage
            </li>
            <li>
              <code>tools/labelator_renderer/README.md</code> — renderer package entry
            </li>
            <li>
              <code>tools/labelator_renderer/examples/basic_render/</code> — minimal local render example
            </li>
          </ul>
          <p>
            <Link href="/templates" className="text-[#1b4f9c] underline-offset-2 hover:underline">
              Browse templates in LABELATOR
            </Link>
            <span className="mx-2 text-muted-foreground">·</span>
            <a href="#quick-start" className="inline-flex items-center gap-1 text-[#1b4f9c] underline-offset-2 hover:underline">
              Back to Quick start
              <ArrowDown className="size-3.5 rotate-180" />
            </a>
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
      <div className="mt-3 space-y-3 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_li]:ml-4 [&_li]:list-disc [&_ol]:list-decimal [&_ol_li]:ml-4 [&_ol_li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:leading-relaxed [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}

function Step({ n, title, id, children }: { n: number; title: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6 rounded-lg border border-border px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Step {n}</span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="mt-2 space-y-2 [&_pre]:mt-2">{children}</div>
    </div>
  );
}

function FlowCard({ title, accent, children }: { title: string; accent: "design" | "production"; children: ReactNode }) {
  const tone =
    accent === "production"
      ? "border-[#1b4f9c]/25 bg-[#1b4f9c]/5"
      : "border-border bg-muted/40";
  return (
    <div className={`rounded-lg border px-4 py-3 ${tone}`}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="mt-2 text-[12px] leading-relaxed">{children}</div>
    </div>
  );
}

function CompareCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}
