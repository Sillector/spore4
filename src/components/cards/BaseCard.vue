<script setup>
const props = defineProps({
  title: {
  }
});
</script>

<template>
  <div class="card">
    <div class="card-title" v-if="title">{{ title }}</div>
    <div class="card-body">
      <slot></slot>
    </div>
  </div>

</template>

<style scoped>

</style>