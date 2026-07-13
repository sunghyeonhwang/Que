import { Suspense } from "react";

import { FontPairClient } from "./font-pair-client";

// 폰트 페어링 메인 — 서버 껍데기. 모든 상호작용은 클라이언트 컴포넌트가 담당한다.
// useSearchParams(공유 URL 복원) 사용 → prerender 안전을 위해 Suspense 경계로 감싼다.
export default function FontPage() {
  return (
    <Suspense fallback={null}>
      <FontPairClient />
    </Suspense>
  );
}
