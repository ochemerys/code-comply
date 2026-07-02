import { computed } from 'vue'
import { useRoute, type RouteRecordNormalized } from 'vue-router'

export interface RouteBreadcrumbItem {
  label: string
  to: string
}

export const APP_BREADCRUMB: RouteBreadcrumbItem = {
  label: 'CodeComply Admin',
  to: '/',
}

function breadcrumbPathForMatch(
  matched: RouteRecordNormalized[],
  index: number,
  currentPath: string,
): string {
  if (index === matched.length - 1) {
    return currentPath
  }

  const parts: string[] = []
  for (let i = 0; i <= index; i++) {
    const segment = matched[i].path
    if (segment.includes(':')) {
      continue
    }
    if (segment.startsWith('/')) {
      parts.length = 0
      parts.push(segment.replace(/^\//, ''))
    } else {
      parts.push(segment)
    }
  }

  const joined = parts.filter(Boolean).join('/')
  return joined ? `/${joined}` : '/'
}

export function useRouteBreadcrumb() {
  const route = useRoute()

  const routeItems = computed<RouteBreadcrumbItem[]>(() => {
    const matched = route.matched.filter((record) => record.meta?.title)
    return matched.map((record, index) => ({
      label: String(record.meta.title),
      to: breadcrumbPathForMatch(matched, index, route.path),
    }))
  })

  const items = computed<RouteBreadcrumbItem[]>(() => [APP_BREADCRUMB, ...routeItems.value])

  const pageTitle = computed(() => routeItems.value.at(-1)?.label ?? APP_BREADCRUMB.label)

  const parentItems = computed(() => items.value.slice(0, -1))

  return { items, pageTitle, parentItems, routeItems }
}
