import type { ProductModuleId } from "@empathy/contracts";
import { GenerativeModuleSurface } from "@/components/navigation/GenerativeModuleSurface";
import { StandardModuleSurface } from "@/components/navigation/StandardModuleSurface";
import { isGenerativeProductModule } from "@/core/navigation/generative-modules";
import type { GenerativeHubIntent } from "@/core/routing/generative-intent-search-params";

export function ModulePlaceholder({
  module,
  generativeHubIntent,
}: {
  module: ProductModuleId;
  generativeHubIntent?: GenerativeHubIntent;
}) {
  if (isGenerativeProductModule(module)) {
    return <GenerativeModuleSurface module={module} />;
  }
  return (
    <StandardModuleSurface module={module} generativeHubIntent={generativeHubIntent} />
  );
}
