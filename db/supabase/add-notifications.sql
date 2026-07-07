-- Que — 알림 아웃박스(notification_outbox) 추가 마이그레이션 (additive)
-- 기준: data/docs/que-roadmap-plan.md "B-1 · Slack Webhook 알림(1단계)" + packages/core/src/notifications.ts
-- 성격: 무파괴 additive. 신규 테이블 1개 + 인덱스. 기존 14개 테이블 규약(schema.sql)과 동일 스타일.
--
-- 목적: Slack Incoming Webhook 발송의 원장(ledger). 서버리스(Vercel)에는 상주 프로세스가 없어
--       waitUntil이 보장되지 않으므로, 발송 의도를 여기에 적재(enqueue)하고 크론이 드레인한다.
--       dedup_key UNIQUE가 "서버리스 중복 발송 방지"의 핵심 — 재요청·크론 재실행에도 이벤트당 1건.
--
-- 발송/드레인/훅 배선은 다음 단계(dispatch·cron·slack 어댑터)에서 붙인다. 이 파일은 저장소만 만든다.

begin;

create table if not exists notification_outbox (
  id          text primary key,
  -- 이벤트 유일키. 같은 이벤트의 중복 적재를 DB 레벨에서 차단(ON CONFLICT DO NOTHING의 앵커).
  -- 예: 'issue:<taskId>:<marker>' · 'on_hold:<taskId>:<marker>' · 'deadline:<taskId>:<dueBucket>'
  dedup_key   text not null unique,
  kind        text not null check (kind in ('issue', 'on_hold', 'deadline')),
  entity_type text not null,
  entity_id   text not null,
  -- 1단계는 팀 채널 단일 발송이라 수신자 미지정(NULL). 2단계 Bot에서 개인 멘션 매핑 시 사용.
  recipient   text,
  -- 발송 페이로드: { title, text, deeplinkPath, tone(red|amber|violet) }. deeplink 베이스 URL은 web 계층 주입.
  payload     jsonb not null,
  status      text not null default 'pending'
                check (status in ('pending', 'held', 'sent', 'skipped', 'failed')),
  attempts    integer not null default 0 check (attempts >= 0),
  -- 방해금지(quiet hours) 보류 해제 시각. NULL이면 즉시 대상.
  hold_until  timestamptz,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

-- 드레인 쿼리(pending/held 스캔)용. 상태 + 생성순.
create index if not exists idx_notification_outbox_status on notification_outbox (status, created_at);
-- 보류 해제 스캔용(held 중 hold_until 경과분).
create index if not exists idx_notification_outbox_hold on notification_outbox (hold_until)
  where status = 'held';

commit;
