// font.griff.co.kr — 한글 무료 폰트 페어링 데이터.
// 폰트 파일을 호스팅하지 않는다: 각 폰트의 공개 웹폰트 CSS(구글 폰트·jsDelivr 눈누 CDN·공식 CDN)를
// 링크만 한다. noonnuUrl은 라이선스·다운로드 안내용 크레딧 링크(눈누 검색).
// URL은 배포 후 실로드 검증을 거친 것만 유지한다 — 로드 실패 폰트는 목록에서 뺀다.

export type Mood = "warm" | "minimal" | "bold" | "retro" | "elegant";
export type Role = "heading" | "body";

export interface FontDef {
  /** CSS font-family 값(따옴표 없이). */
  family: string;
  /** 표시 이름(한글). */
  label: string;
  /** 스타일시트 URL(<link rel="stylesheet">) — 구글 폰트·프리텐다드처럼 CSS를 제공하는 경우. */
  stylesheet?: string;
  /** woff 파일 URL — 눈누 jsDelivr처럼 파일만 제공하는 경우, @font-face를 인라인 생성한다. */
  woff?: string;
  /** 무드 태그 — 페어링 프리셋 필터. */
  moods: Mood[];
  /** 어울리는 역할. heading 전용 디스플레이체는 ["heading"]. */
  roles: Role[];
  /** 눈누 검색 링크(라이선스·다운로드 안내). 구글 폰트는 구글 폰트 링크. */
  infoUrl: string;
  /** 본문 렌더 보정용 기본 굵기(없으면 400). */
  weight?: number;
  /** 라틴 전용(한글 미지원) — 무드 셔플 풀에서 제외, 폰트 목록에서 수동 선택만 허용. */
  latinOnly?: boolean;
  /** Adobe Fonts kit 소스 — CSS 복사 시 @font-face 대신 kit 안내로 처리(도메인 제한). */
  adobe?: boolean;
}

/** Adobe Fonts kit(도메인 제한). 5종이 같은 stylesheet URL을 공유 — 삽입 시 dedup 필요. */
export const ADOBE_KIT = "https://use.typekit.net/pow5jnk.css";

const g = (family: string, extra = "") =>
  `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}${extra}&display=swap`;
const noonnu = (q: string) => `https://noonnu.cc/search?query=${encodeURIComponent(q)}`;
const google = (family: string) => `https://fonts.google.com/specimen/${family.replace(/ /g, "+")}`;

