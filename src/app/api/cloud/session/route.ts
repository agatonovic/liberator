import { isStaticExportBuild } from "@/lib/session";

export const dynamic = "force-static";

export async function GET() {
  if (isStaticExportBuild()) {
    return Response.json({ mode: "static", available: false });
  }
  try {
    const { auth } = await import("@/server/auth");
    const session = await auth();
    return Response.json({
      mode: "server",
      available: true,
      user: session?.user ?? null,
    });
  } catch {
    return Response.json({ mode: "server", available: false, user: null });
  }
}
