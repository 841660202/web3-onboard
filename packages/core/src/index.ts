import connectWallet from './connect.js'
import disconnectWallet from './disconnect.js'
import setChain from './chain.js'
import { state } from './store/index.js'
import { reset$, wallets$ } from './streams.js'
import initI18N from './i18n/index.js'
import App from './views/Index.svelte'
import type {
  ConnectModalOptions,
  InitOptions,
  Notify,
  Theme
} from './types.js'
import { APP_INITIAL_STATE, STORAGE_KEYS } from './constants.js'
import { configuration, updateConfiguration } from './configuration.js'
import updateBalances from './update-balances.js'
import { chainIdToHex, getLocalStore, setLocalStore } from './utils.js'
import { preflightNotifications } from './preflight-notifications.js'

import {
  validateInitOptions,
  validateNotify,
  validateNotifyOptions
} from './validation.js'

import {
  addChains,
  updateAccountCenter,
  updateNotify,
  customNotification,
  setLocale,
  setPrimaryWallet,
  setWalletModules,
  updateConnectModal,
  updateTheme,
  updateAppMetadata
} from './store/actions.js'
import type { PatchedEIP1193Provider } from '@web3-onboard/transaction-preview'
import { getBlocknativeSdk } from './services.js'

const API = {
  connectWallet,
  disconnectWallet,
  setChain,
  state: {
    get: state.get,
    select: state.select,
    actions: {
      setWalletModules,
      setLocale,
      updateNotify,
      customNotification,
      preflightNotifications,
      updateBalances,
      updateAccountCenter,
      setPrimaryWallet,
      updateTheme,
      updateAppMetadata
    }
  }
}

export type OnboardAPI = typeof API

export type {
  InitOptions,
  ConnectOptions,
  DisconnectOptions,
  WalletState,
  ConnectedChain,
  AccountCenter,
  AppState,
  CustomNotification,
  Notification,
  Notify,
  UpdateNotification,
  PreflightNotificationsOptions,
  Theme
} from './types.js'

export type { EIP1193Provider } from '@web3-onboard/common'

function init(options: InitOptions): OnboardAPI {
  if (typeof window === 'undefined') return API

  if (options) {
    const error = validateInitOptions(options)

    if (error) {
      throw error
    }
  }

  const {
    wallets,
    chains,
    appMetadata,
    i18n,
    accountCenter,
    apiKey,
    notify,
    gas,
    connect,
    containerElements,
    transactionPreview,
    theme,
    disableFontDownload,
    unstoppableResolution
  } = options

  if (containerElements) updateConfiguration({ containerElements })

  const { device, svelteInstance } = configuration

  if (svelteInstance) {
    // if already initialized, need to cleanup old instance
    console.warn('Re-initializing Onboard and resetting back to initial state')
    reset$.next()
  }

  initI18N(i18n)
  addChains(chainIdToHex(chains))

  if (typeof connect !== undefined) {
    updateConnectModal(connect)
  }
  // update accountCenter
  if (typeof accountCenter !== 'undefined') {
    let accountCenterUpdate
    const { hideTransactionProtectionBtn, transactionProtectionInfoLink } =
      accountCenter

    if (device.type === 'mobile') {
      accountCenterUpdate = {
        ...APP_INITIAL_STATE.accountCenter,
        hideTransactionProtectionBtn,
        transactionProtectionInfoLink,
        ...(accountCenter.mobile ? accountCenter.mobile : {})
      }
    } else if (accountCenter.desktop) {
      accountCenterUpdate = {
        ...APP_INITIAL_STATE.accountCenter,
        hideTransactionProtectionBtn,
        transactionProtectionInfoLink,
        ...accountCenter.desktop
      }
    }
    updateAccountCenter(accountCenterUpdate)
  }

  // update notify
  if (typeof notify !== 'undefined') {
    if ('desktop' in notify || 'mobile' in notify) {
      const error = validateNotifyOptions(notify)

      if (error) {
        throw error
      }

      if (
        (!notify.desktop || (notify.desktop && !notify.desktop.position)) &&
        accountCenter &&
        accountCenter.desktop &&
        accountCenter.desktop.position
      ) {
        notify.desktop.position = accountCenter.desktop.position
      }

      if (
        (!notify.mobile || (notify.mobile && !notify.mobile.position)) &&
        accountCenter &&
        accountCenter.mobile &&
        accountCenter.mobile.position
      ) {
        notify.mobile.position = accountCenter.mobile.position
      }

      let notifyUpdate: Partial<Notify>

      if (device.type === 'mobile' && notify.mobile) {
        notifyUpdate = {
          ...APP_INITIAL_STATE.notify,
          ...notify.mobile
        }
      } else if (notify.desktop) {
        notifyUpdate = {
          ...APP_INITIAL_STATE.notify,
          ...notify.desktop
        }
      }

      updateNotify(notifyUpdate)
    } else {
      const error = validateNotify(notify as Notify)

      if (error) {
        throw error
      }

      const notifyUpdate: Partial<Notify> = {
        ...APP_INITIAL_STATE.notify,
        ...notify
      }

      updateNotify(notifyUpdate)
    }
  } else {
    const notifyUpdate: Partial<Notify> = APP_INITIAL_STATE.notify

    updateNotify(notifyUpdate)
  }

  const app = svelteInstance || mountApp(theme, disableFontDownload)

  updateConfiguration({
    svelteInstance: app,
    apiKey,
    initialWalletInit: wallets,
    gas,
    transactionPreview,
    unstoppableResolution
  })

  appMetadata && updateAppMetadata(appMetadata)

  if (apiKey && transactionPreview) {
    const getBnSDK = async () => {
      transactionPreview.init({
        containerElement: '#w3o-transaction-preview-container',
        sdk: await getBlocknativeSdk(),
        apiKey
      })
      wallets$.subscribe(wallets => {
        wallets.forEach(({ provider }) => {
          transactionPreview.patchProvider(provider as PatchedEIP1193Provider)
        })
      })
    }
    getBnSDK()
  }

  theme && updateTheme(theme)

  // handle auto connection of last wallet
  if (
    connect &&
    (connect.autoConnectLastWallet || connect.autoConnectAllPreviousWallet)
  ) {
    const lastConnectedWallets = getLocalStore(
      STORAGE_KEYS.LAST_CONNECTED_WALLET
    )
    try {
      const lastConnectedWalletsParsed = JSON.parse(lastConnectedWallets)
      if (
        lastConnectedWalletsParsed &&
        Array.isArray(lastConnectedWalletsParsed) &&
        lastConnectedWalletsParsed.length
      ) {
        connectAllPreviousWallets(lastConnectedWalletsParsed, connect)
      }
    } catch (err) {
      // Handle for legacy single wallet approach
      // Above try will throw syntax error is local storage is not json
      if (err instanceof SyntaxError && lastConnectedWallets) {
        API.connectWallet({
          autoSelect: {
            label: lastConnectedWallets,
            disableModals: true
          }
        })
      }
    }
  }

  return API
}

