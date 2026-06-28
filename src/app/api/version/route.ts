import { NextResponse } from "next/server";
import { APP_VERSION, BUILD_BRANCH, BUILD_SHA } from "@/lib/version";

/** Lightweight probe — lets the R&D dashboard tell if the loaded bundle
 *  matches what the server is serving (i.e. caught a service-worker /
 *  CDN cache that's behind the latest deploy). */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    sha: BUILD_SHA,
    branch: BUILD_BRANCH,
    serverTimeMs: Date.now(),
  });
}
