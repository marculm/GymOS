<script lang="ts">
  import { page } from "$app/state";
  import TabBar from "$lib/TabBar.svelte";
  import "../styles.css";

  let { children } = $props();
</script>

<div class="app">
  <header class="app-header">
    <h1>🏋️ GymOS</h1>
    <p class="muted">All-in-one Gym & Nutrition OS</p>
  </header>

  <main class="content">
    {@render children()}
  </main>

  <TabBar pathname={page.url.pathname} />
</div>
