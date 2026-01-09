import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

// 辅助函数：将 CSS 变量转换为支持透明度的格式
// 使用 color-mix 兼容 Hex/RGB/HSL 变量
const withOpacity = (variableName: string) => {
    return `color-mix(in srgb, var(${variableName}), transparent calc(100% - <alpha-value> * 100%))`;
};

const config = {
    darkMode: ["class"],
    content: ["./src/**/*.{ts,tsx}"],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: { "2xl": "1200px" }
        },
        extend: {
            fontFamily: {
                sans: ["var(--font-sans)", ...fontFamily.sans]
            },
            colors: {
                // 核心修复：使用 withOpacity 函数包装所有变量
                border: withOpacity("--border"),
                input: withOpacity("--input"),
                ring: withOpacity("--ring"),
                background: withOpacity("--background"),
                foreground: withOpacity("--foreground"),
                primary: {
                    DEFAULT: withOpacity("--primary-color"),
                    foreground: withOpacity("--primary-color-text"),
                    0: withOpacity("--primary-0"),
                    50: withOpacity("--primary-50"),
                    100: withOpacity("--primary-100"),
                    200: withOpacity("--primary-200"),
                    300: withOpacity("--primary-300"),
                    400: withOpacity("--primary-400"),
                    500: withOpacity("--primary-500"),
                    600: withOpacity("--primary-600"),
                    700: withOpacity("--primary-700"),
                    800: withOpacity("--primary-800"),
                    900: withOpacity("--primary-900"),
                },
                secondary: {
                    DEFAULT: withOpacity("--secondary"),
                    foreground: withOpacity("--secondary-foreground")
                },
                surface: {
                    DEFAULT: withOpacity("--surface-0"),
                    0: withOpacity("--surface-0"),
                    50: withOpacity("--surface-50"),
                    100: withOpacity("--surface-100"),
                    200: withOpacity("--surface-200"),
                    300: withOpacity("--surface-300"),
                    400: withOpacity("--surface-400"),
                    500: withOpacity("--surface-500"),
                    600: withOpacity("--surface-600"),
                    700: withOpacity("--surface-700"),
                    800: withOpacity("--surface-800"),
                    900: withOpacity("--surface-900"),
                },
                // 其他颜色以此类推...
                'color-1': withOpacity('--color-1'),
                'color-2': withOpacity('--color-2'),
                'color-3': withOpacity('--color-3'),
                'color-4': withOpacity('--color-4'),
                'color-5': withOpacity('--color-5'),
            },
            // ... 保持你的 keyframes 和 animation 不变
            keyframes: {
                'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
                'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
                'border-beam': { '100%': { 'offset-distance': '100%' } },
                'image-glow': { '0%': { opacity: '0' }, '100%': { opacity: '0.4' } },
                'fade-in': { from: { opacity: '0', transform: 'translateY(-10px)' }, to: { opacity: '1', transform: 'none' } },
                'fade-up': { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'none' } },
                shimmer: { '0%, 90%, 100%': { 'background-position': 'calc(-100% - var(--shimmer-width)) 0' }, '30%, 60%': { 'background-position': 'calc(100% + var(--shimmer-width)) 0' } },
                marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(calc(-100% - var(--gap)))' } },
                'marquee-vertical': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(calc(-100% - var(--gap)))' } },
                'shimmer-slide': { to: { transform: 'translate(calc(100cqw - 100%), 0)' } },
                'spin-around': { '0%': { transform: 'rotate(0)' }, '100%': { transform: 'rotate(360deg)' } },
                gradient: { to: { backgroundPosition: 'var(--bg-size) 0' } },
                rainbow: { '0%': { 'background-position': '0%' }, '100%': { 'background-position': '200%' } },
                rippling: { '0%': { opacity: '1' }, '100%': { transform: 'scale(2)', opacity: '0' } },
                ripple: { '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)' }, '50%': { transform: 'translate(-50%, -50%) scale(0.9)' } }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
                'image-glow': 'image-glow 4100ms 600ms ease-out forwards',
                'fade-in': 'fade-in 1000ms var(--animation-delay, 0ms) ease forwards',
                'fade-up': 'fade-up 1000ms var(--animation-delay, 0ms) ease forwards',
                shimmer: 'shimmer 8s infinite',
                marquee: 'marquee var(--duration) infinite linear',
                'marquee-vertical': 'marquee-vertical var(--duration) linear infinite',
                'shimmer-slide': 'shimmer-slide var(--speed) ease-in-out infinite alternate',
                'spin-around': 'spin-around calc(var(--speed) * 2) infinite linear',
                gradient: 'gradient 8s linear infinite',
                rainbow: 'rainbow var(--speed, 2s) infinite linear',
                rippling: 'rippling var(--duration) ease-out',
                ripple: 'ripple var(--duration,2s) ease calc(var(--i, 0)*.2s) infinite',
                'bounce-right': 'slide-right 1s ease-in-out infinite'
            }
        }
    },
} satisfies Config;

export default config;