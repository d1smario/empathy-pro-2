import { pro2ButtonClassName } from "@/components/ui/empathy";

type StripeCheckoutLinkProps = {
  href: string;
  children?: React.ReactNode;
};

/** CTA esterna verso Stripe (nuova scheda), stesso chrome dei pulsanti Pro 2. */
export function StripeCheckoutLink({ href, children }: StripeCheckoutLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={pro2ButtonClassName("primary", "justify-center px-8")}
    >
      {children ?? "Checkout Stripe"}
    </a>
  );
}
