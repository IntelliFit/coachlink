import * as ImagePicker from 'expo-image-picker'

/**
 * iPhone 相册默认是 HEIC，选图器会原样返回并忽略 quality。
 * 安卓和小程序显示不了，薄肌检测和计划识别的服务端也读不了，所以统一要 JPEG。安卓上这个选项不起作用。
 */
export const COMPATIBLE_IMAGE_OPTIONS = {
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
} as const
