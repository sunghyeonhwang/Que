import * as Sentry from "@sentry/nextjs";

// ⚠️ 임시: Sentry 연동 배포 검증용. 실제 이벤트를 보내고 flush 성공 여부를 반환한다.
// 검증 직후 제거한다(다음 커밋). 무해한 테스트 에러라 Sentry에 "테스트" 이슈만 남는다.
export const dynamic = "force-dynamic";

export async function GET() {
  const eventId = Sentry.captureException(
    new Error("Sentry 연동 확인용 테스트 (무시 가능)"),
  );
  const flushed = await Sentry.flush(4000);
  return Response.json({ captured: true, eventId, flushed });
}
