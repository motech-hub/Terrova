export type TerrovaStyle = "elegant" | "dynamic";
export type TerrovaRatio = "9:16" | "16:9";
export type TerrovaDuration = 10 | 15;

export type TerrovaSettings = {
  defaultStyle: TerrovaStyle;
  defaultRatio: TerrovaRatio;
  defaultDuration: TerrovaDuration;
  emailNotifications: boolean;
  productUpdates: boolean;
};

export const defaultTerrovaSettings: TerrovaSettings = {
  defaultStyle: "elegant",
  defaultRatio: "9:16",
  defaultDuration: 10,
  emailNotifications: true,
  productUpdates: false,
};

const SETTINGS_STORAGE_KEY = "terrova-settings";

export function readTerrovaSettings(): TerrovaSettings {
  if (typeof window === "undefined") return defaultTerrovaSettings;

  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null") as Partial<TerrovaSettings> | null;
    if (!saved) return defaultTerrovaSettings;

    return {
      defaultStyle: saved.defaultStyle === "dynamic" ? "dynamic" : "elegant",
      defaultRatio: saved.defaultRatio === "16:9" ? "16:9" : "9:16",
      defaultDuration: saved.defaultDuration === 15 ? 15 : 10,
      emailNotifications: saved.emailNotifications !== false,
      productUpdates: saved.productUpdates === true,
    };
  } catch {
    return defaultTerrovaSettings;
  }
}

export function saveTerrovaSettings(settings: TerrovaSettings) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }
}
