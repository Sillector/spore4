<template>
  <v-app>
    <div class="app-shell">
      <div ref="gameRoot" class="game-surface"></div>
      <ConfigPanel v-if="panelComponent" />
      <TopContent />
      <BottomContent />
    </div>
  </v-app>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { createSpaceGame } from './spaceGame.js';
import ConfigPanel from "./devtools/ConfigPanel.vue";
import BottomContent from "./components/BottomContent.vue";
import TopContent from "./components/TopContent.vue";

const gameRoot = ref(null);
const panelComponent = !!import.meta.env.DEV;
let gameInstance = null;

onMounted(() => {
  if (!gameRoot.value) {
    return;
  }
  gameInstance = createSpaceGame(gameRoot.value);
});

onBeforeUnmount(() => {
  if (gameInstance) {
    gameInstance.dispose();
    gameInstance = null;
  }
});
</script>
