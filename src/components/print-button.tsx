"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Triggers the browser print dialog. Hidden in the printed output (print:hidden). */
export function PrintButton() {
  const t = useTranslations("Receipt");
  return (
    <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
      {t("print")}
    </Button>
  );
}
