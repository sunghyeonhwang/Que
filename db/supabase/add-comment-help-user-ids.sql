-- Que — task_comments 도움 대상 다중(help_user_ids) 추가 (additive, 2026-07-11)
-- statusLog 선례(add-status-log-help-user-ids.sql)와 동일 패턴:
-- 신규 댓글은 helpUserIds 배열 + 첫 대상을 help_user_id(FK·하위호환)에 복제.
-- 읽기는 core helpUserIdsOf가 단일/다중을 통일한다.
-- ✅ 프로덕션 기적용(2026-07-11, supabase migration 'add_comment_help_user_ids') — idempotent.

alter table task_comments add column if not exists help_user_ids text[];