const fontFamilyExternallyDefined = (
  theme: Theme,
  disableFontDownload: boolean
): boolean => {
  if (disableFontDownload) return true
  if (
    document.body &&
    (getComputedStyle(document.body).getPropertyValue(
      '--onboard-font-family-normal'
    ) ||
      getComputedStyle(document.body).getPropertyValue('--w3o-font-family'))
  )
    return true
  if (!theme) return false
  if (typeof theme === 'object' && theme['--w3o-font-family']) return true
  return false
}

const importInterFont = async (): Promise<void> => {
  const { InterVar } = await import('@web3-onboard/common')
  // Add Fonts to main page
  const styleEl = document.createElement('style')

  styleEl.innerHTML = `
    ${InterVar}
  `

  document.body.appendChild(styleEl)
}

const connectAllPreviousWallets = async (
  lastConnectedWallets: Array<string>,
  connect: ConnectModalOptions
): Promise<void> => {
  const activeWalletsList = []
  const parsedWalletList = lastConnectedWallets
  if (!connect.autoConnectAllPreviousWallet) {
    API.connectWallet({
      autoSelect: { label: parsedWalletList[0], disableModals: true }
    })
    activeWalletsList.push(parsedWalletList[0])
  } else {
    // Loop in reverse to maintain wallet order
    for (let i = parsedWalletList.length; i--; ) {
      const walletConnectionPromise = await API.connectWallet({
        autoSelect: { label: parsedWalletList[i], disableModals: true }
      })
      // Update localStorage list for available wallets
      if (walletConnectionPromise.some(r => r.label === parsedWalletList[i])) {
        activeWalletsList.unshift(parsedWalletList[i])
      }
    }
  }
  setLocalStore(
    STORAGE_KEYS.LAST_CONNECTED_WALLET,
    JSON.stringify(activeWalletsList)
  )
}

