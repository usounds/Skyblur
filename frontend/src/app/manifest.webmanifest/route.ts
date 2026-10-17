import { createManifestResponse, enManifest } from '@/logic/manifest';

export function GET() {
  return createManifestResponse(enManifest);
}
