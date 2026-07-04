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

const CATEGORIES = ["구독", "물류", "라이선스", "외주", "교육", "기타"];
const CATEGORY_ITEMS = Object.fromEntries(CATEGORIES.map((c) => [c, c]));

/** 결제 요청 등록 폼. */
export function PaymentForm() {
  const { run, pending } = useSafeAction();
  const [title, setTitle] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("기타");

  const canSubmit =
    title.trim() && bankName.trim() && accountNumber.trim() && Number(amount) > 0 && !pending;

  const submit = () => {
    run(
      () =>
        createPaymentRequestAction({
          title,
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
          <Select
            items={CATEGORY_ITEMS}
            value={category}
            onValueChange={(v) => setCategory(v ?? "기타")}
          >
            <SelectTrigger aria-label="분류 선택">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          className="h-10 rounded-lg bg-[var(--que-brand)] text-white hover:bg-[var(--que-brand-hover)]"
          disabled={!canSubmit}
          onClick={submit}
        >
          {pending ? "등록 중…" : "등록"}
        </Button>
      </div>
    </section>
  );
}
