import {expect} from 'chai';
import {TransactionType} from 'risejs';
import {BaseTx, ITransaction} from '../../src/trxTypes/BaseTx';
import {IVoteAsset, VoteTx} from '../../src/trxTypes/Vote';
import {testPrivKey, testWallet} from '../testConsts';
import {SendTx} from '../../src/trxTypes/Send';

// tslint:disable-next-line:no-var-requires
const txs        = require(`${__dirname}/../data/voteTxs.json`);
const emptyVotes = { votes: [] };
describe('Transactions.vote', () => {
  it('should have type 3', () => {
    const t = new VoteTx(emptyVotes);
    expect(t.type).to.be.deep.eq(TransactionType.VOTE);
    return undefined;
  });
  it('should inherit from BaseTx', () => {
    const t = new VoteTx(emptyVotes);
    expect(t).to.be.instanceof(BaseTx);
  });

  it('should NOT return null on getChildBytes even if empty votes', () => {
    const t = new VoteTx(emptyVotes);
    // tslint:disable-next-line:no-string-literal no-unused-expression
    expect(t['getChildBytes'](false, false)).to.not.be.null;
  });

  it('should return null on getChildBytes if votes is undefined', () => {
    const t = new VoteTx();
    // tslint:disable-next-line:no-string-literal no-unused-expression
    expect(t['getChildBytes'](false, false)).to.be.null;
  });

  describe('txs', () => {
    txs.forEach((tx) => {
      describe(`${tx.id}`, () => {
        let testTx: ITransaction<IVoteAsset>;
        beforeEach(() => {
          testTx = new VoteTx(tx.asset)
            .set('fee', tx.fee)
            .set('timestamp', tx.timestamp)
            .set('requesterPublicKey', tx.requesterPublicKey)
            .set('senderPublicKey', tx.senderPublicKey)
            .set('recipientId', tx.recipientId)
            .sign(testPrivKey);
        });
        it('should match signature', () => {
          expect(testTx.signature).to.be.deep.eq(tx.signature);
        });
        it('should match id', () => {
          expect(testTx.id).to.be.deep.eq(tx.id);
        });
        it('toString-Obj be eq to tx', () => {
          expect(testTx).to.be.deep.eq(tx);
        });

        it('should give same result through wallet', () => {
          const unsignedTx = {...testTx, ... {signature: null}};
          expect(testWallet.signTransaction(unsignedTx)).to.be.deep.eq(testTx);
        });

        it('should give same result through wallet and basetx obj', () => {
          expect(testWallet.signTransaction(new VoteTx(tx.asset)
            .set('fee', tx.fee)
            .set('timestamp', tx.timestamp)
            .set('requesterPublicKey', tx.requesterPublicKey)
            .set('senderPublicKey', tx.senderPublicKey)
            .set('recipientId', tx.recipientId))).to.be.deep.eq(testTx);
        });
      });

    });
  });

});
