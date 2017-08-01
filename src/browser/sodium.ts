import * as libsodium from 'libsodium-wrappers';

const innerNacl = {
  ...libsodium,
  ...{
    crypto_sign_seed_keypair(...args) {
      if (args[0] instanceof Buffer) {
        // Buffer is unsupported
        args[0] = new Uint8Array(args[0]);
      }
      const toRet     = libsodium.crypto_sign_seed_keypair.apply(libsodium, args);
      toRet.publicKey = toBuffer(toRet.publicKey);
      toRet.secretKey = toBuffer(toRet.privateKey);
      delete toRet.privateKey;
      return toRet;
    },
    crypto_sign_detached(hash: string, privKey: Buffer) {
      const toRet = libsodium.crypto_sign_detached(hash, privKey);
      return toBuffer(toRet);
    },
  },
};

function toBuffer(ab) {
  const buf  = new Buffer(ab.byteLength);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }
  return buf;
}

export const api = innerNacl;
