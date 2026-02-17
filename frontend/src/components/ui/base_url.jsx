import { getApiBaseUrl } from "../../../../shared/index.js";

export const GET_API_BASE_URL = () =>
  getApiBaseUrl({ locationHref: typeof window !== "undefined" ? window.location?.href : "" });
