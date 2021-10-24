<script>
  let form,
    code = "";
  function submitForm(e) {
    const data = Object.fromEntries(new FormData(form).entries());
    fetch("/api/route", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((response) => response.text())
      .then((text) => {
        code = text;
      });
  }
</script>

<template>
  <form bind:this={form} on:submit|preventDefault={submitForm}>
    <div>
      <label for="origin">Origin: </label>
      <input type="text" id="origin" name="origin" />
    </div>
    <div>
      <label for="origin">Destination: </label>
      <input type="text" id="destination" name="destination" />
    </div>
    <div>
      <label for="getAll">Display all:</label>
      <input type="checkbox" id="getAll" name="getAll" />
    </div>
    <div>
      <input type="submit" id="submit" />
    </div>
  </form>
  <code>{code}</code>
</template>

<style lang="scss">
  :global(body) {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
  }

  .App {
    text-align: center;
  }
</style>
