import { isStaticExportBuild } from "@/lib/session";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(
    { error: "Use POST with email and password on a Node host." },
    { status: isStaticExportBuild() ? 404 : 405 },
  );
}

export async function POST(request: Request) {
  if (isStaticExportBuild()) {
    return Response.json({ error: "Cloud login is not available in the static app." }, { status: 404 });
  }
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const { signIn, auth } = await import("@/server/auth");
    await signIn("credentials", {
      email: body.email,
      password: body.password,
      redirect: false,
    });
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }
    return Response.json({ user: session.user });
  } catch {
    return Response.json({ error: "Could not sign in." }, { status: 401 });
  }
}
