"use client";

import { useState } from "react";
import { createPaymentRequestAction } from "@/app/(app)/payments/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { DuePicker } from "@/components/app/due-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 결제 요청 등록 폼.
 * 분류(category)는 관리자가 관리하는 활성 분류 목록(`categories`)에서 고른다.
 * category는 문자열로 저장되므로(FK 아님) 선택된 값이 목록에 없어도 표시는 유지한다.
 */
export function PaymentForm({ categories }: { categories: string[] }) {
  const { run, pending } = useSafeAction();
  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  // 제출 시도 후에만 필수 에러를 노출한다(입력 전 침묵).
  const [touched, setTouched] = useState(false);

  // 선택된 값이 목록에 없으면(과거 값·보관된 분류) 선택지에 유지해 값이 사라지지 않게 한다.
  const options = category && !categories.includes(category) ? [category, ...categories] : categories;
  const categoryItems = Object.fromEntries(options.map((c) => [c, c]));
  const noCategories = categories.length === 0;

  // 필수 필드 검증(제목·은행명·계좌번호·금액·분류). 에러는 제출 시도 후에만 필드 아래 노출.
  const titleError = touched && !title.trim() ? "제목을 입력하세요." : null;
  const bankError = touched && !bankName.trim() ? "은행명을 입력하세요." : null;
  const accountError = touched && !accountNumber.trim() ? "계좌번호를 입력하세요." : null;
  const amountError = touched && !(Number(amount) > 0) ? "금액을 올바르게 입력하세요." : null;
  const categoryError =
    touched && !noCategories && !category.trim() ? "분류를 선택하세요." : null;

  const isValid =
    Boolean(title.trim()) &&
    Boolean(bankName.trim()) &&
    Boolean(accountNumber.trim()) &&
    Number(amount) > 0 &&
    Boolean(category.trim());

  const submit = () => {
    setTouched(true);
    if (!isValid || pending) return;
    run(
      () =>
        createPaymentRequestAction({
          title,
          recipientName: recipientName.trim() || undefined,
          bankName,
          accountNumber,
          amount: Number(amount),
          description: description || undefined,
          dueDate: dueDate || undefined,
          category,
        }),
      {
        success: "결제 요청이 대기 상태로 등록됐습니다.",
        onSuccess: () => {
          setTitle("");
          setRecipientName("");
          setBankName("");
          setAccountNumber("");
          setAmount("");
          setDescription("");
          setDueDate("");
          setTouched(false);
        },
      },
    );
  };

  return (
    <section className="flex h-fit flex-col rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <header className="border-b border-[var(--que-border)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--que-text)]">결제 요청 등록</h2>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <Field>
          <FieldLabel htmlFor="pay-title">
            제목
            <RequiredMark />
          </FieldLabel>
          <Input
            id="pay-title"
            value={title}
            aria-invalid={titleError ? true : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          {titleError && <p className="text-sm text-destructive">{titleError}</p>}
        </Field>
        <Field>
          <FieldLabel htmlFor="pay-recipient">입금받을 곳 (선택)</FieldLabel>
          <Input
            id="pay-recipient"
            value={recipientName}
            maxLength={100}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="상호·사람·기관명"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="pay-bank">
              은행명
              <RequiredMark />
            </FieldLabel>
            <Input
              id="pay-bank"
              value={bankName}
              aria-invalid={bankError ? true : undefined}
              onChange={(e) => setBankName(e.target.value)}
            />
            {bankError && <p className="text-sm text-destructive">{bankError}</p>}
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-account">
              계좌번호
              <RequiredMark />
            </FieldLabel>
            <Input
              id="pay-account"
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
            <FieldLabel htmlFor="pay-amount">
              금액 (원)
              <RequiredMark />
            </FieldLabel>
            <Input
              id="pay-amount"
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
          {noCategories ? (
            <p className="rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] px-3 py-2 text-xs text-[var(--que-text-tertiary)]">
              등록된 분류가 없습니다 — 관리자가 분류를 추가해야 합니다.
            </p>
          ) : (
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
          )}
          {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
        </Field>
        <Field>
          <FieldLabel htmlFor="pay-desc">내용</FieldLabel>
          <Textarea
            id="pay-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        {/* 비활성으로 침묵하지 않도록, 미입력이어도 클릭을 허용하고 제출 시 에러를 노출한다. */}
        <Button
          className="h-10 rounded-lg bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
          disabled={pending || noCategories}
          onClick={submit}
        >
          {pending ? "등록 중…" : "등록"}
        </Button>
      </div>
    </section>
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
