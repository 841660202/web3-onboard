import type { MultiChain } from 'bnc-sdk'
import type SDK from 'bnc-sdk'
import { configuration } from './configuration.js'
import { handleTransactionUpdates } from './notify.js'

let blocknativeMultiChainSdk: MultiChain
let blocknativeSdk: SDK

/**
 *
 * @returns MultiChain SDK if apiKey
 */

export async function getBNMulitChainSdk(): Promise<MultiChain | null> {
  const { apiKey } = configuration

  if (!apiKey) return null

  if (!blocknativeMultiChainSdk) {
    const { default: Blocknative } = await import('bnc-sdk')
    blocknativeMultiChainSdk = Blocknative.multichain({
      apiKey: configuration.apiKey
    })
    // 这个API返回了好多数据
    // TODO: http://t-blog-images.aijs.top/img/202401311441561.webp
    // 手动从metamask中发起交易，这个API就会返回数据
    // http://t-blog-images.aijs.top/img/202401311448961.webp
    // TODO: 看看 bnc-sdk 做了什么事情
    // https://github.com/blocknative/sdk
    // bnc-sdk 是一个用来检测交易是否上链的工具, github上简介是通过websocket来检测交易是否上链
    blocknativeMultiChainSdk.transactions$.subscribe(handleTransactionUpdates)
  }

  return blocknativeMultiChainSdk
}

/**
 *
 * @returns SDK if apiKey
 */
export async function getBlocknativeSdk(): Promise<SDK> {
  const { apiKey } = configuration

  if (!apiKey) return null

  if (!blocknativeSdk) {
    const { default: Blocknative } = await import('bnc-sdk')
    blocknativeSdk = new Blocknative({
      dappId: configuration.apiKey,
      networkId: 1
    })
    return blocknativeSdk
  }

  return blocknativeSdk
}
