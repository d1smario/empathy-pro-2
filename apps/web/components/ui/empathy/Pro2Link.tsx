import Link from "next/link";
import { pro2ButtonClassName, type Pro2ButtonVariant } from "./Pro2Button";

type Pro2LinkProps = React.ComponentProps<typeof Link> & {
  variant?: Pro2ButtonVariant;
};

/** Same chrome as `Pro2Button`, for navigation actions. */
export function Pro2Link({ className, variant = "primary", ...props }: Pro2LinkProps) {
  return <Link className={pro2ButtonClassName(variant, className)} {...props} />;
}
