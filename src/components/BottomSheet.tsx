import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type BottomSheetProps = {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ title, description, onClose, children }: BottomSheetProps) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl sm:bottom-6 sm:rounded-2xl sm:border"
      >
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-xl font-semibold">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-5 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
