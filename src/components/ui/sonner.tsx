import { Toaster as Sonner } from "sonner";
import type { ComponentProps, CSSProperties } from "react";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ style, position = "top-center", ...props }: ToasterProps) => {
  return (
    <Sonner
      closeButton
      position={position}
      className="toaster group"
      style={
        {
          ...style,
          "--toast-close-button-start": "unset",
          "--toast-close-button-end": "0",
          "--toast-close-button-transform": "translate(35%, -35%)",
          "--width": "300px",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast min-h-0 max-w-[320px] justify-center gap-2 px-4 py-3 text-center group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          title: "w-full text-center text-sm font-semibold",
          description: "w-full text-center group-[.toast]:text-muted-foreground",
          icon: "shrink-0",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
