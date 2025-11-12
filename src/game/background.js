import * as THREE from 'three';
import { getConfig } from '../config/store.js';

const backgroundConfig = getConfig('background');

export function createBackgroundNebula(scene) {
  // Создаём equirect-текстуру с мелкими звёздами и лёгким фиолетовым свечением
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Параметры свечения из конфига
  const glow = backgroundConfig.glow || {};
  const centerX = Number.isFinite(glow.centerX) ? glow.centerX : 0.5;
  const centerY = Number.isFinite(glow.centerY) ? glow.centerY : 0.45;
  const innerRadiusFactor = Number.isFinite(glow.innerRadiusFactor) ? glow.innerRadiusFactor : 0.1;
  const outerRadiusFactor = Number.isFinite(glow.outerRadiusFactor) ? glow.outerRadiusFactor : 0.7;
  const innerColorHex = glow.innerColor || '#8c3cc8';
  const outerColorHex = glow.outerColor || '#0a0612';
  const innerAlpha = Number.isFinite(glow.innerAlpha) ? glow.innerAlpha : 0.25;
  const outerAlpha = Number.isFinite(glow.outerAlpha) ? glow.outerAlpha : 1;

  const innerColor = new THREE.Color(innerColorHex);
  const outerColor = new THREE.Color(outerColorHex);
  const rgba = (color, a) => `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${a})`;

  // Базовый тёмный фон (соответствует внешнему цвету свечения)
  ctx.fillStyle = rgba(outerColor, 1);
  ctx.fillRect(0, 0, width, height);

  // Лёгкое фоновое свечение (радиальный градиент)
  const cx = width * centerX;
  const cy = height * centerY;
  const innerR = Math.min(width, height) * innerRadiusFactor;
  const outerR = Math.max(width, height) * outerRadiusFactor;
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0, rgba(innerColor, innerAlpha));
  grad.addColorStop(1, rgba(outerColor, outerAlpha));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Параметры псевдо-звёзд из конфига
  const starCfg = backgroundConfig.star || {};
  const sizeMin = Number.isFinite(starCfg.sizeMin) ? starCfg.sizeMin : 0.6;
  const sizeMax = Number.isFinite(starCfg.sizeMax) ? starCfg.sizeMax : 1.8;
  const altProbability = Math.min(1, Math.max(0, Number(starCfg.altProbability ?? 0.12)));
  const mainColor = new THREE.Color(starCfg.colorMain || '#ffffff');
  const altColor = new THREE.Color(starCfg.colorAlt || '#c8a0ff');

  // Рисуем небольшие звёзды-точки
  const starCount = Math.max(0, backgroundConfig.starCount | 0);
  for (let i = 0; i < starCount; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    // Размер из диапазона конфига
    const size = sizeMin + Math.random() * Math.max(0, sizeMax - sizeMin);
    // Яркость 0.65..1.0
    const a = 0.65 + Math.random() * 0.35;
    // Выбираем основной или альтернативный оттенок
    const base = Math.random() < altProbability ? altColor : mainColor;
    const r = Math.round(base.r * 255);
    const g = Math.round(base.g * 255);
    const b = Math.round(base.b * 255);

    ctx.beginPath();
    ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // лёгкий ореол для ярких звёзд
    if (a > 0.9 && Math.random() < 0.2) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      halo.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  // Используем equirectangular отображение, чтобы получить «скайбокс»-эффект
  texture.mapping = THREE.EquirectangularReflectionMapping;
  // Современные версии three используют colorSpace, старые — encoding. Стараемся быть совместимыми.
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else if ('encoding' in texture) {
    texture.encoding = THREE.sRGBEncoding;
  }
  texture.needsUpdate = true;

  // Назначаем как фон сцены
  scene.background = texture;
}
