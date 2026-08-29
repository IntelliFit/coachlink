import type { UserConfigExport } from "@tarojs/cli";

const releaseApiUrl = process.env.TARO_APP_API_BASE_URL_RELEASE || 'https://coachlink.fit';
const trialApiUrl = process.env.TARO_APP_API_BASE_URL_TRIAL || 'https://dev.coachlink.fit';
// production 上传包中不注入本机地址；审核阶段即使显示 develop 也会由运行时解析器走正式 API。
const developApiUrl = process.env.TARO_APP_API_BASE_URL_DEVELOP || 'https://dev.coachlink.fit';
const apiBaseUrlOverride =
  process.env.TARO_APP_API_BASE_URL_OVERRIDE || process.env.TARO_APP_API_URL || '';

export default {
  defineConstants: {
    // 保留旧常量只用于兼容尚未迁移的代码；业务请求统一使用运行时 envVersion 解析器。
    TARO_APP_API_URL: JSON.stringify(releaseApiUrl),
    __API_BASE_URL_RELEASE__: JSON.stringify(releaseApiUrl),
    __API_BASE_URL_TRIAL__: JSON.stringify(trialApiUrl),
    __API_BASE_URL_DEVELOP__: JSON.stringify(developApiUrl),
    __API_BASE_URL_OVERRIDE__: JSON.stringify(apiBaseUrlOverride),
    __DEV_MODE__: JSON.stringify(false)
  },
  mini: {},
  h5: {
    /**
     * WebpackChain 插件配置
     * @docs https://github.com/neutrinojs/webpack-chain
     */
    // webpackChain (chain) {
    //   /**
    //    * 如果 h5 端编译后体积过大，可以使用 webpack-bundle-analyzer 插件对打包体积进行分析。
    //    * @docs https://github.com/webpack-contrib/webpack-bundle-analyzer
    //    */
    //   chain.plugin('analyzer')
    //     .use(require('webpack-bundle-analyzer').BundleAnalyzerPlugin, [])
    //   /**
    //    * 如果 h5 端首屏加载时间过长，可以使用 prerender-spa-plugin 插件预加载首页。
    //    * @docs https://github.com/chrisvfritz/prerender-spa-plugin
    //    */
    //   const path = require('path')
    //   const Prerender = require('prerender-spa-plugin')
    //   const staticDir = path.join(__dirname, '..', 'dist')
    //   chain
    //     .plugin('prerender')
    //     .use(new Prerender({
    //       staticDir,
    //       routes: [ '/pages/index/index' ],
    //       postProcess: (context) => ({ ...context, outputPath: path.join(staticDir, 'index.html') })
    //     }))
    // }
  }
} satisfies UserConfigExport<'vite'>
