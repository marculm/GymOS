<script lang="ts">
  import { onMount } from "svelte";
  import {
    Bell,
    ChevronLeft,
    ChevronRight,
    Dumbbell,
    History as HistoryIcon,
    ListChecks,
    Sparkles,
    Timer,
    X,
  } from "lucide-svelte";
  import {
    disablePush,
    enablePush,
    isPushSubscribed,
    isPushSupported,
  } from "../push.mts";
  import History from "../features/gym/History.svelte";
  import { gymData } from "../features/gym/gym-data.svelte.ts";
  import Library from "../features/gym/Library.svelte";
  import {
    formatRestTime,
    loadRestSeconds,
    REST_PRESETS,
    saveRestSeconds,
  } from "./rest-timer.ts";
  import {
    restoreThemeColor,
    setThemeColor,
  } from "./theme-color.ts";
  import {
    settings,
    type SettingsSection,
  } from "./settings.svelte.ts";

  let dialog = $state<HTMLDialogElement | null>(null);
  let pushSupported = $state(false);
  let pushEnabled = $state(false);
  let pushPending = $state(false);
  let pushError = $state<string | null>(null);
  let restSeconds = $state(loadRestSeconds());

  const titles: Record<Exclude<SettingsSection, "root">, string> = {
    plans: "Plans",
    exercises: "Exercises",
    history: "History",
    timer: "Rest timer",
    extractor: "AI Extractor",
  };

  $effect(() => {
    if (!dialog) return;
    if (settings.open && !dialog.open) {
      dialog.showModal();
      dialog.focus();
      restSeconds = loadRestSeconds();
      setThemeColor("#f2f2f7");
      void gymData.load();
      void refreshPush();
    } else if (!settings.open && dialog.open) {
      dialog.close();
      restoreThemeColor();
    }
  });

  onMount(() => {
    pushSupported = isPushSupported();
  });

  async function refreshPush() {
    pushSupported = isPushSupported();
    pushEnabled = pushSupported ? await isPushSubscribed() : false;
  }

  async function togglePush() {
    if (pushPending || !pushSupported) return;
    pushPending = true;
    pushError = null;
    try {
      if (pushEnabled) {
        await disablePush();
        pushEnabled = false;
      } else {
        pushEnabled = await enablePush();
        if (!pushEnabled) {
          pushError =
            "Notifications are unavailable. The in-app timer still works.";
        }
      }
    } catch (error) {
      pushError =
        error instanceof Error
          ? error.message
          : "Could not change notification settings";
    } finally {
      pushPending = false;
    }
  }

  function selectRest(seconds: number) {
    restSeconds = seconds;
    saveRestSeconds(seconds);
  }

  function close() {
    settings.close();
  }

  function back() {
    settings.section = "root";
  }

  function handleBackdrop(event: MouseEvent) {
    const rect = dialog?.getBoundingClientRect();
    if (!rect) return;
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) close();
  }
</script>

<dialog
  bind:this={dialog}
  class="settings-sheet light-space"
  tabindex="-1"
  aria-labelledby="settings-title"
  onclose={close}
  onclick={handleBackdrop}
>
  <header class="settings-head">
    <div class="settings-head-main">
      {#if settings.section === "root"}
        <h1 class="settings-title" id="settings-title">Settings</h1>
      {:else}
        <button
          type="button"
          class="icon-btn muted settings-back"
          aria-label="Back to settings"
          onclick={back}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h1 class="settings-title settings-title-sub" id="settings-title">
          {titles[settings.section]}
        </h1>
      {/if}
    </div>
    <button
      type="button"
      class="icon-btn muted settings-close"
      aria-label="Close settings"
      onclick={close}
    >
      <X size={22} aria-hidden="true" />
    </button>
  </header>

  <div class="settings-body">
    {#if settings.section === "root"}
      <section class="section">
        <h2 class="section-header">Training</h2>
        <div class="group">
          <button
            type="button"
            class="settings-row"
            onclick={() => (settings.section = "plans")}
          >
            <span class="settings-icon"><Dumbbell size={17} aria-hidden="true" /></span>
            <span class="settings-label">Training plans</span>
            <ChevronRight class="settings-chevron" size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="settings-row"
            onclick={() => (settings.section = "exercises")}
          >
            <span class="settings-icon"><ListChecks size={17} aria-hidden="true" /></span>
            <span class="settings-label">Exercises</span>
            <ChevronRight class="settings-chevron" size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="settings-row"
            onclick={() => (settings.section = "history")}
          >
            <span class="settings-icon"><HistoryIcon size={17} aria-hidden="true" /></span>
            <span class="settings-label">History</span>
            <ChevronRight class="settings-chevron" size={17} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section class="section">
        <h2 class="section-header">Session</h2>
        <div class="group">
          <button
            type="button"
            class="settings-row"
            onclick={() => (settings.section = "timer")}
          >
            <span class="settings-icon"><Timer size={17} aria-hidden="true" /></span>
            <span class="settings-label">Rest timer</span>
            <span class="settings-value">{formatRestTime(restSeconds)}</span>
            <ChevronRight class="settings-chevron" size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="settings-row"
            role="switch"
            aria-checked={pushEnabled}
            aria-label="Rest timer notifications"
            disabled={!pushSupported || pushPending}
            onclick={() => void togglePush()}
          >
            <span class="settings-icon"><Bell size={17} aria-hidden="true" /></span>
            <span class="settings-label">Notifications</span>
            <span class="switch" class:on={pushEnabled} aria-hidden="true"></span>
          </button>
        </div>
        {#if pushError}
          <p class="error settings-error" role="alert">{pushError}</p>
        {:else if !pushSupported}
          <p class="settings-note">
            Notifications are not available in this browser. The in-app timer
            still works.
          </p>
        {/if}
      </section>

      <section class="section">
        <h2 class="section-header">More</h2>
        <div class="group">
          <button
            type="button"
            class="settings-row"
            onclick={() => (settings.section = "extractor")}
          >
            <span class="settings-icon"><Sparkles size={17} aria-hidden="true" /></span>
            <span class="settings-label">AI Extractor</span>
            <span class="settings-value">Coming soon</span>
            <ChevronRight class="settings-chevron" size={17} aria-hidden="true" />
          </button>
        </div>
      </section>
    {:else if settings.section === "plans" || settings.section === "exercises"}
      <Library view={settings.section} />
    {:else if settings.section === "history"}
      <History plans={gymData.plans} />
    {:else if settings.section === "timer"}
      <section class="section">
        <h2 class="section-header">Default rest</h2>
        <div class="group">
          {#each REST_PRESETS as preset (preset)}
            <button
              type="button"
              class="settings-row"
              aria-pressed={preset === restSeconds}
              onclick={() => selectRest(preset)}
            >
              <span class="settings-label">{formatRestTime(preset)}</span>
              {#if preset === restSeconds}
                <span class="settings-check" aria-hidden="true">✓</span>
              {/if}
            </button>
          {/each}
        </div>
        <p class="settings-note">
          Starts automatically after each logged set. You can change it during
          a workout too.
        </p>
      </section>
    {:else if settings.section === "extractor"}
      <section class="section">
        <div class="settings-placeholder">
          <span class="settings-placeholder-icon">
            <Sparkles size={26} aria-hidden="true" />
          </span>
          <h2 class="settings-placeholder-title">AI Extractor</h2>
          <p class="settings-placeholder-copy">
            Recipes from TikTok and Reels. Coming soon.
          </p>
        </div>
      </section>
    {/if}
  </div>
</dialog>
