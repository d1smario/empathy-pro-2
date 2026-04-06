"use client";

import { useState } from "react";
import type { ProductModuleId } from "@empathy/contracts";
import { ModeSelect, Pro2Link } from "@/components/ui/empathy";
import {
  getGenerativeContinueHref,
  getGenerativeFocusConfig,
} from "@/components/generative/generative-focus-options";

/**
 * Un solo tendina + un pulsante principale (stub): pattern espositivo generativo senza muri di testo.
 */
export function GenerativeFocusIsland({ module }: { module: ProductModuleId }) {
  const cfg = getGenerativeFocusConfig(module);
  const [focus, setFocus] = useState(cfg.defaultValue);

  return (
    <div className="w-full max-w-xs space-y-5">
      <ModeSelect
        id={`gen-focus-${module}`}
        label="Focus"
        value={focus}
        onChange={setFocus}
        options={cfg.options}
      />
      <Pro2Link
        href={getGenerativeContinueHref(module, focus)}
        className="w-full justify-center"
      >
        {cfg.primaryCtaLabel}
      </Pro2Link>
      <p className="text-center text-[0.65rem] leading-snug text-gray-600">
        Vai all&apos;hub con il focus selezionato · pipeline deterministiche in arrivo
      </p>
    </div>
  );
}
