import BigNumber from 'bignumber.js';
import * as ByteBuffer from 'bytebuffer';
import * as empty from 'is-empty';
import { As } from 'type-tagger';
import { Overwrite } from 'utility-types';
import { encode as encodeVarInt } from 'varuint-bitcoin';
import { bigNumberFromBuffer, bigNumberToBuffer } from '../utils/bignumber';
import { toSha256 } from '../utils/sha256';
import { ed25519 } from '../utils/sodium';
import { Address, IBaseTx, ICoinCodec, IKeypair, ITransaction } from './interface';

export interface IRegisterSecondSignature extends IBaseTx {
  readonly kind: 'second-signature';
  readonly publicKey: Buffer & As<'publicKey'>;
}

export interface IRegisterMultisignature extends IBaseTx {
  readonly kind: 'multisignature';
  readonly min: number;
  readonly lifetime: number;
  readonly config: {
    added: Array<Buffer & As<'publicKey'>>;
    removed: Array<Buffer & As<'publicKey'>>;
  };
}

export type ILiskTransaction = ITransaction | IRegisterSecondSignature | IRegisterMultisignature;

// tslint:disable-next-line
export type SignOptions = { skipSignature: boolean, skipSecondSign: boolean };
const defaultSignOptions = { skipSecondSign: false, skipSignature: false };

// tslint:disable-next-line
export type LiskTransaction<AssetType> = {
  recipientId: Address;
  senderId: Address;
  amount: number;
  senderPublicKey: Buffer;
  requesterPublicKey?: Buffer;
  timestamp: number;
  fee: number;
  asset: AssetType;
  type: number;
  id: string;
  signature?: Buffer;
  signSignature?: Buffer;
  signatures?: Buffer[];
};
export type PostableLiskTransaction<T> = Overwrite<LiskTransaction<T>, {
  amount: string,
  fee: string,
  senderPublicKey: string;
  requesterPublicKey?: string;
  signature?: string;
  signSignature?: string;
  signatures?: string[];
}>;

