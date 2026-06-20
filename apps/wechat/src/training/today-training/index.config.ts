export default definePageConfig({
  /** 隐藏系统导航栏（返回、标题「训练」与白底栏），内容区需自行避让状态栏 */
  navigationStyle: 'custom',
  navigationBarTitleText: '训练',
  navigationBarBackgroundColor: '#ffffff',
  navigationBarTextStyle: 'black',
  enableShareAppMessage: true,
  enableShareTimeline: true,
  animationType: 'none'
})

