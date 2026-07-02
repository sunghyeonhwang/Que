import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 모노레포 루트를 명시해 워크스페이스 루트 추론 경고를 막는다.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
