"use client";

import { useState } from "react";
import type { ManagedUser } from "@/lib/users-admin";
import { StaffAddForm } from "@/components/settings/staff/staff-add-form";
import { StaffEditDialog } from "@/components/settings/staff/staff-edit-dialog";
import { StaffRoleDialog } from "@/components/settings/staff/staff-role-dialog";
import { StaffTable } from "@/components/settings/staff/staff-table";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/settings/staff/temp-password-dialog";

/**
 * 직원 관리(관리자 전용) 클라이언트 셸 — 목록 표 + 추가 폼 + 임시비번 1회 표시 다이얼로그.
 * 임시비번은 서버 액션 반환값으로만 흘러 이 컴포넌트의 로컬 state에만 잠깐 머문다(저장/로그 없음).
 */
export function StaffManager({
  users,
  currentUserId,
  palette,
  usedColors,
  suggestedColor,
}: {
  users: ManagedUser[];
  currentUserId: string;
  palette: string[];
  usedColors: string[];
  suggestedColor: string;
}) {
  const [tempPassword, setTempPassword] = useState<TempPasswordInfo | null>(null);
  // 편집·권한 다이얼로그의 대상(열림 = 대상 !== null). 데이터는 서버 revalidate로 새로고침된다.
  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<ManagedUser | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <StaffAddForm
        palette={palette}
        usedColors={usedColors}
        suggestedColor={suggestedColor}
        onCreated={(info) => setTempPassword({ ...info, mode: "create" })}
      />
      <StaffTable
        users={users}
        currentUserId={currentUserId}
        onTempPassword={(info) => setTempPassword({ ...info, mode: "reset" })}
        onEdit={setEditTarget}
        onRole={setRoleTarget}
      />
      <TempPasswordDialog info={tempPassword} onClose={() => setTempPassword(null)} />
      <StaffEditDialog
        user={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      />
      <StaffRoleDialog
        user={roleTarget}
        onOpenChange={(open) => {
          if (!open) setRoleTarget(null);
        }}
      />
    </div>
  );
}
