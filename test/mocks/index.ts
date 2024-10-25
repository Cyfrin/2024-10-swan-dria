import { randomBytes } from "crypto";

/** A mock storage where data is stored in a KV fashion.
 *
 * When an item is uploaded, a 32-byte identifier is returned that can be used to access it.
 * In Arweave's case, that identifier is the transaction ID.
 */
export class MockStorage<T = unknown> {
  db: Record<string, T> = {};

  upload(item: T): bigint {
    const key = randomBytes(32).toString("hex");
    this.db[key] = item;
    return BigInt("0x" + key);
  }

  get(key: bigint): T | null {
    const keyStr = key.toString(16);
    if (this.db[keyStr]) {
      return this.db[keyStr];
    } else {
      return null;
    }
  }
}