export const LiskCodec: ICoinCodec<LiskTransaction<any>, ILiskTransaction, SignOptions> = {
  baseFees: {
    'multisignature'   : 500000000,
    'register-delegate': 2500000000,
    'second-signature' : 500000000,
    'send'             : 10000000,
    'vote'             : 100000000,
  },
  txs     : {
    _codec: null,
    getAddressBytes(address: Address): Buffer {
      return bigNumberToBuffer(
        new BigNumber(address.slice(0, -1)),
        { size: 8 }
      );
    },

    getChildBytes(tx: LiskTransaction<any>) {
      if (tx.type === 1) {
        return Buffer.from(tx.asset.signature.publicKey, 'hex');
      } else if (tx.type === 2) {
        return Buffer.from(tx.asset.delegate.username, 'utf8');
      } else if (tx.type === 3) {
        return Buffer.from(tx.asset.votes.join(''), 'utf8');
      } else if (tx.type === 4) {
        const keysBuff = Buffer.from(tx.asset.multisignature.keysgroup.join(''), 'utf8');
        const bb       = new ByteBuffer(1 + 1 + keysBuff.length, true);
        bb.writeByte(tx.asset.multisignature.min);
        bb.writeByte(tx.asset.multisignature.lifetime);

        // tslint:disable-next-line
        for (let i = 0; i < keysBuff.length; i++) {
          bb.writeByte(keysBuff[i]);
        }
        bb.flip();

        return new Buffer(bb.toBuffer());
      }
      return Buffer.alloc(0);
    },

    bytes(tx: LiskTransaction<any>, signOpts: SignOptions = defaultSignOptions) {
      const assetBytes = this.getChildBytes(tx);
      const bb         = new ByteBuffer(1 + 4 + 32 + 32 + 8 + 8 + 64 + 64 + assetBytes.length, true);
      bb.writeByte(tx.type);
      bb.writeUint32(tx.timestamp);
      bb.append(tx.senderPublicKey);
      if (!empty(tx.requesterPublicKey)) {
        bb.append(tx.requesterPublicKey);
      }
      if (!empty(tx.recipientId)) {
        bb.append(this.getAddressBytes(tx.recipientId));
      } else {
        bb.append(Buffer.alloc(8).fill(0));
      }

      // tslint:disable-next-line no-string-literal
      bb['writeLong'](tx.amount);

      bb.append(assetBytes);
      if (!signOpts.skipSignature && tx.signature) {
        bb.append(tx.signature);
      }
      if (!signOpts.skipSecondSign && tx.signSignature) {
        bb.append(tx.signSignature);
      }

      bb.flip();
      return new Buffer(bb.toBuffer());
    },

    createNonce() {
      return `${Math.floor(
        (Date.now() - Date.UTC(2016, 4, 24, 17, 0, 0, 0)) / 1000
      )}` as string & As<'nonce'>;
    },

    transform<T = any>(tx: ILiskTransaction) {
      const toRet: LiskTransaction<T> = {
        amount            : null,
        asset             : null,
        fee               : null,
        id                : null,
        recipientId       : null,
        requesterPublicKey: null,
        senderId          : null,
        senderPublicKey   : null,
        timestamp         : null,
        type              : null,
      };
      toRet.type                      = ['send', 'delegate', 'vote'].indexOf(tx.kind);

      if (toRet.type === -1) {
        throw new Error('Unsupported transaction type');
      }

      if (empty(tx.fee)) {
        toRet.fee = this._codec.baseFees[tx.kind];
      } else {
        toRet.fee = parseInt(tx.fee, 10);
      }

      if (empty(tx.sender.publicKey)) {
        throw new Error('Please set sender publicKey');
      }
      toRet.senderPublicKey = tx.sender.publicKey;

      if (tx.kind === 'send') {
        toRet.recipientId = tx.recipient;
      } else if (tx.kind === 'vote') {
        toRet.recipientId = this._codec.calcAddress(tx.sender.publicKey);
      }

      if (!empty(tx.nonce)) {
        toRet.timestamp = parseInt(tx.nonce, 10);
      } else {
        toRet.timestamp = parseInt(this.createNonce(), 10);
      }

      if (tx.kind === 'vote') {
        const votes: string[] = [];
        for (const pref of tx.preferences) {
          votes.push(`${pref.action}${pref.delegateIdentifier.toString('hex')}`);
        }
        toRet.asset = { votes } as any;
      } else if (tx.kind === 'register-delegate') {
        toRet.asset = { delegate: { username: tx.name } } as any;
      } else if (tx.kind === 'second-signature') {
        toRet.asset = { signature: { publicKey: tx.publicKey.toString('hex') } } as any;
      } else if (tx.kind === 'multisignature') {
        toRet.asset = {
          multisignature: {
            keysgroup: tx.config.added
              .map((p) => `+${p.toString('hex')}`)
              .concat(tx.config.removed
                .map((p) => `-${p.toString('hex')}`)
              ),
            lifetime : tx.lifetime,
            min      : tx.min,
          },
        } as any;
      }
      return toRet;
    },

    // tslint:disable-next-line max-line-length
    calcSignature(tx: LiskTransaction<any>, kp: IKeypair, opts: SignOptions = defaultSignOptions) {
      return this._codec.raw.sign(
        toSha256(this.bytes(tx, opts)),
        kp
      );
    },

    sign(tx: LiskTransaction<any>, kp: IKeypair) {
      tx.signature = this.calcSignature(tx, kp, {
        skipSecondSign: true,
        skipSignature : true,
      });
      return tx;
    },

    postableData<T = any>(tx: LiskTransaction<T>): PostableLiskTransaction<T> {
      const toRet: PostableLiskTransaction<T> = {
        ...tx,
        amount            : `${tx.amount}`,
        fee               : `${tx.fee}`,
        id                : this.identifier(tx),
        requesterPublicKey: tx.requesterPublicKey ? tx.requesterPublicKey.toString('hex') : null,
        senderPublicKey   : tx.senderPublicKey.toString('hex'),
        signSignature     : tx.signSignature ? tx.signSignature.toString('hex') : null,
        signature         : tx.signature.toString('hex'),
        signatures        : tx.signatures ? tx.signatures.map((s) => s.toString('hex')) : null,
      };

      ['requesterPublicKey', 'senderPublicKey', 'signSignature', 'signatures']
        .forEach((k) => {
          if (toRet[k] === null) {
            delete toRet[k];
          }
        });

      return toRet;
    },

    identifier(tx: LiskTransaction<any>) {
      const hash = toSha256(this.bytes(tx, {
        skipSecondSign: false,
        skipSignature : false,
      }));
      const temp = Buffer.alloc(8);
      for (let i = 0; i < 8; i++) {
        temp[i] = hash[7 - i];
      }
      return bigNumberFromBuffer(temp, { size: 8 }).toString() as string & As<'txIdentifier'>;
    },
  },

  msgs: {
    _codec: null,
    prefix: new Buffer('Lisk Signed Message:\n', 'utf8'),
    signablePayload(message: Buffer | string) {
      const msgBuf = Buffer.isBuffer(message) ? message : Buffer.from(message, 'utf8');
      const buf    = Buffer.concat([
        encodeVarInt(this.prefix.length),
        this.prefix,
        encodeVarInt(msgBuf.length),
        msgBuf,
      ]);
      return toSha256(toSha256(buf));
    },
    sign(message: Buffer | string, kp: IKeypair) {
      return (this._codec as typeof LiskCodec).raw.sign(this.signablePayload(message), kp);
    },
    verify(message: Buffer | string, signature: Buffer & As<'signature'>, publicKey: Buffer & As<'publicKey'>) {
      return (this._codec as typeof LiskCodec).raw.verify(this.signablePayload(message), signature, publicKey);
    },
  },

  deriveKeypair(secret: Buffer | string) {
    const hash = toSha256(secret);
    const r    = ed25519.crypto_sign_seed_keypair(hash);
    return {
      privateKey: r.secretKey,
      publicKey : r.publicKey,
    };
  },

  calcAddress(publicKey: (Buffer | string) & As<'publicKey'>) {
    const hash = toSha256(publicKey);
    const temp = new Buffer(8);
    for (let i = 0; i < 8; i++) {
      temp[i] = hash[7 - i];
    }
    return `${bigNumberFromBuffer(temp).toString()}L` as Address;
  },

  raw: {
    sign(buf: Buffer, kp: IKeypair) {
      return ed25519.crypto_sign_detached(buf, kp.privateKey);
    },
    verify(buf: Buffer, signature: Buffer & As<'signature'>, publicKey: Buffer & As<'publicKey'>) {
      throw new Error('Not implemented yed');
    },
  },

};

LiskCodec.msgs._codec = LiskCodec;
LiskCodec.txs._codec  = LiskCodec;