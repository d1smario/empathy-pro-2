import type { ProductModuleId } from "@empathy/contracts";
import { GenerativeModuleSurface } from "@/components/navigation/GenerativeModuleSurface";
import { StandardModuleSurface } from "@/components/navigation/StandardModuleSurface";
import { isGenerativeProductModule } from "@/core/navigation/generative-modules";
export function ModulePlaceholder({ module }: { module: ProductModuleId }) {
  if (isGenerativeProductModule(module)) {
    return <GenerativeModuleSurface module={module} />;
  }
  return <StandardModuleSurface module={module} />;
}
