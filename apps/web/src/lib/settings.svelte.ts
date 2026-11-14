export type SettingsSection =
  | "root"
  | "plans"
  | "exercises"
  | "history"
  | "timer"
  | "targets"
  | "recipes"
  | "extractor";

class SettingsState {
  open = $state(false);
  section = $state<SettingsSection>("root");

  show(section: SettingsSection = "root") {
    this.section = section;
    this.open = true;
  }

  close() {
    this.open = false;
    this.section = "root";
  }

  reset() {
    this.open = false;
    this.section = "root";
  }
}

export const settings = new SettingsState();
