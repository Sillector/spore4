<script setup>
const props = defineProps({
  icon: {
    type: String,
    default: 'fa-bars'
  }
});
</script>

<template>
  <div  @click="$emit('click')">
    <i :class="'fa-solid ' + icon" aria-hidden="true"></i>
  </div>
</template>

<style scoped>
</style>