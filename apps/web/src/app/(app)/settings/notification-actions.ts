"use server";

import { getCurrentUser } from "@/lib/current-user";
import {
  MUTABLE_KINDS,
  getMutedKinds,
  setMutedKinds,
  notificationPrefsEnabled,
  type MutableKindMeta,
} from "@/lib/notifications/prefs";

// 설정 > 알림: 본인 알림 개인 설정 조회·저장. 전부 getCurrentUser 게이트 + userId 스코프(본인 것만).
// 저장은 prefs.ts가 MUTABLE 화이트리스트로 재검증하므로, 클라이언트가 임의 kind를 보내도 조용히 걸러진다.

/** UI 계약: 끌 수 있는 알림 목록(옵션) + 현재 이 유저가 끈 kind 목록. */
export interface MyNotificationPrefs {
  /** 개인이 끌 수 있는 알림(라벨·설명 포함) — 체크박스 목록 렌더용. */
  options: MutableKindMeta[];
  /** 현재 끈(muted) kind 목록. options.kind의 부분집합. */
  mutedKinds: string[];
  /** 기능 활성 여부(mock/dev면 false → UI가 '실 배포에서만 동작' 안내 가능). */
  enabled: boolean;
}

/** 본인 알림 개인 설정 조회. */
export async function getMyNotificationPrefs(): Promise<MyNotificationPrefs> {
  const me = await getCurrentUser();
  const muted = await getMutedKinds(me.id);
  return {
    options: [...MUTABLE_KINDS],
    mutedKinds: [...muted],
    enabled: notificationPrefsEnabled(),
  };
}

export type NotificationPrefsResult = { ok: true } | { ok: false; error: string };

/** 본인 알림 개인 설정 저장(끈 kind 목록 전체 교체). MUTABLE 외 값은 prefs.ts가 조용히 제거. */
export async function setMyNotificationPrefs(
  mutedKinds: string[],
): Promise<NotificationPrefsResult> {
  const me = await getCurrentUser();
  const list = Array.isArray(mutedKinds) ? mutedKinds.filter((k) => typeof k === "string") : [];
  const ok = await setMutedKinds(me.id, list);
  if (!ok) {
    return { ok: false, error: "알림 설정 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }
  return { ok: true };
}
