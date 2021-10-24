<script lang="ts">
  import { onMount } from "svelte";

  let count: number = 0;
  onMount(() => {
    const interval = setInterval(() => count++, 1000);
    return () => {
      clearInterval(interval);
    };
  });
</script>

<template lang="pug">
  .App
    header.App-header
      img.App-logo(src='/logo.svg', alt='logo')
      p
        | Edit 
        code src/App.svelte
        |  and save to reload.
      p
        | Page has been open for 
        code {count}
        |  seconds.
      p
        a.App-link(href='https://svelte.dev', target='_blank', rel='noopener noreferrer')
          | Learn Svelte
</template>

<style lang="scss">
  :global(body) {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
  }

  .App {
    text-align: center;
  }

  .App code {
    background: #0002;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .App p {
    margin: 0.4rem;
  }

  .App-header {
    background-color: #f9f6f6;
    color: #333;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: calc(10px + 2vmin);
  }

  .App-link {
    color: #ff3e00;
  }

  .App-logo {
    height: 36vmin;
    pointer-events: none;
    margin-bottom: 3rem;
    animation: App-logo-spin infinite 1.6s ease-in-out alternate;
  }

  @keyframes App-logo-spin {
    from {
      transform: scale(1);
    }
    to {
      transform: scale(1.06);
    }
  }
</style>
