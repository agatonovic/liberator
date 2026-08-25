import { readLibraryFile } from "@/lib/library-file";

export const dynamic = "force-static";

export async function GET() {
  if (process.env.GITHUB_PAGES === "true") return Response.json(null);
  return Response.json(await readLibraryFile());
}
