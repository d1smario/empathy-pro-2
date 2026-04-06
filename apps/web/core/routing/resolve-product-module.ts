import { isProductModuleId, type ProductModuleId } from "@empathy/contracts";

/** Resolves `/training/...` → `training` quando il segmento è un `ProductModuleId` contrattuale. */
export function resolveProductModuleFromPath(pathname: string): ProductModuleId | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg || !isProductModuleId(seg)) return null;
  return seg;
}
