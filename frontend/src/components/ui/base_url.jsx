
export const GET_API_BASE_URL = () => {
    let API_BASE_URL = "http://localhost:8000";

    if (window.location.href.includes('frontend-production')) {
        API_BASE_URL = "https://mentalloadmanager-production.up.railway.app"
    } 

    return API_BASE_URL;
}

