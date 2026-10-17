import { createManifestResponse, jaManifest } from '@/logic/manifest';

export function GET() {
  return createManifestResponse(jaManifest);
}
