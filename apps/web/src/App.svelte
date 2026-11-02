<script lang="ts">
  import { Dumbbell, Sparkles, Utensils } from "lucide-svelte";
  import GymView from "./features/gym/GymView.svelte";

  type Tab = "gym" | "nutrition" | "extractor";

  const tabs = [
    { id: "gym" as const, label: "Gym", icon: Dumbbell },
    { id: "nutrition" as const, label: "Nutrition", icon: Utensils },
    { id: "extractor" as const, label: "AI Extractor", icon: Sparkles },
  ];

  let activeTab = $state<Tab>("gym");
  let sessionActive = $state(false);

  function handleSessionActive(active: boolean) {
    sessionActive = active;
  }
</script>

<div class="app">
  <header class="app-header">
    <h1>🏋️ GymOS</h1>
    <p class="muted">All-in-one Gym & Nutrition OS</p>
  </header>

  <main class="content">
    {#if activeTab === "gym"}
      <GymView onSessionActiveChange={handleSessionActive} />
    {:else if activeTab === "nutrition"}
      <section class="card">
        <h2 class="card-title">Nutrition & Mealprep</h2>
        <p class="muted">Calculate macros, plan meals, and log recipes.</p>
      </section>
    {:else}
      <section class="card">
        <h2 class="card-title">TikTok / Reels AI Extractor</h2>
        <p class="muted">Import recipes and ingredients directly from video URLs.</p>
      </section>
    {/if}
  </main>

  {#if !sessionActive}
    <nav class="tab-bar" aria-label="Main navigation">
      {#each tabs as { id, label, icon: Icon } (id)}
        <button
          type="button"
          class={activeTab === id ? "tab tab-active" : "tab"}
          aria-pressed={activeTab === id}
          onclick={() => (activeTab = id)}
        >
          <Icon size={20} aria-hidden="true" />
          {label}
        </button>
      {/each}
    </nav>
  {/if}
</div>
