<script setup>

import ButtonIcon from "./buttons/ButtonIcon.vue";
</script>

<template>
  <div class="container-fluid top-content">
    <div class="row">
      <div class="col-6">
        <ButtonIcon icon="fa-parachute-box"/>
        <ButtonIcon icon="fa-house"/>
      </div>

      <div class="col-6 text-end">
        <ButtonIcon icon="fa-bars"/>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top-content {
  position: absolute;
  top: 0;
  width: 100%;
  padding-top: 10px;
}

</style>