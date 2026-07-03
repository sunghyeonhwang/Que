import { withApi } from "@/lib/api/respond";
import { getTeamData } from "@/lib/team-data";

/** 팀 현황 — MCP get_team_status 도구의 백엔드. */
export async function GET(request: Request) {
  return withApi(request, async ({ user }) => Response.json(await getTeamData(user)));
}
