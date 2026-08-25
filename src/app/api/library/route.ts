import { readLibraryFile } from "@/lib/library-file";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(await readLibraryFile());
}
