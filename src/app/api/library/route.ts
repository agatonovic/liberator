import { isLibrarySnapshot, readLibraryFile, writeLibraryFile } from "@/lib/library-file";
import { isStaticExportBuild } from "@/lib/session";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(await readLibraryFile());
}

export async function PUT(request: Request) {
  if (isStaticExportBuild()) {
    return Response.json({ error: "Library writes are not available in the static app." }, { status: 404 });
  }
  try {
    const body: unknown = await request.json();
    if (!isLibrarySnapshot(body)) {
      return Response.json({ error: "Invalid library snapshot." }, { status: 400 });
    }
    await writeLibraryFile(body);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not write library." }, { status: 500 });
  }
}
