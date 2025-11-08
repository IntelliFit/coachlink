import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{ts,tsx}",
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1200px'
            }
        },
        extend: {
            fontFamily: {
                sans: [
                    'var(--font-sans)',
                    ...fontFamily.sans
                ]
            },
            colors: {
                border: 'var(--border)',
                input: 'var(--input)',
                ring: 'var(--ring)',
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                primary: {
                    DEFAULT: 'var(--primary-color)',
                    foreground: 'var(--primary-color-text)'
                },
                secondary: {
                    DEFAULT: 'var(--secondary)',
                    foreground: 'var(--secondary-foreground)'
                },
                destructive: {
                    DEFAULT: 'var(--destructive)',
                    foreground: 'var(--destructive-foreground)'
                },
                muted: {
                    DEFAULT: 'var(--muted)',
                    foreground: 'var(--muted-foreground)'
                },
                accent: {
                    DEFAULT: 'var(--accent)',
                    foreground: 'var(--accent-foreground)'
                },
                popover: {
                    DEFAULT: 'var(--popover)',
                    foreground: 'var(--popover-foreground)'
                },
                card: {
                    DEFAULT: 'var(--card)',
                    foreground: 'var(--card-foreground)'
                },
                'color-1': 'var(--color-1)',
                'color-2': 'var(--color-2)',
                'color-3': 'var(--color-3)',
                'color-4': 'var(--color-4)',
                'color-5': 'var(--color-5)',
                blue: {
                    50: '#f5f9ff',
                    100: '#d0e1fd',
                    200: '#abc9fb',
                    300: '#85b2f9',
                    400: '#609af8',
                    500: '#3b82f6',
                    600: '#326fd1',
                    700: '#295bac',
                    800: '#204887',
                    900: '#183462'
                },
                sidebar: {
                    DEFAULT: 'var(--sidebar-background)',
                    foreground: 'var(--sidebar-foreground)',
                    primary: 'var(--sidebar-primary)',
                    'primary-foreground': 'var(--sidebar-primary-foreground)',
                    accent: 'var(--sidebar-accent)',
                    'accent-foreground': 'var(--sidebar-accent-foreground)',
                    border: 'var(--sidebar-border)',
                    ring: 'var(--sidebar-ring)'
                }
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            keyframes: {
                'accordion-down': {
                    from: {
                        height: '0'
                    },
                    to: {
                        height: 'var(--radix-accordion-content-height)'
                    }
                },
                'accordion-up': {
                    from: {
                        height: 'var(--radix-accordion-content-height)'
                    },
                    to: {
                        height: '0'
                    }
                },
                'border-beam': {
                    '100%': {
                        'offset-distance': '100%'
                    }
                },
                'image-glow': {
                    '0%': {
                        opacity: '0',
                        'animation-timing-function': 'cubic-bezier(0.74, 0.25, 0.76, 1)'
                    },
                    '10%': {
                        opacity: '0.7',
                        'animation-timing-function': 'cubic-bezier(0.12, 0.01, 0.08, 0.99)'
                    },
                    '100%': {
                        opacity: '0.4'
                    }
                },
                'fade-in': {
                    from: {
                        opacity: '0',
                        transform: 'translateY(-10px)'
                    },
                    to: {
                        opacity: '1',
                        transform: 'none'
                    }
                },
                'fade-up': {
                    from: {
                        opacity: '0',
                        transform: 'translateY(20px)'
                    },
                    to: {
                        opacity: '1',
                        transform: 'none'
                    }
                },
                shimmer: {
                    '0%, 90%, 100%': {
                        'background-position': 'calc(-100% - var(--shimmer-width)) 0'
                    },
                    '30%, 60%': {
                        'background-position': 'calc(100% + var(--shimmer-width)) 0'
                    }
                },
                marquee: {
                    from: {
                        transform: 'translateX(0)'
                    },
                    to: {
                        transform: 'translateX(calc(-100% - var(--gap)))'
                    }
                },
                'marquee-vertical': {
                    from: {
                        transform: 'translateY(0)'
                    },
                    to: {
                        transform: 'translateY(calc(-100% - var(--gap)))'
                    }
                },
                'shimmer-slide': {
                    to: {
                        transform: 'translate(calc(100cqw - 100%), 0)'
                    }
                },
                'spin-around': {
                    '0%': {
                        transform: 'translateZ(0) rotate(0)'
                    },
                    '15%, 35%': {
                        transform: 'translateZ(0) rotate(90deg)'
                    },
                    '65%, 85%': {
                        transform: 'translateZ(0) rotate(270deg)'
                    },
                    '100%': {
                        transform: 'translateZ(0) rotate(360deg)'
                    }
                },
                gradient: {
                    to: {
                        backgroundPosition: 'var(--bg-size) 0'
                    }
                },
                rainbow: {
                    '0%': {
                        'background-position': '0%'
                    },
                    '100%': {
                        'background-position': '200%'
                    }
                },
                rippling: {
                    '0%': {
                        opacity: '1'
                    },
                    '100%': {
                        transform: 'scale(2)',
                        opacity: '0'
                    }
                },
                ripple: {
                    '0%, 100%': {
                        transform: 'translate(-50%, -50%) scale(1)'
                    },
                    '50%': {
                        transform: 'translate(-50%, -50%) scale(0.9)'
                    }
                }
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
                ripple: 'ripple var(--duration,2s) ease calc(var(--i, 0)*.2s) infinite'
            }
        }
    },
} satisfies Config;

export default config;