import { cn } from "@/lib/utils";
import { NumericDisplay } from "@/components/ui/numeric-display";

interface GaugeProps {
    value: number;
    size?: number;
    strokeWidth?: number;
    className?: string;
    label?: string;
}

export function Gauge({ value, size = 60, strokeWidth = 8, className, label }: GaugeProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    // We want a 220 degree gauge (leaving 140 degrees open at bottom)
    // -110 to +110 degrees
    const arcLength = circumference * (220 / 360);
    const dashArray = `${arcLength} ${circumference}`;
    const offset = arcLength - (value / 100) * arcLength;

    // Robinhood-style gradient: red (sell) to green (buy)
    const color = `hsl(${value / 100 * 160}, 100%, 55%)`;

    return (
        <div className={cn("relative flex flex-col items-center justify-end", className)} style={{ width: size, height: size }}>

            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="transform rotate-[160deg] translate-y-5" // Rotate to position the gap at the bottom
            >
                {/* Background Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#27272a" // zinc-800
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashArray}
                    strokeLinecap="butt"
                />
                {/* Progress Path */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashArray}
                    strokeDashoffset={offset}
                    strokeLinecap="butt"
                    className="transition-all duration-500 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end" style={{ transform: 'none' }}>
                <span className="text-sm font-black leading-none" style={{ color }}>
                    <NumericDisplay value={`${value}¢`} size="sm" variant="bold" />
                </span>
                {label && (
                    <span className={cn(
                        "text-[9px] font-bold uppercase mt-0.5",
                        label.toLowerCase() === 'sell' ? "text-red-500" :
                            label.toLowerCase() === 'buy' ? "text-green-500" :
                                "text-zinc-500"
                    )}>
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
}
