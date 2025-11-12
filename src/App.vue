<template>
  <div class="app-shell">
    <div ref="gameRoot" class="game-surface"></div>
    <section class="info-panel">
      <h1>Galactic Command</h1>
      <p>Кликните по звезде, чтобы проложить маршрут. Скролл вниз — переход к системе. Скролл вверх — возврат.</p>
      <p>Внутри системы кликайте по планетам, чтобы перемещаться. Когда корабль прибудет на орбиту, прокрутите вниз для входа в режим орбиты.</p>
      <p>На орбите используйте WASD для перемещения по сфере, скролл регулирует высоту.</p>
    </section>
    <component v-if="panelComponent" :is="panelComponent" />
  </div>
</template>

<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { createSpaceGame } from './spaceGame.js';

const gameRoot = ref(null);
const panelComponent = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./devtools/ConfigPanel.vue'))
  : null;
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
