import React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(undefined);

    React.useEffect(() => {
        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        // Set initial value
        onChange();

        // Subscribe
        window.addEventListener("resize", onChange);

        return () => window.removeEventListener("resize", onChange);
    }, []);

    return !!isMobile;
}
