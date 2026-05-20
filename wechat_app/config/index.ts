import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import { join, resolve } from 'path'
import devConfig from './dev'
import prodConfig from './prod'
import vitePluginImp from 'vite-plugin-imp'
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'vite'>(async (merge, { command, mode }) => {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const weappOutputRoot = process.env.WEAPP_OUTPUT_ROOT || (isDevelopment ? 'dist' : 'dist-release')

  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'coachlink-wechat-app',
    date: '2026-1-10',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: weappOutputRoot,
    plugins: ['@tarojs/plugin-html'],
    defineConstants: {
      ENABLE_INNER_HTML: JSON.stringify(true),
      ENABLE_ADJACENT_HTML: JSON.stringify(true),
      ENABLE_CLONE_NODE: JSON.stringify(true),
      ENABLE_CONTAINS: JSON.stringify(true),
      ENABLE_MUTATION_OBSERVER: JSON.stringify(true),
      ENABLE_SIZE_APIS: JSON.stringify(true),
      ENABLE_TEMPLATE_CONTENT: JSON.stringify(true),
      ENABLE_DOM_PARSER: JSON.stringify(true),
    },
    copy: {
      patterns: [

        { from: 'src/assets/iconfont/', to: 'assets/iconfont/' },
        { from: 'src/assets/brand/coachlink-logo.jpg', to: 'assets/brand/coachlink-logo.jpg' },
        { from: 'src/assets/brand/coachlink-brand-icon.png', to: 'assets/brand/coachlink-brand-icon.png' },
        { from: 'src/assets/images/login-bg.jpg', to: 'assets/images/login-bg.jpg' },
        { from: 'src/assets/images/toolbox-data.jpg', to: 'assets/images/toolbox-data.jpg' },
        { from: 'src/assets/images/toolbox-locations.jpg', to: 'assets/images/toolbox-locations.jpg' },
        { from: 'src/assets/images/toolbox-calculator.jpg', to: 'assets/images/toolbox-calculator.jpg' },
        { from: 'src/assets/images/toolbox-scenarios/', to: 'me/assets/images/toolbox-scenarios/' }
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: {
      vitePlugins: [
        {
          name: 'sass-silence-legacy-api',
          config() {
            return {
              css: {
                preprocessorOptions: {
                  scss: {
                    silenceDeprecations: ['legacy-js-api']
                  }
                }
              }
            }
          }
        },
        vitePluginImp({
          libList: [
            {
              libName: '@nutui/nutui-react-taro',
              style: (name) => {
                return `@nutui/nutui-react-taro/dist/esm/${name}/style/css`
              },
              replaceOldImport: false,
              camel2DashComponentName: false,
            }
          ]
        }),
        UnifiedViteWeappTailwindcssPlugin()
      ],
      type: 'vite'
    },
    alias: {
      '@': resolve(__dirname, '..', 'src'),
      // 确保 React 单例，避免 lucide-react、@nutui 等依赖导致 "useEffect of undefined"
      react: resolve(__dirname, '..', 'node_modules/react'),
      'react-dom': resolve(__dirname, '..', 'node_modules/react-dom'),
    },
    mini: {
      imageUrlLoaderOption: {
        limit: 50 * 1024,
      },
      postcss: {
        url: {
          enable: false,
        },
        tailwindcss: {
          enable: true,
        },
        autoprefixer: {
          enable: true,
          config: {}
        },
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['nut-']
          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',

      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }
  if (isDevelopment) {
    console.log('📦 小程序输出目录:', weappOutputRoot)
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
