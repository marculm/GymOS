<script lang="ts">
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
</div>
