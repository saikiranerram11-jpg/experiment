import { getAddress, keccak256, toHex, type Address, type PublicClient } from "viem";

/**
 * When a user's UserSmartWallet was created, established from the chain alone.
 *
 * Phase 2 reads this as-of an epoch boundary to decide who counts as an onboarded direct, which
 * sets Level unlock depth and the Rank direct requirement. So the value must be the chain's own
 * and must be exact: registration time, backend sync time or any estimate would silently move
 * money, and a wallet created after a snapshot would leak backward into a settled epoch.
 *
 * `UserWalletFactory.createWallet()` deploys the wallet and emits `WalletCreated(user, wallet)`
 * in one transaction, so the event is both the authority and the proof of the pairing.
 */

export interface WalletCreation {
  blockNumber: number;
  /** Unix seconds of the block that contains the creation transaction. */
  timestamp: number;
  txHash: `0x${string}`;
}

/** The creation event could not be established. Callers must not substitute a guess. */
export class WalletCreationUnverifiedError extends Error {
  constructor(
    readonly eoa: string,
    readonly wallet: string,
    readonly detail: string,
  ) {
    super(
      `Could not establish WalletCreated for owner ${eoa} wallet ${wallet}: ${detail}. ` +
        "Refusing to record an onboarding timestamp that the chain does not prove.",
    );
    this.name = "WalletCreationUnverifiedError";
  }
}

export const WALLET_CREATED_TOPIC = keccak256(toHex("WalletCreated(address,address)"));

/**
 * `eth_getCode` at a historical block, retried.
 *
 * A transient RPC failure must never be read as "no code": that is indistinguishable from the
 * truth to a binary search, and it silently returns a later block than the real one. Amoy's free
 * tier does throw intermittently, so this exhausts retries and then propagates.
 */
async function hasCodeAt(
  client: PublicClient,
  address: Address,
  blockNumber: number,
): Promise<boolean> {
  let last: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const code = await client.getCode({ address, blockNumber: BigInt(blockNumber) });
      return code !== undefined && code !== "0x";
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw new Error(
    `eth_getCode(${address}, ${blockNumber}) failed after 6 attempts: ${String(last).slice(0, 160)}`,
  );
}

/**
 * The first block at which `address` has code — its creation block, exactly.
 *
 * Chosen over scanning `WalletCreated` logs because Amoy's free tier caps `eth_getLogs` at ten
 * blocks: covering the factory's history that way takes tens of thousands of requests, where this
 * takes about log2(span). The event is still read afterwards, from this one block, as the proof.
 */
async function firstBlockWithCode(
  client: PublicClient,
  address: Address,
  floorBlock: number,
  headBlock: number,
): Promise<number> {
  if (!(await hasCodeAt(client, address, headBlock))) {
    throw new Error(`${address} has no code at head block ${headBlock}`);
  }
  let low = floorBlock;
  let high = headBlock;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (await hasCodeAt(client, address, mid)) high = mid;
    else low = mid + 1;
  }
  return low;
}

/** Memoized per factory address: the floor every wallet search can start from. */
const factoryFloor = new Map<string, number>();

async function factoryFirstBlock(
  client: PublicClient,
  factory: Address,
  headBlock: number,
): Promise<number> {
  const key = factory.toLowerCase();
  const cached = factoryFloor.get(key);
  if (cached !== undefined) return cached;
  // No wallet can predate its factory, so the factory's own creation block is a sound floor.
  const block = await firstBlockWithCode(client, factory, 0, headBlock);
  factoryFloor.set(key, block);
  return block;
}

export interface ResolveWalletCreationOptions {
  client: PublicClient;
  factoryAddress: Address;
  /** The wallet owner — the `user` topic of the event, since `createWallet` uses `_msgSender()`. */
  eoa: Address;
  /** The wallet the factory reports, which the event must name. */
  wallet: Address;
  headBlock?: number;
}

/**
 * Establishes a wallet's creation from `WalletCreated`, or throws.
 *
 * Both addresses in the event are checked against what was asked for, so this proves the pairing
 * rather than merely dating a contract that happens to exist.
 */
export async function resolveWalletCreation(
  options: ResolveWalletCreationOptions,
): Promise<WalletCreation> {
  const { client, eoa, wallet } = options;
  const factory = getAddress(options.factoryAddress);
  const expectedOwner = getAddress(eoa);
  const expectedWallet = getAddress(wallet);

  const head = options.headBlock ?? Number(await client.getBlockNumber());

  let candidate: number;
  try {
    const floor = await factoryFirstBlock(client, factory, head);
    candidate = await firstBlockWithCode(client, expectedWallet, floor, head);
  } catch (error) {
    throw new WalletCreationUnverifiedError(
      expectedOwner,
      expectedWallet,
      `creation block could not be located (${String((error as Error).message).slice(0, 120)})`,
    );
  }

  const block = await client.getBlock({ blockNumber: BigInt(candidate), includeTransactions: true });

  for (const transaction of block.transactions) {
    if (typeof transaction === "string") continue;
    if (!transaction.to || getAddress(transaction.to) !== factory) continue;

    const receipt = await client.getTransactionReceipt({ hash: transaction.hash });
    if (receipt.status !== "success") continue;

    for (const log of receipt.logs) {
      if (log.topics[0] !== WALLET_CREATED_TOPIC) continue;
      if (getAddress(log.address) !== factory) continue;
      const owner = getAddress(`0x${log.topics[1]!.slice(26)}` as Address);
      const created = getAddress(`0x${log.topics[2]!.slice(26)}` as Address);
      if (owner !== expectedOwner || created !== expectedWallet) continue;

      return {
        blockNumber: Number(receipt.blockNumber),
        timestamp: Number(block.timestamp),
        txHash: transaction.hash,
      };
    }
  }

  throw new WalletCreationUnverifiedError(
    expectedOwner,
    expectedWallet,
    `no matching WalletCreated in block ${candidate}, where the wallet's code first appears`,
  );
}
