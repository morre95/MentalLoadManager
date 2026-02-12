import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function getAuthToken() {
    if (typeof window === "undefined") {
        return null;
    }
    return localStorage.getItem("auth_token") || localStorage.getItem("token");
}

export function isUserLoggedIn() {
    return Boolean(getAuthToken());
}
