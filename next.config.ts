import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse(pdf.js)는 worker 파일을 자기 폴더에서 찾으므로 번들에 넣지 않고 node_modules에서 그대로 쓴다 (/api/room/material)
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
