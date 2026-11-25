import type { GroupModel } from '~/api/contact'
import { computed } from 'vue'
import { useWeilaFetch } from '~/composables/useWeilaFetch'

export function useGroupList() {
  const { data: groups } = useWeilaFetch<{
    groups: GroupModel[]
    count: number
  }>('corp/group/get-my-manage-group-list')

  const groupOptions = computed(() => {
    return groups.value?.groups?.map(group => ({
      label: `${group.name} (${group.user_count})`,
      value: group.id,
      data: group,
    })) || []
  })

  return {
    groups,
    groupOptions,
  }
}
