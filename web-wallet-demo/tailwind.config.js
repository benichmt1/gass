/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            keyframes: {
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "fade-out": {
                    from: { opacity: "1" },
                    to: { opacity: "0" },
                },
                "slide-in-from-top": {
                    from: { transform: "translateY(-100%)" },
                    to: { transform: "translateY(0)" },
                },
                "slide-in-from-bottom": {
                    from: { transform: "translateY(100%)" },
                    to: { transform: "translateY(0)" },
                },
                "slide-out-to-right": {
                    from: { transform: "translateX(0)" },
                    to: { transform: "translateX(100%)" },
                },
                "zoom-in": {
                    from: { transform: "scale(0.95)" },
                    to: { transform: "scale(1)" },
                },
                "zoom-out": {
                    from: { transform: "scale(1)" },
                    to: { transform: "scale(0.95)" },
                },
            },
            animation: {
                "fade-in-0": "fade-in 0.2s ease-out",
                "fade-out-80": "fade-out 0.2s ease-out forwards",
                "slide-in-from-top-full": "slide-in-from-top 0.2s ease-out",
                "slide-in-from-bottom-full": "slide-in-from-bottom 0.2s ease-out",
                "slide-out-to-right-full": "slide-out-to-right 0.2s ease-out",
                "zoom-in-95": "zoom-in 0.2s ease-out",
                "zoom-out-95": "zoom-out 0.2s ease-out",
            },
        },
    },
    plugins: [
        require("tailwindcss-animate"),
    ],
}
