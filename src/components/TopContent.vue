<script setup>
</script>

<template>
  <v-container fluid class="top-content">
    <v-row>
      <v-col cols="6">
        <v-btn icon class="mr-4">
          <v-icon  icon="fas fa-parachute-box"/>
        </v-btn>
        <v-btn icon class="mr-4">
          <v-icon  icon="fas fa-parachute-box"/>
        </v-btn>
        <v-btn icon class="mr-4">
          <v-icon  icon="fas fa-parachute-box"/>
        </v-btn>
      </v-col>
      <v-col cols="6" class="text-end">
        <v-btn icon>
          <v-icon  icon="fas fa-bars"/>
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.top-content {
  position: absolute;
  top: 0;
  width: 100%;
  padding-top: 10px;
}

</style>