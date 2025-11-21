<script setup>

</script>

<template>
  <v-card>
    <v-container fluid class="py-0">
      <v-row>
        <v-col cols="2">
          <span>112 000 $</span>
        </v-col>
        <v-col cols="10">
          <v-progress-linear
              :value="45"
              height="20"
              color="blue"
          >
            Уровень 12 (45%)
          </v-progress-linear>
        </v-col>
      </v-row>
    </v-container>

  </v-card>
</template>

<style scoped>

</style>