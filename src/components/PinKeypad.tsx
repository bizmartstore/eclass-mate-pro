import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeypadProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}

export function PinKeypad({ value, onChange, maxLength = 6 }: KeypadProps) {
  const press = (d: string) => {
    if (value.length < maxLength) onChange(value + d);
  };
  const back = () => onChange(value.slice(0, -1));
  const clear = () => onChange("");

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition-all",
              i < value.length
                ? "bg-primary border-primary scale-110"
                : "border-muted-foreground/30",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="h-14 rounded-lg bg-muted hover:bg-accent text-xl font-semibold transition-colors active:scale-95"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="h-14 rounded-lg bg-muted hover:bg-accent text-sm font-medium text-muted-foreground transition-colors active:scale-95"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => press("0")}
          className="h-14 rounded-lg bg-muted hover:bg-accent text-xl font-semibold transition-colors active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          onClick={back}
          className="h-14 rounded-lg bg-muted hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors active:scale-95"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
