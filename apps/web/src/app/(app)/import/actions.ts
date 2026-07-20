"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  buildImportPlan,
  executeScheduleImport,
  type ImportPlan,
  type ImportResult,
} from "@/lib/schedule-import";

// 일정시트 임포트 — 서버 액션. 원본 YAML 텍스트를 받아 서버에서 파싱→계획→core mutation까지
// 전부 수행한다(클라이언트 계획 신뢰 금지 — execute는 서버에서 계획을 재수립한다).
// - preview: 실행 없이 계획(dry-run)만. 등록 전 확인 카드 원칙(CLAUDE.md)의 YAML판.
// - execute: 계획 재수립 → errors 있으면 거부 → core 경유 일괄 생성(ChangeLog via:"web").
// 둘 다 관리자 전용. 개별 mutation 권한(클라이언트 생성=관리자 등)은 core가 이중 강제한다.

type PreviewResult = { ok: true; plan: ImportPlan } | { ok: false; error: string };
type ExecuteResult = { ok: true; result: ImportResult } | { ok: false; error: string };

/** 실행 없이 계획만 만든다. errors가 있어도 { ok:true, plan }으로 돌려주고(계획 안에 errors 노출),
 *  액션 자체의 { ok:false }는 권한 거부·예기치 못한 예외에만 쓴다. */
export async function previewScheduleImportAction(yamlText: string): Promise<PreviewResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") return { ok: false, error: "관리자만 사용할 수 있습니다." };
  try {
    const db = await getDb();
    const plan = buildImportPlan(db, user, yamlText);
    return { ok: true, plan };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error; // NEXT_REDIRECT(미인증) 등은 전파
  }
}

/** 계획을 서버에서 재수립해 일괄 생성한다. getDb 한 번 → mutation 전부 → persist 1회 → 재검증. */
export async function executeScheduleImportAction(yamlText: string): Promise<ExecuteResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") return { ok: false, error: "관리자만 사용할 수 있습니다." };
  try {
    const db = await getDb();
    const result = executeScheduleImport(db, user, yamlText);
    await db.persist();
    revalidatePath("/projects");
    revalidatePath("/planning");
    revalidatePath("/schedule");
    revalidatePath("/today");
    revalidatePath("/now");
    revalidatePath("/clients");
    return { ok: true, result };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error; // NEXT_REDIRECT · 예상 밖 예외는 삼키지 않는다
  }
}
