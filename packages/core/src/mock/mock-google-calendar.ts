import type { CalendarProvider, ExternalCalendarEvent } from "../calendar-provider";
import { USERS } from "./users";

// env(OAuth) 도착 전까지 쓰는 모의 Google Calendar 제공자.
// 실 GoogleCalendarProvider가 들어오면 이 파일을 그대로 대체한다(같은 인터페이스).

export class MockGoogleCalendarProvider implements CalendarProvider {
  readonly name = "google-mock";
  constructor(private readonly events: ExternalCalendarEvent[]) {}

  listEvents(rangeStart: Date, rangeEnd: Date): ExternalCalendarEvent[] {
    // 실 제공자는 기간으로 서버 측 필터링하겠지만, 모의는 시작 시각이 기간에 걸치는 것만 돌려준다.
    return this.events.filter((e) => {
      const s = new Date(e.startAt).getTime();
      return s >= rangeStart.getTime() && s <= rangeEnd.getTime();
    });
  }
}

/**
 * 데모용 기본 이벤트 묶음. now 기준 상대 시각이라 언제 실행해도 "이번 주"에 걸린다.
 * 시드에 이미 있는 회사 일정(google:ad-review 등)과 겹치도록 만들어, 재동기화 멱등성과
 * 시간 변경 감지(google:weekly-sync를 30분 늦춤)를 실제로 시연할 수 있게 한다.
 */
export function defaultMockGoogleEvents(now: Date): ExternalCalendarEvent[] {
  const [hwang, oh, , , , , riwon] = USERS;
  const at = (dayOffset: number, hour: number, minute = 0): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  return [
    // 시드의 evt-weekly-sync(google:weekly-sync)와 같은 외부 id지만 시작을 30분 늦춤 → "갱신"으로 감지돼야 한다
    {
      externalId: "google:weekly-sync",
      title: "주간 전체 회의",
      ownerId: hwang.id,
      startAt: at(1, 10, 0),
      endAt: at(1, 11, 0),
      attendeeIds: USERS.map((u) => u.id),
      visibility: "team",
    },
    // 시드에 없는 신규 일정 → "추가"로 감지돼야 한다
    {
      externalId: "google:townhall",
      title: "월간 타운홀",
      ownerId: oh.id,
      startAt: at(2, 16, 0),
      endAt: at(2, 17, 0),
      attendeeIds: USERS.map((u) => u.id),
      visibility: "team",
    },
    {
      externalId: "google:design-sync",
      title: "디자인 싱크",
      ownerId: riwon.id,
      startAt: at(3, 14, 0),
      endAt: at(3, 15, 0),
      visibility: "team",
    },
  ];
}
