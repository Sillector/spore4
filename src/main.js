import { createSpaceGame } from './spaceGame.js';
import { setupConfigPanel } from './devtools/configPanel.js';

const app = document.getElementById('app');
const info = document.createElement('section');
info.className = 'info-panel';
info.innerHTML = `
  <h1>Galactic Command</h1>
  <p>Кликните по звезде, чтобы проложить маршрут. Скролл вниз — переход к системе. Скролл вверх — возврат.</p>
  <p>Внутри системы кликайте по планетам, чтобы перемещаться. Когда корабль прибудет на орбиту, прокрутите вниз для входа в режим орбиты.</p>
  <p>На орбите используйте WASD для перемещения по сфере, скролл регулирует высоту.</p>
`;
app.appendChild(info);

createSpaceGame(app);
setupConfigPanel();
