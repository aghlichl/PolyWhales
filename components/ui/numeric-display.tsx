import { cn } from '@/lib/utils';

interface NumericDisplayProps {
    value: string | number;
    className?: string;
    variant?: 'default' | 'bold' | 'semibold';
    size?: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export function NumericDisplay({
    value,
    className,
    variant = 'default',
    size = 'base'
}: NumericDisplayProps) {
    const sizeClasses = {
        xs: 'text-xs',
        sm: 'text-sm',
        base: 'text-base',
        md: 'text-base', // alias for mid size
        lg: 'text-lg',
        xl: 'text-xl',
        '2xl': 'text-2xl',
        '3xl': 'text-3xl'
    };

    const variantClasses = {
        default: 'font-normal',
        semibold: 'font-semibold',
        bold: 'font-bold'
    };

    return (
        <span className={cn(
            'font-sans',
            sizeClasses[size],
            variantClasses[variant],
            'tracking-tight',
            className
        )}>
            {value}
        </span>
    );
}
