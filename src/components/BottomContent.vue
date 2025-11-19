<script setup>
import ProgressPanel from "./toolbars/ProgressPanel.vue";
import SystemCard from "./cards/SystemCard.vue";
</script>

<template>
  <div class="container-fluid bottom-content">
    <div class="row">
      <div class="col-3">
        <SystemCard/>
      </div>

      <div class="col-2">
        Созвоны
      </div>
      <div class="col-4">
        Снаряжение
      </div>
      <div class="col-3">
        Корабль
      </div>
    </div>
    <div class="row">
      <div class="col-12">
        <ProgressPanel/>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bottom-content {
  position: absolute;
  bottom: 0;
  width: 100%;
}

</style>