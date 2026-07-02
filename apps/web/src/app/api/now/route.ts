import { withApi } from "@/lib/api/respond";
import { getNowData, type NowFilter } from "@/lib/now-data";

/** Now 운영표 — MCP get_now_board 도구의 백엔드. */
export async function GET(request: Request) {
  return withApi(request, ({ user }) => {
    const value = new URL(request.url).searchParams.get("filter");
    const filter: NowFilter = value === "mine" || value === "issue" ? value : "all";
    return Response.json(getNowData(user, filter));
  });
}
