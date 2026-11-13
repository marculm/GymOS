<script lang="ts">
  import { Dumbbell, Sparkles, Utensils } from "lucide-svelte";

  let { pathname }: { pathname: string } = $props();

  const tabs = [
    { href: "/gym", label: "Gym", icon: Dumbbell },
    { href: "/nutrition", label: "Nutrition", icon: Utensils },
    { href: "/extractor", label: "AI Extractor", icon: Sparkles },
  ] as const;

  function isActive(href: string, current: string): boolean {
    return current === href || current.startsWith(`${href}/`);
  }
</script>

<nav class="tab-bar" aria-label="Main navigation">
  {#each tabs as { href, label, icon: Icon } (href)}
    <a
      {href}
      class={isActive(href, pathname) ? "tab tab-active" : "tab"}
      aria-current={isActive(href, pathname) ? "page" : undefined}
    >
      <Icon size={20} aria-hidden="true" />
      {label}
    </a>
  {/each}
</nav>
