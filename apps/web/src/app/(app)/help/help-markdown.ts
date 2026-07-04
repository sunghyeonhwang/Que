// 도움말 전용 경량 마크다운 → HTML 변환기.
// 지원: ## ### #### 제목, 문단, - * 목록(중첩), 1. 순서목록, | 표 |, ---, **강조**, `코드`, > 인용.
// 콘텐츠는 신뢰된 내부 산출물(사용자 입력 아님)이라 dangerouslySetInnerHTML로 렌더한다.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 인라인: 이스케이프 후 `코드`·**강조** 처리. */
function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

const indentOf = (l: string) => (l.match(/^ */)?.[0].length ?? 0);
const isUl = (l: string) => /^\s*[-*] /.test(l);
const isOl = (l: string) => /^\s*\d+\. /.test(l);
const isItem = (l: string) => isUl(l) || isOl(l);
const itemText = (l: string) => l.replace(/^\s*(?:[-*]|\d+\.) /, "");
const isHeading = (l: string) => /^#{2,4} /.test(l);
const isHr = (l: string) => /^---\s*$/.test(l.trim());
const isQuote = (l: string) => /^> /.test(l);
const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);

function isBlockStart(l: string): boolean {
  return isHeading(l) || isHr(l) || isItem(l) || isQuote(l) || isTableRow(l);
}

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  // 중첩 목록 파서: (i) → [html, nextIndex]
  function parseList(start: number): [string, number] {
    let j = start;
    const base = indentOf(lines[j]);
    const type = isOl(lines[j]) ? "ol" : "ul";
    let html = `<${type}>`;
    while (j < lines.length) {
      const line = lines[j];
      if (!line.trim()) {
        let k = j + 1;
        while (k < lines.length && !lines[k].trim()) k++;
        if (k < lines.length && isItem(lines[k]) && indentOf(lines[k]) >= base) {
          j = k;
          continue;
        }
        break;
      }
      if (!isItem(line) || indentOf(line) < base) break;
      if (indentOf(line) > base) break; // 상위 li에서 처리
      let text = itemText(line);
      j++;
      // 같은 항목에 붙는 다음 줄(목록 아님·들여쓰기)은 이어붙임
      while (j < lines.length && lines[j].trim() && !isItem(lines[j]) && indentOf(lines[j]) > base && !isBlockStart(lines[j].trim())) {
        text += " " + lines[j].trim();
        j++;
      }
      // 하위 목록(더 깊은 들여쓰기)
      let sub = "";
      if (j < lines.length && isItem(lines[j]) && indentOf(lines[j]) > base) {
        [sub, j] = parseList(j);
      }
      html += `<li>${inline(text)}${sub}</li>`;
    }
    html += `</${type}>`;
    return [html, j];
  }

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (isHeading(line)) {
      const m = /^(#{2,4}) (.*)$/.exec(line)!;
      const lvl = m[1].length; // 2~4
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++;
      continue;
    }
    if (isHr(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (isQuote(line)) {
      const buf: string[] = [];
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(lines[i].replace(/^> /, ""));
        i++;
      }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      out.push(`<div class="help-tbl"><table>${thead}${tbody}</table></div>`);
      continue;
    }
    if (isItem(line)) {
      const [html, next] = parseList(i);
      out.push(html);
      i = next;
      continue;
    }
    // 문단
    const buf = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i].trim())) {
      buf.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }

  return out.join("\n");
}
