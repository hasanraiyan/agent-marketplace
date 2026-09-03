import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "./utils";

export function FirmAvatar({ firm, className, rounded = "rounded-2xl" }) {
  return (
    <Avatar className={cn("size-10 border border-zinc-100", rounded, className)}>
      <AvatarImage
        src={firm?.avatar}
        alt={firm?.name || "Firm"}
        className={cn("object-cover", rounded)}
      />
      <AvatarFallback
        className={cn(
          "bg-[#1E60FF]/10 text-[#1E60FF] font-display font-semibold",
          rounded,
        )}
      >
        {initials(firm?.name)}
      </AvatarFallback>
    </Avatar>
  );
}
