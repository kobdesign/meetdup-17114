import liff from "@line/liff";

export type LiffType = "share" | "apps";

interface LiffTypeState {
  configFetched: boolean;
  liffId: string | null;
  noLiffConfigured: boolean;
}

interface LiffRuntimeState {
  isInClient: boolean;
  isLoggedIn: boolean;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  error: string | null;
}

interface LiffState extends LiffRuntimeState {
  initialized: boolean;
  liffId: string | null;
  activeType: LiffType | null;
}

const CONFIG_ENDPOINTS: Record<LiffType, string> = {
  share: "/api/public/liff-config",
  apps: "/api/public/apps-liff-config",
};

const typeConfigs: Record<LiffType, LiffTypeState> = {
  share: {
    configFetched: false,
    liffId: null,
    noLiffConfigured: false,
  },
  apps: {
    configFetched: false,
    liffId: null,
    noLiffConfigured: false,
  },
};

let sdkInitialized = false;
let sdkInitializing: Promise<void> | null = null;
let activeType: LiffType | null = null;

const runtimeState: LiffRuntimeState = {
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
  return {
    initialized: sdkInitialized || Object.values(typeConfigs).some(tc => tc.configFetched),
    liffId: activeType ? typeConfigs[activeType].liffId : null,
    activeType,
    ...runtimeState,
  };
}

export function getLiffStateForType(type: LiffType): LiffState {
  const tc = typeConfigs[type];
  const isReady = tc.configFetched || sdkInitialized;
  
  return {
    initialized: isReady,
    liffId: tc.liffId,
    activeType: sdkInitialized ? activeType : null,
    ...runtimeState,
  };
}

export function isLiffInitialized(): boolean {
  return sdkInitialized;
}

export function getActiveType(): LiffType | null {
  return activeType;
}

async function fetchProfile(): Promise<void> {
  if (!liff.isLoggedIn()) return;

  try {
    const userProfile = await liff.getProfile();
    runtimeState.profile = {
      userId: userProfile.userId,
      displayName: userProfile.displayName,
      pictureUrl: userProfile.pictureUrl,
    };
  } catch (e) {
    console.error("[LIFF Manager] Error getting profile:", e);
  }
}

async function fetchConfigForType(type: LiffType): Promise<void> {
  const tc = typeConfigs[type];
  if (tc.configFetched) return;

  try {
    const endpoint = CONFIG_ENDPOINTS[type];
    console.log(`[LIFF Manager] (${type}) Fetching config from ${endpoint}`);
    const response = await fetch(endpoint);
    if (response.ok) {
      const config = await response.json();
      tc.liffId = config.liff_id || null;
      tc.noLiffConfigured = !config.liff_id;
    } else {
      tc.noLiffConfigured = true;
    }
  } catch (e) {
    console.error(`[LIFF Manager] (${type}) Config fetch error:`, e);
    tc.noLiffConfigured = true;
  }
  tc.configFetched = true;
}

export async function initializeLiff(
  type: LiffType,
  configEndpoint: string
): Promise<LiffState> {
  const tc = typeConfigs[type];

  if (tc.configFetched) {
    console.log(`[LIFF Manager] (${type}) Config already fetched, returning state`);
    return getLiffStateForType(type);
  }

  if (sdkInitializing) {
    console.log(`[LIFF Manager] (${type}) SDK init in progress, waiting then fetching own config...`);
    await sdkInitializing;
    
    await fetchConfigForType(type);
    notifyListeners();
    return getLiffStateForType(type);
  }

  if (sdkInitialized) {
    console.log(`[LIFF Manager] (${type}) SDK already initialized by ${activeType}, fetching config only`);
    await fetchConfigForType(type);
    notifyListeners();
    return getLiffStateForType(type);
  }

  tc.configFetched = true;

  sdkInitializing = (async () => {
    try {
      console.log(`[LIFF Manager] (${type}) Fetching config from ${configEndpoint}`);
      const response = await fetch(configEndpoint);
      if (!response.ok) {
        throw new Error("Failed to fetch LIFF config");
      }
      const config = await response.json();
      tc.liffId = config.liff_id || null;

      if (!config.liff_id) {
        console.log(`[LIFF Manager] (${type}) No LIFF ID configured - proceeding without LIFF`);
        tc.noLiffConfigured = true;
        return;
      }

      console.log(`[LIFF Manager] (${type}) Initializing LIFF SDK with ID:`, config.liff_id);

      await liff.init({ liffId: config.liff_id });

      sdkInitialized = true;
      activeType = type;

      runtimeState.isInClient = liff.isInClient();
      runtimeState.isLoggedIn = liff.isLoggedIn();

      console.log(`[LIFF Manager] (${type}) SDK initialized successfully`, {
        isInClient: runtimeState.isInClient,
        isLoggedIn: runtimeState.isLoggedIn,
      });

      await fetchProfile();
    } catch (error: any) {
      console.error(`[LIFF Manager] (${type}) Initialization error:`, error);
      runtimeState.error = error.message || "Failed to initialize LIFF";
    } finally {
      notifyListeners();
    }
  })();

  await sdkInitializing;
  sdkInitializing = null;
  
  return getLiffStateForType(type);
}

export function liffLogin(redirectUri?: string): void {
  if (!sdkInitialized) {
    console.log("[LIFF Manager] Cannot login - LIFF SDK not initialized");
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
  if (!sdkInitialized) {
    throw new Error("LIFF is not initialized");
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
    sdkInitialized &&
    runtimeState.isLoggedIn &&
    typeof liff !== "undefined" &&
    liff.isApiAvailable?.("shareTargetPicker")
  );
}
