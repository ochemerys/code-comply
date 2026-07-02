<template>
  <div :class="cardClasses">
    <div
      v-if="$slots.header"
      class="card-header border-b border-gray-200 dark:border-slate-700 pb-3 mb-3"
    >
      <slot name="header" />
    </div>
    <div class="card-body">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="card-footer border-t border-gray-200 dark:border-slate-700 pt-3 mt-3"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  padding: 'md',
  clickable: false,
})

const cardClasses = computed(() => {
  const classes = ['card']

  // Padding classes
  switch (props.padding) {
    case 'none':
      classes.push('p-0')
      break
    case 'sm':
      classes.push('p-2')
      break
    case 'md':
      classes.push('p-4')
      break
    case 'lg':
      classes.push('p-6')
      break
  }

  // Clickable state
  if (props.clickable) {
    classes.push(
      'cursor-pointer hover:shadow-lg transition-all dark:hover:shadow-none dark:hover:border-slate-500',
    )
  }

  return classes.join(' ')
})
</script>
