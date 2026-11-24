import type { DeptModel } from '~/api/contact'

export function useDeptList() {
  const { data: depts } = useWeilaFetch<{
    depts: DeptModel[]
  }>('corp/address/get-my-manage-dept-list')

  const deptOptions = computed(() => {
    return depts.value?.depts?.map(dept => ({
      label: `${dept.name} (${dept.user_count})`,
      value: dept.id,
      data: dept,
    })) || []
  })

  return {
    depts,
    deptOptions,
  }
}
