import { withApi } from "@/lib/api/respond";
import { getTodayData } from "@/lib/today-data";

/** 오늘 화면 요약 — MCP get_my_day 도구의 백엔드. */
export async function GET(request: Request) {
  return withApi(request, ({ user }) => Response.json(getTodayData(user)));
}
