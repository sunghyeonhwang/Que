"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPaymentRequestAction } from "@/app/(app)/payments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
    startTransition(async () => {
      const result = await createPaymentRequestAction({
        title,
        bankName,
        accountNumber,
        amount: Number(amount),
        description: description || undefined,
        dueDate: dueDate || undefined,
        category,
      });
      if (result.ok) {
        toast.success("결제 요청이 대기 상태로 등록됐습니다.");
        setTitle("");
        setBankName("");
        setAccountNumber("");
        setAmount("");
        setDescription("");
        setDueDate("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">결제 요청 등록</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
        <Button className="h-10" disabled={!canSubmit} onClick={submit}>
          {pending ? "등록 중…" : "등록"}
        </Button>
      </CardContent>
    </Card>
  );
}
