/** 받침 유무에 따라 조사를 고른다. 예: josa("회의", "이", "가") → "가" */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return `${withBatchim}(${withoutBatchim})`;
  return (last - 0xac00) % 28 > 0 ? withBatchim : withoutBatchim;
}