function mountApp(theme: Theme, disableFontDownload: boolean) {
  class Onboard extends HTMLElement {
    constructor() {
      super()
    }
  }

  if (!customElements.get('onboard-v2')) {
    console.log('onboard-v2 define');
    customElements.define('onboard-v2', Onboard)
  }

  if (!fontFamilyExternallyDefined(theme, disableFontDownload)) {
    importInterFont()
  }

  // add to DOM
  const onboard = document.createElement('onboard-v2')
  const target = onboard.attachShadow({ mode: 'open' })

  onboard.style.all = 'initial'

  target.innerHTML = `

  <style>
    :host {
          /* COLORS */
          --white: white;
          --black: black;
          --primary-1: #2F80ED;
          --primary-100: #eff1fc;
          --primary-200: #d0d4f7;
          --primary-300: #b1b8f2;
          --primary-400: #929bed;
          --primary-500: #6370e5;
          --primary-600: #454ea0;
          --primary-700: #323873;
          --gray-100: #ebebed;
          --gray-200: #c2c4c9;
          --gray-300: #999ca5;
          --gray-400: #707481;
          --gray-500: #33394b;
          --gray-600: #242835;
          --gray-700: #1a1d26;
          --success-100: #d1fae3;
          --success-200: #baf7d5;
          --success-300: #a4f4c6;
          --success-400: #8df2b8;
          --success-500: #5aec99;
          --success-600: #18ce66;
          --success-700: #129b4d;
          --danger-100: #ffe5e6;
          --danger-200: #ffcccc;
          --danger-300: #ffb3b3;
          --danger-400: #ff8080;
          --danger-500: #ff4f4f;
          --danger-600: #cc0000;
          --danger-700: #660000;
          --warning-100: #ffefcc;
          --warning-200: #ffe7b3;
          --warning-300: #ffd780;
          --warning-400: #ffc74c;
          --warning-500: #ffaf00;
          --warning-600: #cc8c00;
          --warning-700: #664600;

          /* FONTS */
          --font-family-normal: var(--w3o-font-family, Inter, sans-serif);

          --font-size-1: 3rem;
          --font-size-2: 2.25rem;
          --font-size-3: 1.5rem;
          --font-size-4: 1.25rem;
          --font-size-5: 1rem;
          --font-size-6: .875rem;
          --font-size-7: .75rem;

          --font-line-height-1: 24px;
          --font-line-height-2: 20px;
          --font-line-height-3: 16px;
          --font-line-height-4: 12px;

          /* SPACING */
          --spacing-1: 3rem;
          --spacing-2: 2rem;
          --spacing-3: 1.5rem;
          --spacing-4: 1rem;
          --spacing-5: 0.5rem;
          --spacing-6: 0.25rem;
          --spacing-7: 0.125rem;

          /* BORDER RADIUS */
          --border-radius-1: 24px;
          --border-radius-2: 20px;
          --border-radius-3: 16px;
          --border-radius-4: 12px;
          --border-radius-5: 8px;

          /* SHADOWS */
          --shadow-0: none;
          --shadow-1: 0px 4px 12px rgba(0, 0, 0, 0.1);
          --shadow-2: inset 0px -1px 0px rgba(0, 0, 0, 0.1);
          --shadow-3: 0px 4px 16px rgba(0, 0, 0, 0.2);

          /* MODAL POSITIONING */
          --modal-z-index: 10;
          --modal-top: unset;
          --modal-right: unset;
          --modal-bottom: unset;
          --modal-left: unset;

          /* MODAL STYLES */
          --modal-backdrop: rgba(0, 0, 0, 0.6);

        }
      </style>
    `
  const connectModalContEl = configuration.containerElements.connectModal

  const containerElementQuery =
    connectModalContEl || state.get().accountCenter.containerElement || 'body'

  const containerElement = document.querySelector(containerElementQuery)

  if (!containerElement) {
    throw new Error(
      `Element with query ${containerElementQuery} does not exist.`
    )
  }
  // #w3o-connect-modal-container is the container ID used by Onboard
  // 登录成功后展示的弹窗
  containerElement.appendChild(onboard)
  // 在Svelte中，创建一个新的应用实例通常是在你的主要JavaScript文件（例如 main.js 或 index.js）中进行的，
  // 这是整个Svelte应用的入口点。这行代码实际上是在初始化你的Svelte应用。

  // 这里的 App 是你的Svelte应用的根组件，它是由Svelte编译器从你的 App.svelte 文件生成的默认导出类。
  // 你需要创建一个这个类的实例来启动应用。

  // new App({ target }) 这行代码的意思是创建 App 组件的一个新实例，并将其挂载到DOM上。
  // 这里的 target 是一个DOM元素，它是你的Svelte应用将要挂载的地方。这通常是在你的 index.html 文件中的一个空的 div 元素。


  const app = new App({
    target
  })

  return app
}

export default init
