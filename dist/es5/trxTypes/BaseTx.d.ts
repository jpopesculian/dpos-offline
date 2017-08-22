/// <reference types="node" />
/// <reference types="bytebuffer" />
import * as ByteBuffer from 'bytebuffer';
export interface ITransaction<AssetType = {}> {
    recipientId: string;
    amount: number;
    senderPublicKey: string;
    requesterPublicKey: string;
    timestamp: number;
    fee: number;
    asset: AssetType;
    type: number;
    id: string;
    signature: string;
    secondSignature?: string;
}
/**
 * Base transaction class.
 */
export declare abstract class BaseTx<T = {}> {
    asset: T;
    recipientId: string;
    amount: number;
    senderPublicKey: string;
    requesterPublicKey: string;
    timestamp: number;
    fee: number;
    protected abstract type: number;
    protected _signature: string;
    protected _secondSignature?: string;
    protected _id: string;
    constructor(asset?: T);
    sign(signingPrivKey: string, signingSecondPrivKey?: string): ITransaction<T>;
    /**
     * Gets raw hash of current tx
     */
    getHash(): Buffer;
    set(key: keyof this, value: any): this;
    withRecipientId(recipientId: string): this;
    withAmount(amount: number): this;
    withSenderPublicKey(senderPublicKey: string): this;
    withRequesterPublicKey(senderPublicKey: string): this;
    withTimestamp(timestamp: number): this;
    withFees(fees: number): this;
    /**
     * Returns plain object representation of tx (if not signed error will be thrown)
     */
    protected toObj(): ITransaction<T>;
    /**
     * Generate signature from given private key.
     * @param {string} privKey
     * @returns {Buffer}
     */
    protected createSignature(privKey: string): any;
    readonly signature: string;
    readonly id: string;
    /**
     * Calculates Tx id!
     * @returns {string}
     */
    protected calcId(): string;
    /**
     * Calculates bytes of tx.
     * @param {boolean} skipSignature=false true if you don't want to account signature
     * @param {boolean} skipSecondSign=false true if you don't want to account second signature
     * @returns {Buffer}
     */
    protected getBytes(skipSignature?: boolean, skipSecondSign?: boolean): Buffer;
    /**
     * Override to calculate asset bytes.
     * @param {boolean} skipSignature
     * @param {boolean} skipSecondSign
     */
    protected abstract getChildBytes(skipSignature: boolean, skipSecondSign: boolean): Buffer;
    /**
     * override this to allow asset and other fields creations.
     * for different tx types.
     */
    protected innerCreate(): void;
    /**
     * Utility to copy an hex string to a bytebuffer
     * @param {string} hex
     * @param {ByteBuffer} bb
     */
    static hexKeyInByteBuffer(hex: string, bb: ByteBuffer): void;
}
