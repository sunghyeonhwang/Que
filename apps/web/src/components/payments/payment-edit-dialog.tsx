"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updatePaymentRequestAction } from "@/app/(app)/payments/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { DuePicker } from "@/components/app/due-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentRow } from "@/lib/payment-data";

/**
 * 결제 요청 내역 수정 다이얼로그.
 * - 진입점(연필 버튼)은 대기 상태 + 등록자 본인/관리자에게만 노출한다(row.canEdit). 서버가 최종 방어.
 * - 계좌번호·금액은 수정 가능한 뷰어(관리자·요청자)에게 원본이 이미 내려오므로(accountNumberForCopy·
 *   amountForCopy) 그대로 프리필한다 — 마스킹값을 다시 조회하지 않는다.
 * - 저장 시 변경된 필드만 액션에 전달한다(미변경=undefined). 마감일은 빈 문자열("")로 제거를 지원한다.
 */
export function PaymentEditDialog({
  row,
  categories,
}: {
  row: PaymentRow;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`"${row.title}" 결제 요청 수정`}
                  className="size-10 shrink-0 rounded-lg text-[var(--que-text-tertiary)] hover:text-[var(--que-text)]"
                />
              }
            />
          }
        >
          <Pencil className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>수정</TooltipContent>
      </Tooltip>
      {/* key로 열 때마다 폼 상태를 원본 값으로 리셋한다. */}
      {open && (
        <EditForm
          key={row.id}
          row={row}
          categories={categories}
          onDone={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}

function EditForm({
  row,
  categories,
  onDone,
}: {
  row: PaymentRow;
  categories: string[];
  onDone: () => void;
}) {
  const { run, pending } = useSafeAction();
  const [title, setTitle] = useState(row.title);
  const [recipientName, setRecipientName] = useState(row.recipientName ?? "");
  const [bankName, setBankName] = useState(row.bankName);
  // 수정 가능한 뷰어에겐 원본이 내려오므로 그대로 프리필(폴백은 안전용).
  const [accountNumber, setAccountNumber] = useState(row.accountNumberForCopy ?? "");
  const [amount, setAmount] = useState(
    row.amountForCopy !== undefined ? String(row.amountForCopy) : "",
  );
  const [description, setDescription] = useState(row.description ?? "");
  const [dueDate, setDueDate] = useState(row.dueDateKey ?? "");
  const [category, setCategory] = useState(row.category);
  const [touched, setTouched] = useState(false);

  // 선택된 값이 목록에 없으면(보관된 분류 등) 선택지에 유지한다.
  const options =
    category && !categories.includes(category) ? [category, ...categories] : categories;
  const categoryItems = Object.fromEntries(options.map((c) => [c, c]));

  const titleError = touched && !title.trim() ? "제목을 입력하세요." : null;
  const bankError = touched && !bankName.trim() ? "은행명을 입력하세요." : null;
  const accountError = touched && !accountNumber.trim() ? "계좌번호를 입력하세요." : null;
  const amountError = touched && !(Number(amount) > 0) ? "금액을 올바르게 입력하세요." : null;
  const categoryError = touched && !category.trim() ? "분류를 선택하세요." : null;

  const isValid =
    Boolean(title.trim()) &&
    Boolean(bankName.trim()) &&
    Boolean(accountNumber.trim()) &&
    Number(amount) > 0 &&
    Boolean(category.trim());

  // 변경된 필드만 골라 payload를 만든다(미변경=undefined). dueDate는 ""로 마감일 제거 지원.
  const buildDiff = () => {
    const diff: Parameters<typeof updatePaymentRequestAction>[0] = { paymentId: row.id };
    if (title.trim() !== row.title) diff.title = title.trim();
    if (bankName.trim() !== row.bankName) diff.bankName = bankName.trim();
    if (accountNumber.trim() !== (row.accountNumberForCopy ?? ""))
      diff.accountNumber = accountNumber.trim();
    if (Number(amount) !== row.amountForCopy) diff.amount = Number(amount);
    if (category !== row.category) diff.category = category;
    if (recipientName.trim() !== (row.recipientName ?? ""))
      diff.recipientName = recipientName.trim();
    if (description.trim() !== (row.description ?? "")) diff.description = description.trim();
    if (dueDate !== (row.dueDateKey ?? "")) diff.dueDate = dueDate;
    return diff;
  };

  const submit = () => {
    setTouched(true);
    if (!isValid || pending) return;
    const diff = buildDiff();
    // paymentId 외에 바뀐 게 없으면 서버 호출 없이 안내만.
    if (Object.keys(diff).length <= 1) {
      toast.info("변경된 내용이 없습니다.");
      return;
    }
    run(() => updatePaymentRequestAction(diff), {
      success: "수정했습니다 — 변경 내역은 기록에 남습니다.",
      onSuccess: onDone,
    });
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>결제 요청 수정</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="edit-title">
            제목
            <RequiredMark />
          </FieldLabel>
          <Input
            id="edit-title"
            value={title}
            aria-invalid={titleError ? true : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          {titleError && <p className="text-sm text-destructive">{titleError}</p>}
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-recipient">입금받을 곳 (선택)</FieldLabel>
          <Input
            id="edit-recipient"
            value={recipientName}
            maxLength={100}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="상호·사람·기관명"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="edit-bank">
              은행명
              <RequiredMark />
            </FieldLabel>
            <Input
              id="edit-bank"
              value={bankName}
              aria-invalid={bankError ? true : undefined}
              onChange={(e) => setBankName(e.target.value)}
            />
            {bankError && <p className="text-sm text-destructive">{bankError}</p>}
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-account">
              계좌번호
              <RequiredMark />
            </FieldLabel>
            <Input
              id="edit-account"
              value={accountNumber}
              aria-invalid={accountError ? true : undefined}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="000-000-000000"
            />
            {accountError && <p className="text-sm text-destructive">{accountError}</p>}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="edit-amount">
              금액 (원)
              <RequiredMark />
            </FieldLabel>
            <Input
              id="edit-amount"
              type="number"
              min={1}
              value={amount}
              aria-invalid={amountError ? true : undefined}
              onChange={(e) => setAmount(e.target.value)}
            />
            {amountError && <p className="text-sm text-destructive">{amountError}</p>}
          </Field>
          <Field>
            <FieldLabel>마감일</FieldLabel>
            <DuePicker
              dueDate={dueDate}
              dueTime=""
              showTime={false}
              emptyLabel="마감일 미정"
              onSelectDate={setDueDate}
              onSelectDueTime={() => {}}
              onClear={() => setDueDate("")}
              triggerAriaLabel="결제 마감일 설정"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>
            분류
            <RequiredMark />
          </FieldLabel>
          <Select
            items={categoryItems}
            value={category}
            onValueChange={(v) => setCategory(v ?? "")}
          >
            <SelectTrigger className="h-10 w-full" aria-label="분류 선택">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-desc">내용</FieldLabel>
          <Textarea
            id="edit-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>

      <DialogFooter>
        <DialogClose
          render={<Button type="button" variant="outline" className="h-10 rounded-lg" />}
        >
          닫기
        </DialogClose>
        <Button
          type="button"
          className="h-10 rounded-lg bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "저장 중…" : "저장"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** 필수 필드 표시 — 시각 별표(*) + 스크린리더용 '(필수)'. */
function RequiredMark() {
  return (
    <>
      <span className="ml-0.5 text-[var(--que-error)]" aria-hidden>
        *
      </span>
      <span className="sr-only">(필수)</span>
    </>
  );
}
