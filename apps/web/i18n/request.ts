import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n/supported-locales";

async function loadMessages(locale: SupportedLocale): Promise<AbstractIntlMessages> {
  try {
    return (await import(`../messages/${locale}.json`)).default as AbstractIntlMessages;
  } catch {
    return (await import(`../messages/${DEFAULT_LOCALE}.json`)).default as AbstractIntlMessages;
  }
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  const messages = await loadMessages(locale);
  return {
    locale,
    messages,
    timeZone: "Europe/Zurich",
  };
});
