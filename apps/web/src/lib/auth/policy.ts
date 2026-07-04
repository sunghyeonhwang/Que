// 비밀번호·로그인 보안 정책 상수와 순수 검증. verify.ts(로그인)·password.ts(변경)가 공유한다.

export const PASSWORD_MIN_LENGTH = 8;
/** 연속 로그인 실패 이 횟수를 넘기면 계정을 잠근다. */
export const LOGIN_LOCK_THRESHOLD = 5;
/** 잠금 지속 시간(분). */
export const LOGIN_LOCK_MINUTES = 15;

/**
 * 새 비밀번호 정책 검사. 통과면 null, 실패면 사용자에게 보여줄 한국어 메시지.
 * 8인 사내 도구라 복잡도 규칙은 최소로(길이·전부 같은 문자·이메일과 동일 금지).
 */
export function validateNewPassword(next: string, opts?: { email?: string }): string | null {
  if (next.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 해요.`;
  if (next.length > 200) return "비밀번호가 너무 길어요.";
  if (/^(.)\1+$/.test(next)) return "같은 문자만 반복한 비밀번호는 쓸 수 없어요.";
  const local = opts?.email?.split("@")[0]?.toLowerCase();
  if (local && next.toLowerCase() === local) return "이메일 아이디와 같은 비밀번호는 쓸 수 없어요.";
  return null;
}
