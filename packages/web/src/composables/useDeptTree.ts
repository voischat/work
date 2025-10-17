import type { TreeNodeData } from '~/types'
import type { Member } from '~/types/api'
import Message from '@arco-design/web-vue/es/message'
import { ref as deepRef, watchEffect } from 'vue'

export function useDeptTree() {
  const { data: depts } = useWeilaFetch<any>('/corp/address/get-all-dept')
  const treeData = deepRef<TreeNodeData[]>([])

  watchEffect(() => {
    treeData.value = depts.value?.map((dept: any) => ({
      title: `${dept.name} (${dept.user_count})`,
      key: `dept-${dept.id}`,
      selectable: false,
    }))
  })

  async function loadMore(nodeData: TreeNodeData) {
    const dept_id = Number(nodeData.key.replace('dept-', ''))
    const weilaApi = useWeilaApi()

    const members = await weilaApi.value.v2.fetch<Member[]>('corp/address/get-dept-all-member', {
      body: { dept_id },
    })

    if (!members.length) {
      Message.warning('无数据')
      return
    }

    nodeData.children = members.map(member => ({
      key: `member-${member.user_id}`,
      title: member.name,
      isLeaf: true,
      selectable: true,
    }))

    if (nodeData.children.some(i => i.checkable))
      nodeData.checkable = true
  }

  return {
    treeData,
    loadMore,
  }
}
