<script setup>
import ProgressPanel from "./toolbars/ProgressPanel.vue";
import SystemCard from "./cards/SystemCard.vue";
import ContactCard from "./cards/ContactCard.vue";
import InventoryCard from "./cards/InventoryCard.vue";
import ShipCard from "./cards/ShipCard.vue";
</script>

<template>
  <div class="bottom-content">
    <v-container fluid>
      <v-row>
        <v-col cols="3">
          <SystemCard/>
        </v-col>

        <v-col cols="2">
          <ContactCard/>
        </v-col>
        <v-col cols="5">
          <InventoryCard/>
        </v-col>
        <v-col cols="2">
          <ShipCard/>
        </v-col>
      </v-row>
    </v-container>
    <v-row>
      <v-col cols="12">
          <ProgressPanel/>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.bottom-content {
  position: absolute;
  bottom: 0;
  width: 100%;
}

</style>