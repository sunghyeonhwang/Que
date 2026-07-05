// 서버 런타임 타임존을 한국(KST)으로 고정한다.
//
// Vercel 서버리스 함수는 기본 UTC로 실행된다. 그러면 서버에서 `date.setHours(11)`처럼
// 만든 시각이 11:00 UTC로 저장되고, 브라우저(KST)에서 +9시간 어긋나 20:00으로 보인다
// (자연어 "오전 11시"가 "오후 8시"로 표시되던 버그). 하루 경계(dayStart/dayEnd) 계산도
// UTC 자정 기준이 되어 "오늘" 필터가 9시간 밀린다.
//
// 이 앱은 단일 타임존(한국) 8인 팀 전용이므로 서버 런타임 전체를 KST로 통일한다.
//
// 참고: Vercel은 `TZ`를 예약 환경변수로 막아 프로젝트 env로는 설정할 수 없다(항상 UTC).
// 그래서 서버 시작 시 코드에서 강제 설정한다 — Node는 process.env.TZ 재할당 시 이후 Date
// 연산부터 KST를 반영한다. instrumentation.register()는 앱의 다른 코드보다 먼저 실행된다.
export function register() {
  process.env.TZ = "Asia/Seoul";
}
