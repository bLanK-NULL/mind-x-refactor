<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <label class="style-field">
    <span class="style-field__label">{{ label }}</span>
    <span class="style-field__control">
      <slot />
    </span>
  </label>
</template>

<style scoped>
.style-field {
  display: grid;
  gap: 6px;
}

.style-field__label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
}

.style-field__control {
  min-width: 0;
}
</style>
