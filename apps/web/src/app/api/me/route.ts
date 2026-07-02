import { withApi } from "@/lib/api/respond";

export async function GET(request: Request) {
  return withApi(request, ({ user }) => Response.json({ user }));
}
