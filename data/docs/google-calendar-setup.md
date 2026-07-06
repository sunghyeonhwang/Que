# 구글 캘린더 연동 — Google Cloud / Workspace 설정 체크리스트

> 확정 방향(2026-07-06): **양방향 · 각 개인 캘린더(8명 각자) · 도메인 전체 위임(Domain-Wide Delegation)**
> griff.co.kr이 Google Workspace(관리형 @griff.co.kr)이므로, 서비스 계정 하나에 도메인 위임을 부여하면
> 서버가 각 직원을 대신해 개인 캘린더를 읽고/씁니다(사용자별 OAuth 클릭 불필요).

## 준비 (사용자)

### 1) Google Cloud Console (관리자/대표 계정)
1. 프로젝트 생성 또는 기존 선택
2. **Google Calendar API 활성화** — API 및 서비스 → 라이브러리 → "Google Calendar API" → 사용 설정
3. **서비스 계정 생성** — IAM 및 관리자 → 서비스 계정 → 만들기 (이름 예: `que-calendar-sync`)
4. **JSON 키 발급** — 그 서비스 계정 → 키 → 키 추가 → **JSON** → 다운로드(안전 보관, 절대 커밋 금지)
5. 그 서비스 계정에서 **"도메인 전체 위임 사용 설정"** → 생성된 **클라이언트 ID**(숫자열) 확인

### 2) Google Workspace 관리자 콘솔 (admin.google.com — 워크스페이스 관리자 권한 필요)
6. 보안 → 액세스/데이터 제어 → **API 제어 → 도메인 전체 위임 → 새로 추가**
7. 위 **클라이언트 ID** 입력 + OAuth 스코프에 `https://www.googleapis.com/auth/calendar` 추가 → 승인

### 3) 환경변수 등록 (사용자가 직접 Vercel에 — 담당 개발자는 키 값을 보지 않음)
- `GOOGLE_SERVICE_ACCOUNT_KEY` = JSON 키 내용(또는 base64 인코딩)
- 캘린더 ID 불필요 — 각 직원의 이메일로 개인 primary 캘린더에 접근(직원 이메일은 명단 DB화 완료분에서 가져옴)

## 양방향 동작 (도메인 규칙 정합)
- **가져오기**: 구글 개인 일정 → que에 표시(외부 원본이라 que에서 수정 불가·읽기 전용)
- **내보내기**: que에서 그 사람에게 배정된 일정 → 그 사람 구글 캘린더로 반영
- que가 구글 원본을 덮어쓰지 않음(CLAUDE.md "외부 회사 캘린더 원본 일정·비공개 자리비움 수정 불가" 준수)

## 대안 — Workspace 관리자 콘솔 접근이 안 될 때
관리형 Workspace가 아니거나 관리자 권한이 없으면 도메인 위임을 못 씀. 그 경우:
- **사용자별 OAuth**: 직원이 que에서 "구글 캘린더 연결" 버튼 → 각자 Google 동의 → que가 refresh token 저장.
- 설정 항목이 바뀜(OAuth 2.0 클라이언트 ID/시크릿 · 동의 화면 · 리디렉션 URI `.../api/auth/google/callback`). 필요 시 이 방식으로 재설계.

## 구현 시작 조건
위 env 등록 완료를 알리면, 8명 각자 캘린더 **가져오기/내보내기 + 10분 주기 동기화**를 구현.
(기존 `packages/core/src/mock/mock-google-calendar.ts` · `calendar_events` 테이블 배선 재사용, source="company" 외부 원본 읽기전용 유지.)