export const FONTS: FontDef[] = [
  // ── 산세리프(본문 겸용) ─────────────────────────────────────────────
  {
    family: "Pretendard Variable", label: "프리텐다드",
    stylesheet: "https://fastly.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
    moods: ["minimal"], roles: ["heading", "body"], infoUrl: noonnu("프리텐다드"),
  },
  {
    family: "SUIT Variable", label: "수트",
    stylesheet: "https://fastly.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css",
    moods: ["minimal"], roles: ["heading", "body"], infoUrl: noonnu("SUIT"),
  },
  {
    family: "Noto Sans KR", label: "본고딕 (Noto Sans KR)",
    stylesheet: g("Noto Sans KR", ":wght@300;400;500;700;900"),
    moods: ["minimal"], roles: ["heading", "body"], infoUrl: google("Noto Sans KR"),
  },
  {
    family: "Gothic A1", label: "고딕 A1",
    stylesheet: g("Gothic A1", ":wght@300;400;500;700;900"),
    moods: ["minimal"], roles: ["heading", "body"], infoUrl: google("Gothic A1"),
  },
  {
    family: "IBM Plex Sans KR", label: "IBM 플렉스 산스",
    stylesheet: g("IBM Plex Sans KR", ":wght@300;400;500;700"),
    moods: ["minimal"], roles: ["heading", "body"], infoUrl: google("IBM Plex Sans KR"),
  },
  {
    family: "Nanum Gothic", label: "나눔고딕",
    stylesheet: g("Nanum Gothic", ":wght@400;700;800"),
    moods: ["minimal"], roles: ["body"], infoUrl: google("Nanum Gothic"),
  },
  {
    family: "Gowun Dodum", label: "고운돋움",
    stylesheet: g("Gowun Dodum"),
    moods: ["warm", "minimal"], roles: ["heading", "body"], infoUrl: google("Gowun Dodum"),
  },
  {
    family: "Sunflower", label: "해바라기",
    stylesheet: g("Sunflower", ":wght@300;500;700"),
    moods: ["minimal"], roles: ["body"], infoUrl: google("Sunflower"),
  },
  // ── 세리프·명조 ────────────────────────────────────────────────────
  {
    family: "Noto Serif KR", label: "본명조 (Noto Serif KR)",
    stylesheet: g("Noto Serif KR", ":wght@300;400;600;900"),
    moods: ["elegant"], roles: ["heading", "body"], infoUrl: google("Noto Serif KR"),
  },
  {
    family: "Nanum Myeongjo", label: "나눔명조",
    stylesheet: g("Nanum Myeongjo", ":wght@400;700;800"),
    moods: ["elegant"], roles: ["heading", "body"], infoUrl: google("Nanum Myeongjo"),
  },
  {
    family: "Gowun Batang", label: "고운바탕",
    stylesheet: g("Gowun Batang", ":wght@400;700"),
    moods: ["elegant", "warm"], roles: ["heading", "body"], infoUrl: google("Gowun Batang"),
  },
  {
    family: "Hahmlet", label: "함렛",
    stylesheet: g("Hahmlet", ":wght@300;400;600;800"),
    moods: ["elegant", "retro"], roles: ["heading", "body"], infoUrl: google("Hahmlet"),
  },
  {
    family: "Song Myung", label: "송명",
    stylesheet: g("Song Myung"),
    moods: ["elegant", "retro"], roles: ["heading"], infoUrl: google("Song Myung"),
  },
  {
    family: "MaruBuri", label: "마루 부리",
    stylesheet: "https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css",
    moods: ["elegant", "warm"], roles: ["heading", "body"], infoUrl: noonnu("마루 부리"),
  },
  // ── 디스플레이·제목 ────────────────────────────────────────────────
  {
    family: "Black Han Sans", label: "검은고딕",
    stylesheet: g("Black Han Sans"),
    moods: ["bold"], roles: ["heading"], infoUrl: google("Black Han Sans"),
  },
  {
    family: "GmarketSansMedium", label: "지마켓 산스",
    woff: "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff",
    moods: ["bold", "minimal"], roles: ["heading"], infoUrl: noonnu("지마켓 산스"),
  },
  {
    family: "S-CoreDream-6Bold", label: "에스코어 드림 (Bold)",
    woff: "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-6Bold.woff",
    moods: ["bold", "minimal"], roles: ["heading"], infoUrl: noonnu("에스코어 드림"),
  },
  {
    family: "S-CoreDream-3Light", label: "에스코어 드림 (Light)",
    woff: "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-3Light.woff",
    moods: ["minimal"], roles: ["body"], infoUrl: noonnu("에스코어 드림"),
  },
  {
    family: "yg-jalnan", label: "여기어때 잘난체",
    woff: "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.2/JalnanOTF00.woff",
    moods: ["bold"], roles: ["heading"], infoUrl: noonnu("잘난체"),
  },
  {
    family: "Jua", label: "주아체",
    stylesheet: g("Jua"),
    moods: ["warm", "bold"], roles: ["heading"], infoUrl: google("Jua"),
  },
  {
    family: "Do Hyeon", label: "도현체",
    stylesheet: g("Do Hyeon"),
    moods: ["bold", "retro"], roles: ["heading"], infoUrl: google("Do Hyeon"),
  },
  {
    family: "BMHANNAAir", label: "한나체 Air",
    woff: "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.2/BMHANNAAir.woff",
    moods: ["retro", "bold"], roles: ["heading"], infoUrl: noonnu("한나체"),
  },
  {
    family: "BMKIRANGHAERANG", label: "기랑해랑체",
    woff: "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMKIRANGHAERANG.woff",
    moods: ["retro"], roles: ["heading"], infoUrl: noonnu("기랑해랑"),
  },
  {
    family: "BMYEONSUNG", label: "연성체",
    woff: "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMYEONSUNG.woff",
    moods: ["retro", "warm"], roles: ["heading"], infoUrl: noonnu("연성체"),
  },
  {
    family: "Cafe24Ssurround", label: "카페24 써라운드",
    woff: "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24Ssurround.woff",
    moods: ["warm", "bold"], roles: ["heading"], infoUrl: noonnu("카페24 써라운드"),
  },
  // ── 손글씨·감성 ────────────────────────────────────────────────────
  {
    family: "Nanum Pen Script", label: "나눔손글씨 펜",
    stylesheet: g("Nanum Pen Script"),
    moods: ["warm"], roles: ["heading"], infoUrl: google("Nanum Pen Script"),
  },
  {
    family: "Gaegu", label: "개구체",
    stylesheet: g("Gaegu", ":wght@300;400;700"),
    moods: ["warm"], roles: ["heading"], infoUrl: google("Gaegu"),
  },
  {
    family: "Hi Melody", label: "하이멜로디",
    stylesheet: g("Hi Melody"),
    moods: ["warm"], roles: ["heading"], infoUrl: google("Hi Melody"),
  },
  {
    family: "Poor Story", label: "푸어스토리",
    stylesheet: g("Poor Story"),
    moods: ["warm", "retro"], roles: ["heading"], infoUrl: google("Poor Story"),
  },
  {
    family: "Dongle", label: "동글",
    stylesheet: g("Dongle", ":wght@300;400;700"),
    moods: ["warm"], roles: ["heading"], infoUrl: google("Dongle"),
  },
  {
    family: "East Sea Dokdo", label: "동해독도",
    stylesheet: g("East Sea Dokdo"),
    moods: ["bold", "retro"], roles: ["heading"], infoUrl: google("East Sea Dokdo"),
  },
  {
    family: "Stylish", label: "스타일리시",
    stylesheet: g("Stylish"),
    moods: ["elegant", "warm"], roles: ["heading"], infoUrl: google("Stylish"),
  },
  {
    family: "Single Day", label: "싱글데이",
    stylesheet: g("Single Day"),
    moods: ["warm", "retro"], roles: ["heading"], infoUrl: google("Single Day"),
  },
  // ── Adobe Fonts kit(라틴 전용 · 한글 미지원) — 무드 셔플 제외, 목록에서 수동 선택 ──
  {
    family: "halyard-display", label: "Halyard Display",
    stylesheet: ADOBE_KIT, adobe: true, latinOnly: true, weight: 700,
    moods: ["minimal"], roles: ["heading"], infoUrl: "https://fonts.adobe.com/fonts/halyard",
  },
  {
    family: "halyard-micro", label: "Halyard Micro",
    stylesheet: ADOBE_KIT, adobe: true, latinOnly: true, weight: 400,
    moods: ["minimal"], roles: ["body"], infoUrl: "https://fonts.adobe.com/fonts/halyard",
  },
  {
    family: "halyard-text", label: "Halyard Text",
    stylesheet: ADOBE_KIT, adobe: true, latinOnly: true, weight: 400,
    moods: ["minimal"], roles: ["body"], infoUrl: "https://fonts.adobe.com/fonts/halyard",
  },
  {
    family: "objektiv-mk1", label: "Objektiv Mk1",
    stylesheet: ADOBE_KIT, adobe: true, latinOnly: true, weight: 400,
    moods: ["minimal"], roles: ["heading", "body"], infoUrl: "https://fonts.adobe.com/fonts/objektiv",
  },
  {
    family: "urw-din", label: "URW DIN",
    stylesheet: ADOBE_KIT, adobe: true, latinOnly: true, weight: 400,
    moods: ["minimal", "bold"], roles: ["heading", "body"], infoUrl: "https://fonts.adobe.com/fonts/urw-din",
  },
  // ── 구글 인기 라틴 폰트(라틴 전용) — 영문 모드에서 셔플 합류, 한글 모드는 목록에서 수동 선택 ──
  {
    family: "Poppins", label: "Poppins",
    stylesheet: g("Poppins", ":wght@400;700"), latinOnly: true, weight: 400,
    moods: ["minimal", "bold"], roles: ["heading", "body"], infoUrl: google("Poppins"),
  },
  {
    family: "Inter Tight", label: "Inter Tight",
    stylesheet: g("Inter Tight", ":wght@400;700"), latinOnly: true, weight: 400,
    moods: ["minimal"], roles: ["heading", "body"], infoUrl: google("Inter Tight"),
  },
  {
    family: "Montserrat", label: "Montserrat",
    stylesheet: g("Montserrat", ":wght@400;700"), latinOnly: true, weight: 400,
    moods: ["minimal", "bold"], roles: ["heading", "body"], infoUrl: google("Montserrat"),
  },
  {
    family: "Playfair Display", label: "Playfair Display",
    stylesheet: g("Playfair Display", ":wght@400;700"), latinOnly: true, weight: 700,
    moods: ["elegant"], roles: ["heading"], infoUrl: google("Playfair Display"),
  },
  {
    family: "Space Grotesk", label: "Space Grotesk",
    stylesheet: g("Space Grotesk", ":wght@400;700"), latinOnly: true, weight: 400,
    moods: ["minimal", "bold"], roles: ["heading", "body"], infoUrl: google("Space Grotesk"),
  },
  {
    family: "Bebas Neue", label: "Bebas Neue",
    stylesheet: g("Bebas Neue"), latinOnly: true, weight: 400,
    moods: ["bold"], roles: ["heading"], infoUrl: google("Bebas Neue"),
  },
  {
    family: "DM Sans", label: "DM Sans",
    stylesheet: g("DM Sans", ":wght@400;700"), latinOnly: true, weight: 400,
    moods: ["minimal"], roles: ["heading", "body"], infoUrl: google("DM Sans"),
  },
  {
    family: "Lora", label: "Lora",
    stylesheet: g("Lora", ":wght@400;700"), latinOnly: true, weight: 400,
    moods: ["elegant"], roles: ["heading", "body"], infoUrl: google("Lora"),
  },
];

