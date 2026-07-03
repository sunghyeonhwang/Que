import { z } from "zod";

// 회사 캘린더 연동의 이음매(seam) — 기획서 "회사 캘린더 연동"(Google Calendar 확정, 74~76행).
// 실 연동(OAuth)은 외부 계정/자격증명이 필요해 env 도착 전에는 붙일 수 없다. 그래서 지금은
// 자격증명과 무관하게 필요한 부분 — 제공자 인터페이스 + 멱등 동기화 엔진(mock-db) + mock 제공자 —
// 만 만든다. env가 오면 GoogleCalendarProvider(OAuth+API 호출)를 구현해 같은 인터페이스로 끼운다.

/** 외부 캘린더(예: Google)에서 읽어온 원본 일정 1건. Que 사용자 id로 매핑된 상태여야 한다. */
export const externalCalendarEventSchema = z.object({
  /** 제공자 측 안정적 식별자 — 재동기화 시 같은 일정을 매칭하는 키 (예: "google:ad-review") */
  externalId: z.string().min(1),
  title: z.string().min(1),
  ownerId: z.string().min(1),
  startAt: z.iso.datetime({ offset: true }),
  endAt: z.iso.datetime({ offset: true }),
  attendeeIds: z.array(z.string()).optional(),
  visibility: z.enum(["team", "private"]).optional(),
});
export type ExternalCalendarEvent = z.infer<typeof externalCalendarEventSchema>;

/**
 * 회사 캘린더 제공자. 실 연동/모의 모두 이 인터페이스를 구현한다.
 * - name: 이벤트 출처 태그(로그·디버깅용). 예: "google-mock", "google".
 * - listEvents: 주어진 기간의 외부 일정을 반환. 실 구현은 비동기(API 호출)라 Promise를 허용한다.
 */
export interface CalendarProvider {
  readonly name: string;
  listEvents(
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<ExternalCalendarEvent[]> | ExternalCalendarEvent[];
}
