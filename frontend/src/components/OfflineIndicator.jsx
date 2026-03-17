import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

import {
  getApiClientNetworkStatus,
  subscribeToApiClientNetworkStatus,
} from "@/lib/utils";

export default function OfflineIndicator() {
  const networkStatus = useSyncExternalStore(
    subscribeToApiClientNetworkStatus,
    getApiClientNetworkStatus,
    getApiClientNetworkStatus
  );

  if (networkStatus.online) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[100] border-b border-destructive/25 bg-destructive/95 text-destructive-foreground shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
        <WifiOff className="h-4 w-4" />
        <span>You are offline</span>
        {networkStatus.queueSize > 0 ? (
          <span className="opacity-90">
            {networkStatus.queueSize} change{networkStatus.queueSize === 1 ? "" : "s"} queued
          </span>
        ) : null}
      </div>
    </div>
  );
}
