import { WL_IDbMsgDataType } from 'db/weila_db_data'
import type { WL_IDbFileData, WL_MediaMsgType, WL_MsgContent } from 'db/weila_db_data'

const MEDIA_MSG_CONTENT_BUILDERS: Record<
  WL_MediaMsgType,
  (fileInfo: WL_IDbFileData) => WL_MsgContent
> = {
  [WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE]: (fileInfo) => ({
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_IMAGE_TYPE,
    fileInfo,
  }),
  [WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE]: (fileInfo) => ({
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_VIDEO_TYPE,
    fileInfo,
  }),
  [WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE]: (fileInfo) => ({
    msgType: WL_IDbMsgDataType.WL_DB_MSG_DATA_FILE_TYPE,
    fileInfo,
  }),
}

function createMediaMsgContent(msgType: WL_MediaMsgType, fileInfo: WL_IDbFileData): WL_MsgContent {
  return MEDIA_MSG_CONTENT_BUILDERS[msgType](fileInfo)
}

export { createMediaMsgContent }
