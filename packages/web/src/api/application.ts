export interface AppItem {
  name: string
  app_id: string
  app_key: string
  created: number
}

export interface AppListResponse {
  apps: AppItem[]
  count: number
}

export interface CreateAppBody {
  name: string
}

export interface DeleteAppBody {
  appid: string
}
