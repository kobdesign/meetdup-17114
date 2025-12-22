import liff from "@line/liff";

type LiffType = "share" | "apps";

interface LiffState {
  initialized: boolean;
  initializingPromise: Promise<void> | null;
  initializedWith: LiffType | null;
  liffId: string | null;
  isInClient: boolean;
  isLoggedIn: boolean;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  error: string | null;
}

const globalState: LiffState = {
  initialized: false,
  initializingPromise: null,
  initializedWith: null,
  liffId: null,
  isInClient: false,
  isLoggedIn: false,
  profile: null,
  error: null,
};

type StateListener = () => void;
const listeners: Set<StateListener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function subscribeLiffState(listener: StateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLiffState(): LiffState {
  return { ...globalState };
}

export function isLiffInitialized(): boolean {
  return globalState.initialized;
}

export function getInitializedLiffType(): LiffType | null {
  return globalState.initializedWith;
}

async function fetchProfile(): Promise<void> {
  if (!liff.isLoggedIn()) return;
  
  try {
    const userProfile = await liff.getProfile();
    globalState.profile = {
      userId: userProfile.userId,
      displayName: userProfile.displayName,
      pictureUrl: userProfile.pictureUrl,
    };
    notifyListeners();
  } catch (e) {
    console.error("[LIFF Manager] Error getting profile:", e);
  }
}

export async function initializeLiff(
  type: LiffType,
  configEndpoint: string
): Promise<LiffState> {
  if (globalState.initialized) {
    if (globalState.initializedWith !== type) {
      console.log(
        `[LIFF Manager] Already initialized with ${globalState.initializedWith}, requested ${type}. Reusing existing session.`
      );
    }
    return getLiffState();
  }

  if (globalState.initializingPromise) {
    console.log("[LIFF Manager] Init in progress, waiting...");
    await globalState.initializingPromise;
    return getLiffState();
  }

  globalState.initializingPromise = (async () => {
    try {
      console.log(`[LIFF Manager] Fetching config from ${configEndpoint}`);
      const response = await fetch(configEndpoint);
      if (!response.ok) {
        throw new Error("Failed to fetch LIFF config");
      }
      const config = await response.json();

      if (!config.liff_id) {
        console.log(`[LIFF Manager] No LIFF ID configured for ${type}`);
        globalState.initialized = true;
        globalState.initializedWith = type;
        notifyListeners();
        return;
      }

      globalState.liffId = config.liff_id;
      console.log(`[LIFF Manager] Initializing LIFF (${type}) with ID:`, config.liff_id);

      await liff.init({ liffId: config.liff_id });

      globalState.initialized = true;
      globalState.initializedWith = type;
      globalState.isInClient = liff.isInClient();
      globalState.isLoggedIn = liff.isLoggedIn();

      console.log(`[LIFF Manager] Initialized successfully (${type})`, {
        isInClient: globalState.isInClient,
        isLoggedIn: globalState.isLoggedIn,
      });

      await fetchProfile();
      notifyListeners();
    } catch (error: any) {
      console.error(`[LIFF Manager] Initialization error (${type}):`, error);
      globalState.error = error.message || "Failed to initialize LIFF";
      globalState.initialized = true;
      globalState.initializedWith = type;
      notifyListeners();
    }
  })();

  await globalState.initializingPromise;
  globalState.initializingPromise = null;
  return getLiffState();
}

export function liffLogin(redirectUri?: string): void {
  if (!globalState.liffId) {
    console.log("[LIFF Manager] Cannot login - no LIFF ID configured");
    return;
  }
  liff.login({ redirectUri: redirectUri || window.location.href });
}

export function liffCloseWindow(): void {
  if (liff.isInClient()) {
    liff.closeWindow();
  } else {
    window.close();
  }
}

export async function liffShareTargetPicker(
  messages: any[]
): Promise<{ success: boolean; cancelled: boolean }> {
  if (!globalState.liffId) {
    throw new Error("LIFF is not configured");
  }

  if (!liff.isApiAvailable("shareTargetPicker")) {
    throw new Error("Share feature is not available in this context");
  }

  if (!messages || messages.length === 0) {
    throw new Error("No messages to share");
  }

  if (messages.length > 5) {
    console.warn("[LIFF Manager] More than 5 messages provided, only first 5 will be sent");
    messages = messages.slice(0, 5);
  }

  try {
    const result = await liff.shareTargetPicker(messages);

    if (result) {
      console.log("[LIFF Manager] Share successful", result);
      return { success: true, cancelled: false };
    } else {
      console.log("[LIFF Manager] Share cancelled by user");
      throw new Error("Share cancelled by user");
    }
  } catch (error: any) {
    console.error("[LIFF Manager] Share error:", error);

    if (error.code === "FORBIDDEN") {
      throw new Error("Share permission denied. Please check LINE app permissions.");
    }

    throw error;
  }
}

export function isShareApiAvailable(): boolean {
  return (
    globalState.initialized &&
    globalState.isLoggedIn &&
    !!globalState.liffId &&
    typeof liff !== "undefined" &&
    liff.isApiAvailable?.("shareTargetPicker")
  );
}
