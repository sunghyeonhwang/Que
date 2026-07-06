"use client";

import { useState, useTransition } from "react";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { CreateUserInput, Rank, UserRole } from "@que/core";
import { createStaffAction } from "@/app/(app)/settings/staff/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "@/components/app/use-safe-action";
import { cn } from "@/lib/utils";

const EMAIL_DOMAIN = "@griff.co.kr";
const ROLE_ITEMS: Record<string, string> = { member: "멤버", admin: "관리자" };
const RANK_ITEMS: Record<string, string> = { 대표: "대표", 관리: "관리", 사원: "사원" };

type Errors = Partial<Record<"name" | "email" | "rank", string>>;

/** 직원 추가 폼 — 관리자만. 성공 시 임시비번을 상위로 올려 1회 표시 다이얼로그를 띄운다. */
export function StaffAddForm({
  palette,
  usedColors,
  suggestedColor,
  onCreated,
}: {
  palette: string[];
  usedColors: string[];
  suggestedColor: string;
  onCreated: (info: { password: string; userName: string }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const [rank, setRank] = useState<Rank>("사원");
  const [department, setDepartment] = useState("");
  const [color, setColor] = useState(suggestedColor);
  const [errors, setErrors] = useState<Errors>({});

  const used = new Set(usedColors);

  function validate(): CreateUserInput | null {
    const next: Errors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) next.name = "이름을 입력하세요.";
    else if (trimmedName.length > 50) next.name = "이름은 50자 이내여야 합니다.";
    if (!trimmedEmail) next.email = "이메일을 입력하세요.";
    else if (!trimmedEmail.endsWith(EMAIL_DOMAIN))
      next.email = `회사 이메일(${EMAIL_DOMAIN})만 등록할 수 있습니다.`;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      next.email = "올바른 이메일 형식이 아닙니다.";
    if (!rank) next.rank = "직급을 선택하세요.";
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return {
      name: trimmedName,
      email: trimmedEmail,
      role,
      rank,
      department: department.trim() || undefined,
      avatarColor: color,
    };
  }

  function submit() {
    const data = validate();
    if (!data) return;
    startTransition(async () => {
      try {
        const res = await createStaffAction(data);
        if (res.ok) {
          onCreated({ password: res.tempPassword, userName: res.user.name });
          setName("");
          setEmail("");
          setRole("member");
          setRank("사원");
          setDepartment("");
          setErrors({});
        } else {
          toast.error(res.error);
        }
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  }

  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <UserPlus className="size-[18px]" aria-hidden />
        </span>
        직원 추가
      </h2>
      <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
        추가하면 임시 비밀번호가 1회 발급됩니다. 삭제 대신 비활성/복구로 관리합니다.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="staff-name">이름</FieldLabel>
          <Input
            id="staff-name"
            className="h-10"
            placeholder="예: 홍길동"
            value={name}
            aria-invalid={!!errors.name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="text-xs text-[var(--que-error)]">{errors.name}</p>}
        </Field>

        <Field>
          <FieldLabel htmlFor="staff-email">이메일</FieldLabel>
          <Input
            id="staff-email"
            className="h-10"
            type="email"
            placeholder={`이름${EMAIL_DOMAIN}`}
            value={email}
            aria-invalid={!!errors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <p className="text-xs text-[var(--que-error)]">{errors.email}</p>}
        </Field>

        <Field>
          <FieldLabel>역할</FieldLabel>
          <Select
            items={ROLE_ITEMS}
            value={role}
            onValueChange={(v) => v && setRole(v as UserRole)}
          >
            <SelectTrigger aria-label="역할 선택" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">멤버</SelectItem>
              <SelectItem value="admin">관리자</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>직급</FieldLabel>
          <Select items={RANK_ITEMS} value={rank} onValueChange={(v) => v && setRank(v as Rank)}>
            <SelectTrigger aria-label="직급 선택" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="대표">대표</SelectItem>
              <SelectItem value="관리">관리</SelectItem>
              <SelectItem value="사원">사원</SelectItem>
            </SelectContent>
          </Select>
          {errors.rank && <p className="text-xs text-[var(--que-error)]">{errors.rank}</p>}
        </Field>

        <Field>
          <FieldLabel htmlFor="staff-dept">부서</FieldLabel>
          <Input
            id="staff-dept"
            className="h-10"
            placeholder="예: 디자인 (임시값, 나중에 편집)"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel>구분 색상</FieldLabel>
          <div className="flex flex-wrap gap-2 pt-1">
            {palette.map((c) => {
              const isUsed = used.has(c);
              const selected = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`색상 ${c}${isUsed ? " (사용 중)" : " (미사용, 추천)"}`}
                  aria-pressed={selected}
                  title={isUsed ? "이미 쓰는 색" : "미사용 색(추천)"}
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-full transition-transform",
                    selected
                      ? "ring-2 ring-[var(--que-brand)] ring-offset-2"
                      : "hover:scale-105",
                  )}
                  style={{ backgroundColor: c }}
                >
                  {selected && <Check className="size-4 text-white" aria-hidden />}
                  {isUsed && !selected && (
                    <span className="absolute inset-0 rounded-full border-2 border-dashed border-white/70" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--que-text-tertiary)]">
            점선 표시는 이미 다른 직원이 쓰는 색입니다. 미사용 색을 추천합니다.
          </p>
        </Field>
      </div>

      <Button className="mt-4 h-10 w-fit" disabled={pending} onClick={submit}>
        {pending ? "추가하는 중…" : "직원 추가"}
      </Button>
    </section>
  );
}