export const MOOD_LABEL: Record<Mood | "free", string> = {
  free: "자유 조합",
  warm: "따뜻함 · 감성",
  minimal: "미니멀 · 모던",
  bold: "강렬함 · 개성",
  retro: "레트로 · 아날로그",
  elegant: "우아함 · 세리프",
};

/** 무드별 역할 후보 풀. free는 전체. body는 roles에 body가 있는 폰트만.
 *  라틴 전용은 기본 제외(한글 모드), includeLatin=true면 합류(영문 모드). */
export function poolFor(
  mood: Mood | "free",
  role: Role,
  includeLatin = false,
): FontDef[] {
  const base = FONTS.filter(
    (f) => (includeLatin || !f.latinOnly) && f.roles.includes(role),
  );
  if (mood === "free") return base;
  return base.filter((f) => f.moods.includes(mood));
}

// ── 추천 페어 갤러리 — 큐레이션(제목/부제/본문 family는 FONTS에 실재해야 한다) ──
export interface CuratedPair {
  name: string;
  desc: string;
  mood: Mood | "free";
  h: string; // heading family
  s: string; // subtitle family
  b: string; // body family
}

export const CURATED_PAIRS: CuratedPair[] = [
  { name: "프로덕트 기본기", desc: "군더더기 없는 SaaS·대시보드 조합", mood: "minimal",
    h: "S-CoreDream-6Bold", s: "Pretendard Variable", b: "Pretendard Variable" },
  { name: "테크 브랜딩", desc: "각진 제목과 부드러운 본문의 균형", mood: "minimal",
    h: "GmarketSansMedium", s: "SUIT Variable", b: "SUIT Variable" },
  { name: "포근한 브런치", desc: "손글씨 감성과 명조 본문", mood: "warm",
    h: "Nanum Pen Script", s: "MaruBuri", b: "Gowun Batang" },
  { name: "동네 카페 메뉴판", desc: "동글동글한 제목과 담백한 본문", mood: "warm",
    h: "Cafe24Ssurround", s: "Gowun Dodum", b: "Gowun Dodum" },
  { name: "이벤트 포스터", desc: "시선을 붙잡는 초고딕 헤드라인", mood: "bold",
    h: "Black Han Sans", s: "Noto Sans KR", b: "Noto Sans KR" },
  { name: "프로모션 배너", desc: "잘난체의 존재감 + 중립 본문", mood: "bold",
    h: "yg-jalnan", s: "Pretendard Variable", b: "Pretendard Variable" },
  { name: "옛날 간판", desc: "레트로 디스플레이와 명조의 온도차", mood: "retro",
    h: "Do Hyeon", s: "MaruBuri", b: "Nanum Myeongjo" },
  { name: "쎄한 골목 감성", desc: "붓맛 제목과 바탕 본문", mood: "retro",
    h: "BMKIRANGHAERANG", s: "Gowun Batang", b: "Gowun Batang" },
  { name: "매거진 에디토리얼", desc: "명조 헤드라인의 정석", mood: "elegant",
    h: "Noto Serif KR", s: "Noto Sans KR", b: "Noto Sans KR" },
  { name: "북 커버", desc: "함렛의 클래식함과 마루부리 리드", mood: "elegant",
    h: "Hahmlet", s: "MaruBuri", b: "Pretendard Variable" },
];

