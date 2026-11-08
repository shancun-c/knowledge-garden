import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone", serverExternalPackages:["@open-spaced-repetition/binding"], outputFileTracingIncludes:{"/api/settings/fsrs":["./scripts/fsrs-optimize-worker.cjs","./node_modules/ts-fsrs/**/*","./node_modules/@open-spaced-repetition/binding/**/*","./node_modules/@open-spaced-repetition/binding-*/**/*"]}, poweredByHeader: false };
export default config;
