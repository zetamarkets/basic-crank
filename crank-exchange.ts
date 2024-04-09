import {
  Exchange,
  utils,
  constants,
  types,
  assets,
  Network,
} from "@zetamarkets/sdk";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import { _OPEN_ORDERS_LAYOUT_V2 } from "@zetamarkets/sdk/dist/serum/market";

// Adds timestamp to the start of each log, including modules
require("log-timestamp")(function () {
  return `[${new Date().toUTCString()}]`;
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

async function main() {
  // Enter RPC.
  let endpoint = "";
  let connection = new Connection(endpoint, {
    commitment: "processed",
    disableRetryOnRateLimit: true,
    confirmTransactionInitialTimeout: 1000,
  });

  // Enter secret key buffer.
  let privateKey = [];

  let wallet: Wallet = new Wallet(
    Keypair.fromSecretKey(Buffer.from(privateKey))
  );
  let openOrdersToMarginAccount = new Map();
  const LOAD_CONFIG: types.LoadExchangeConfig = {
    network: Network.MAINNET,
    connection,
    opts: utils.commitmentConfig("processed"),
    throttleMs: 0,
    loadFromStore: true,
    TIFBufferSeconds: 0,
    orderbookAssetSubscriptionOverride: [],
  };

  await Exchange.load(LOAD_CONFIG, wallet);
  let assets = [constants.Asset.SOL, constants.Asset.BTC];
  Exchange.updatePriorityFee(1000);

  // Log event queue length.
  setInterval(
    async function () {
      await Promise.all(
        assets.map(async (asset) => {
          let eventQueue = await Exchange.getPerpMarket(
            asset
          ).serumMarket.loadEventQueue(Exchange.connection);
          console.log(`${asset} EventQueue Length = ${eventQueue.length}`);
        })
      );
    }.bind(this),
    10_000
  );

  while (true) {
    // Pass in map for caching.
    await Promise.all(
      assets.map(async (asset) => {
        let ix = await utils.createCrankMarketIx(
          asset,
          openOrdersToMarginAccount
        );
        if (ix == null) return;
        let tx = new Transaction().add(ix);
        console.log(`Cranking exchange for asset ${asset}.`);
        try {
          await utils.processTransaction(
            Exchange.provider,
            tx,
            undefined,
            undefined,
            false,
            undefined,
            undefined,
            undefined,
            true
          );
        } catch (e) {
          console.log(e);
        }
      })
    );
  }
}

main();
