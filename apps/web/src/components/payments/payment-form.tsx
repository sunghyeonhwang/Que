"use client";

import { useState } from "react";
import { createPaymentRequestAction } from "@/app/(app)/payments/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
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

  // 선택된 값이 목록에 없으면(과거 값·보관된 분류) 선택지에 유지해 값이 사라지지 않게 한다.
  const options = category && !categories.includes(category) ? [category, ...categories] : categories;
  const categoryItems = Object.fromEntries(options.map((c) => [c, c]));
  const noCategories = categories.length === 0;

  const canSubmit =
    title.trim() &&
    bankName.trim() &&
    accountNumber.trim() &&
    Number(amount) > 0 &&
    category.trim() &&
    !pending;

  const submit = () => {
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
          <FieldLabel htmlFor="pay-title">제목</FieldLabel>
          <Input id="pay-title" value={title} onChange={(e) => setTitle(e.target.value)} />
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
            <FieldLabel htmlFor="pay-bank">은행명</FieldLabel>
            <Input id="pay-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-account">계좌번호</FieldLabel>
            <Input
              id="pay-account"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="000-000-000000"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="pay-amount">금액 (원)</FieldLabel>
            <Input
              id="pay-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pay-due">마감일</FieldLabel>
            <Input
              id="pay-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>분류</FieldLabel>
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
        <Button
          className="h-10 rounded-lg bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
          disabled={!canSubmit}
          onClick={submit}
        >
          {pending ? "등록 중…" : "등록"}
        </Button>
      </div>
    </section>
  );
}
