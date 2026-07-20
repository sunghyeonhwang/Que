# Que 일정 임포트 양식 (v1)

다른 프로젝트(레포·문서·툴)의 마일스톤과 일정을 Que로 가져올 때 쓰는 양식이다.
**다른 Claude Code 세션이 이 파일의 YAML을 채우고**, 완성본을 Que 세션에 붙여넣으면
Que 세션이 등록 전 요약(확인 카드 원칙)을 보여준 뒤 core 경유로 생성한다.

## 작성 규칙 (채우는 쪽 필독)

- **추정 금지.** 근거(코드·문서·이슈·커밋)를 찾을 수 없는 값은 빈칸으로 두고 `questions:`에 질문으로 남긴다.
- 모든 날짜는 **KST**, `YYYY-MM-DD`. 시각은 24시간 `HH:mm`. 시각을 모르면 생략(시작 09:00·마감 18:00으로 등록됨). 심야(01:00~05:59) 시각은 쓰지 않는다.
- `assignee`(담당자)는 아래 로스터의 **이름 그대로**만. 목록에 없는 사람·불확실하면 빈칸(미지정 → 등록자에게 배정됨).
  - 로스터: 황성현 · 오승훈 · 황성진 · 박승환 · 송수용 · 이예진 · 김리원 · 이혜진
- `depends_on`(선행 작업)은 **이 양식 안의 다른 task `title`**만 참조한다(같은 프로젝트 내 연결만 가능, 순환 금지).
- `priority`는 `high | normal | low`만. 모르면 `normal`.
- 필드를 추가·개명하지 않는다. 항목이 없으면 배열을 비워둔다(`[]`).
- 이미 지난 날짜여도 사실이면 그대로 적는다(완료 이력 임포트 가능).

## 양식

```yaml
meta:
  source_project: ""        # 출처(예: "그리프 3Q 마케팅 시트", "acme-web 레포")
  filled_by: ""             # 채운 주체(예: "Claude Code @ acme-web")
  filled_at: ""             # YYYY-MM-DD

client:
  name: ""                  # Que 클라이언트(거래처)명. 사내 잡무면 빈칸
  create_if_missing: true   # Que에 없으면 새로 만들지

project:
  name: ""                  # 필수 — Que 프로젝트명
  description: ""
  create_if_missing: true

milestones:                 # 프로젝트 마일스톤(기한이 있는 굵직한 지점)
  - title: ""               # 필수
    due: ""                 # 필수 YYYY-MM-DD
    due_time: ""            # 생략 시 18:00
    critical: false         # 최종 런칭일 등 절대 밀리면 안 되는 것만 true

tasks:                      # 작업(간트 막대·작업 목록에 뜨는 단위)
  - title: ""               # 필수, 200자 이내
    assignee: ""            # 로스터 이름 or 빈칸
    start: ""               # YYYY-MM-DD, 생략 가능
    start_time: ""          # 생략 시 09:00
    due: ""                 # YYYY-MM-DD, 생략 가능(둘 다 없으면 간트에 안 뜨고 목록에만)
    due_time: ""            # 생략 시 18:00
    priority: normal        # high | normal | low
    estimated_hours:        # 숫자(시간 단위), 모르면 생략
    status: scheduled       # scheduled(예정) | in_progress | done — 과거 이력이면 done
    description: ""
    depends_on: []          # 선행 작업 title 배열(이 양식 안에서만)

events:                     # 회의 등 "하루 안의 시간대" 일정(선택)
  - title: ""
    date: ""                # YYYY-MM-DD
    start_time: ""          # HH:mm 필수
    end_time: ""            # HH:mm 필수(시작보다 늦게)
    attendees: []           # 로스터 이름 배열

questions: []               # 채우다 막힌 것·사람이 정해야 할 것(문자열 배열)
```

## 다른 Claude Code에 줄 프롬프트 (복사용)

> 아래 "Que 일정 임포트 양식"을 채워줘. 이 프로젝트의 레포·문서·이슈·커밋 이력에서 **근거를 찾아** 마일스톤(기한이 있는 굵직한 지점)과 작업(담당·기간이 있는 실행 단위), 정기 회의를 추출해라. 규칙: ① 추정 금지 — 근거 없는 값은 빈칸으로 두고 questions에 질문으로 남겨라. ② 날짜는 KST YYYY-MM-DD, 시각은 24시간 HH:mm(모르면 생략). ③ 담당자는 다음 이름만 허용(그 외·불확실은 빈칸): 황성현·오승훈·황성진·박승환·송수용·이예진·김리원·이혜진. ④ depends_on은 이 양식 안 다른 작업의 title만 참조. ⑤ 필드 추가·개명 금지. 출력은 **완성된 YAML 코드블록 하나만**, 설명은 그 아래 3줄 이내로.
>
> (여기에 위 "양식" 절의 YAML을 함께 붙여넣기)

## 가져오기 절차 (Que 세션 쪽)

1. 완성된 YAML을 Que 세션에 붙여넣는다.
2. Que 세션은 등록 전에 요약(클라이언트/프로젝트 신규 여부, 마일스톤 N, 작업 N, 회의 N, questions)을 보여주고 확인을 받는다 — 자연어 등록 확인 카드와 같은 원칙.
3. 확인 후 core mutation 경유로 생성한다(ChangeLog via:web). 순서: 클라이언트 → 프로젝트 → 마일스톤 → 작업(선행 연결은 작업 생성 뒤 일괄) → 회의.
4. questions에 담긴 항목은 생성하지 않고 사용자에게 되묻는다.
