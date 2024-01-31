<script lang="ts">
  import { _ } from 'svelte-i18n'
  import en from '../../i18n/en.json'
  import { MOBILE_WINDOW_WIDTH } from '../../constants.js'
  import { state } from '../../store/index.js'
  import type { WalletWithLoadingIcon } from '../../types.js'
  import { Warning } from '../shared/index.js'
  import WalletButton from './WalletButton.svelte'

  export let wallets: WalletWithLoadingIcon[]
  export let selectWallet: (wallet: WalletWithLoadingIcon) => Promise<void>
  export let connectingWalletLabel: string
  export let connectingErrorMessage: string

  let windowWidth: number
  const { connect } = state.get()

  function checkConnected(label: string) {
    const { wallets } = state.get()
    return !!wallets.find(wallet => wallet.label === label)
  }

  const wheresMyWalletDefault =
    'https://www.blocknative.com/blog/metamask-wont-connect-web3-wallet-troubleshooting'
</script>

<style>
  .wallets-container {
    display: flex;
    gap: 0.5rem;
    overflow-x: scroll;
    overflow-y: hidden;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid var(--border-color);

    /* Hide scrollbar for IE, Edge and Firefox */
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }

  /* Hide scrollbar for Chrome, Safari and Opera */
  .wallets-container::-webkit-scrollbar {
    display: none;
  }

  .warning-container {
    margin: 1rem 1rem 0;
  }

  .notice-container {
    flex: 0 0 100%;
    margin-top: 0.75rem;
  }

  @media all and (min-width: 768px) {
    .wallets-container {
      display: grid;
      grid-template-columns: repeat(var(--onboard-wallet-columns, 2), 1fr);
      padding: 1rem;
      border: none;
    }
    .notice-container {
      grid-column: span 2;
      margin: 0;
    }
  }
</style>
<!-- 监听window窗口事件 -->

<!-- 在Svelte框架中，`<svelte:window>`是一个特殊的组件，用于监听window对象（浏览器窗口）的事件。上述代码片段是Svelte的语法，用于绑定浏览器窗口的宽度到一个本地变量`windowWidth`。

让我们分解这行代码：

- `<svelte:window>`：这是Svelte的内置组件，它不会渲染任何实际的HTML元素，而是用来订阅window对象上的事件。
- `bind:innerWidth`：这是Svelte的绑定指令，用于将一个组件或元素的属性值绑定到一个本地变量。在这个例子中，它将window对象的`innerWidth`属性（即窗口的内部宽度）绑定到了一个变量上。
- `{windowWidth}`：这是Svelte的语法，表示创建了一个名为`windowWidth`的响应式变量。这个变量将会与window的`innerWidth`保持同步。

当浏览器窗口的大小发生变化时，`innerWidth`属性会更新，由于绑定，`windowWidth`变量也会相应更新。这样，你就可以在Svelte应用中使用`windowWidth`变量来响应窗口大小的变化，例如，用于响应式布局或者条件渲染。 -->
<svelte:window bind:innerWidth={windowWidth} />

<div class="outer-container">
  {#if connectingErrorMessage}
    <div class="warning-container">
      <Warning>{@html connectingErrorMessage}</Warning>
    </div>
  {/if}

  <div class="wallets-container">
    {#each wallets as wallet}
      <WalletButton
        connected={checkConnected(wallet.label)}
        connecting={connectingWalletLabel === wallet.label}
        label={wallet.label}
        icon={wallet.icon}
        onClick={() => selectWallet(wallet)}
        disabled={windowWidth <= MOBILE_WINDOW_WIDTH &&
          connectingWalletLabel &&
          connectingWalletLabel !== wallet.label}
      />
    {/each}
    {#if !connect.removeWhereIsMyWalletWarning}
      <div class="notice-container">
        <Warning>
          <div>
            {$_('connect.selectingWallet.whyDontISeeMyWallet', {
              default: en.connect.selectingWallet.whyDontISeeMyWallet
            })}
          </div>
          <a
            class="link pointer"
            href={connect.wheresMyWalletLink || wheresMyWalletDefault}
            target="_blank"
            rel="noreferrer noopener"
            >{$_('connect.selectingWallet.learnMore', {
              default: en.connect.selectingWallet.learnMore
            })}</a
          >
        </Warning>
      </div>
    {/if}
  </div>
</div>
