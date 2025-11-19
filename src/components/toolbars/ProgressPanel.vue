<script setup>

</script>

<template>
  <div class="row">
    <div class="col-2 money">
      <span>112 000 $</span>
    </div>
    <div class="col-10 user-progress">
      <div class="progress">
        <div
          class="progress-bar"
          role="progressbar"
          :style="{ width: '45%' }"
          aria-valuenow="45"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          Уровень 12 (45%)

        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>

</style>