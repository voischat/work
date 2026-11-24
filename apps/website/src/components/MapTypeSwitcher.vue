<script setup lang="ts">
type MapType = 'normal' | 'satellite'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const options: Array<{ label: string, type: MapType, spriteIndex: number }> = [
  { label: '地图', type: 'normal', spriteIndex: 0 },
  { label: '卫星', type: 'satellite', spriteIndex: 1 },
]

function selectType(type: MapType) {
  emit('update:modelValue', type === 'satellite')
}
</script>

<template>
  <div class="map-type-switcher" aria-label="地图类型切换">
    <button
      v-for="option in options"
      :key="option.type"
      type="button"
      class="map-type-switcher__item"
      :class="{ 'map-type-switcher__item--active': props.modelValue === (option.type === 'satellite') }"
      :aria-pressed="props.modelValue === (option.type === 'satellite')"
      @click="selectType(option.type)"
    >
      <span
        class="map-type-switcher__thumb"
        :style="{ backgroundPositionY: `-${option.spriteIndex * 60}px` }"
      />
      <span class="map-type-switcher__label">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.map-type-switcher {
  position: absolute;
  right: 16px;
  bottom: 18px;
  z-index: 10;
  display: flex;
  gap: 10px;
  padding: 12px;
  background: rgb(255 255 255 / 82%);
  box-shadow: 0 2px 10px rgb(31 35 41 / 16%);
  backdrop-filter: blur(2px);
}

.map-type-switcher__item {
  position: relative;
  width: 86px;
  height: 60px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 4px;
  outline: none;
}

.map-type-switcher__item:focus-visible,
.map-type-switcher__item--active {
  border-color: #2f80ff;
}

.map-type-switcher__thumb {
  display: block;
  width: 86px;
  height: 60px;
  background-image: url('/maptype2x_282f70b.png');
  background-repeat: no-repeat;
  background-size: 86px 240px;
}

.map-type-switcher__label {
  position: absolute;
  right: 6px;
  bottom: 4px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 3px rgb(0 0 0 / 90%);
}
</style>