// ── 라틴 페어 큐레이션(영문 모드) — 라틴 13종 조합. name·desc는 한국어 UI 유지 ──
export const CURATED_PAIRS_EN: CuratedPair[] = [
  { name: "매거진 클래식", desc: "세리프 헤드라인 + 중립 UI 산스", mood: "elegant",
    h: "Playfair Display", s: "Inter Tight", b: "Inter Tight" },
  { name: "포스터 & 리드", desc: "컨덴스드 임팩트 제목 + 세리프 본문", mood: "bold",
    h: "Bebas Neue", s: "Lora", b: "Lora" },
  { name: "테크 프로덕트", desc: "기하 그로테스크 + 담백한 제품 산스", mood: "minimal",
    h: "Space Grotesk", s: "DM Sans", b: "DM Sans" },
  { name: "핼야드 패밀리", desc: "한 가족 슈퍼패밀리 페어", mood: "minimal",
    h: "halyard-display", s: "halyard-micro", b: "halyard-text" },
  { name: "브랜드 & 에디토리얼", desc: "기하 산스 제목 + 세리프 본문", mood: "elegant",
    h: "Montserrat", s: "Lora", b: "Lora" },
  { name: "친근한 랜딩", desc: "둥근 기하 제목 + 읽기 좋은 본문", mood: "minimal",
    h: "Poppins", s: "Poppins", b: "Inter Tight" },
  { name: "인더스트리얼 UI", desc: "DIN 헤드라인 + 중립 그로테스크", mood: "bold",
    h: "urw-din", s: "objektiv-mk1", b: "objektiv-mk1" },
  { name: "럭셔리 부티크", desc: "디스플레이 세리프 + 산스 서브 + 세리프 본문", mood: "elegant",
    h: "Playfair Display", s: "Montserrat", b: "Lora" },
  { name: "스포츠 & 스트리트", desc: "임팩트 제목 + 테크 서브 + 제품 본문", mood: "bold",
    h: "Bebas Neue", s: "Space Grotesk", b: "DM Sans" },
  { name: "스위스 미니멀", desc: "중립 그로테스크 슈퍼패밀리 조합", mood: "minimal",
    h: "objektiv-mk1", s: "halyard-micro", b: "halyard-text" },
];
