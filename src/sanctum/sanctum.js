import { Connection, Keypair, VersionedTransaction, ComputeBudgetProgram, TransactionExpiredBlockheightExceededError } from '@solana/web3.js';
import bs58 from 'bs58';
import promiseRetry from "promise-retry";
import Logger from '@youpaichris/logger';
const logger = new Logger();
const wait = (time) => new Promise((resolve) => setTimeout(resolve, time));
function getSignature(transaction) {
    const signature =
        "signature" in transaction
            ? transaction.signature
            : transaction.signatures[0];
    if (!signature) {
        throw new Error(
            "Missing transaction signature, the transaction was not signed by the fee payer"
        );
    }
    return bs58.encode(signature);
}
const SEND_OPTIONS = {
    replaceRecentBlockhash: true,
    commitment: "processed",
}

class Sanctum {
    constructor(connection, wallet) {
        this.connection = connection;
        this.wallet = wallet;
        this.baseUrl = 'https://sanctum-s-api.fly.dev/v1'; // 修改这里
    }
    async transactionSenderAndConfirmationWaiter(serializedTransaction, blockhashWithExpiryBlockHeight) {

        // // 执行交易
        const txid = await this.connection.sendRawTransaction(serializedTransaction, {
            skipPreflight: true,
            maxRetries: 50
        });

        const controller = new AbortController();
        const abortSignal = controller.signal;

        const abortableResender = async () => {
            let txid;
            while (true) {
                await wait(2_000);
                if (abortSignal.aborted) return;
                try {
                    txid = await this.connection.sendRawTransaction(
                        serializedTransaction,
                        SEND_OPTIONS
                    );
                } catch (e) {
                    logger.warn(`Failed to resend transaction: ${e}`);
                }
            }
        };

        try {
            abortableResender();
            const lastValidBlockHeight = blockhashWithExpiryBlockHeight.lastValidBlockHeight - 150;
            await Promise.race([
                this.connection.confirmTransaction(
                    {
                        ...blockhashWithExpiryBlockHeight,
                        lastValidBlockHeight,
                        signature: txid,
                        abortSignal,
                    },
                    "confirmed"
                ),
                new Promise(async (resolve) => {
                    // in case ws socket died
                    while (!abortSignal.aborted) {
                        await wait(2_000);
                        const tx = await this.connection.getSignatureStatus(txid, {
                            searchTransactionHistory: false,
                        });
                        if (tx?.value?.confirmationStatus === "confirmed") {
                            resolve(tx);
                        }
                    }
                }),

            ]);

        } catch (e) {
            if (e instanceof TransactionExpiredBlockheightExceededError) {
                // we consume this error and getTransaction would return null
                return null;
            } else {
                // invalid state from web3.js
                throw e;
            }
        } finally {
            controller.abort();
        }

        // in case rpc is not synced yet, we add some retries
        const response = promiseRetry(
            async (retry) => {
                const response = await this.connection.getTransaction(txid, {
                    commitment: "confirmed",
                    maxSupportedTransactionVersion: 0,
                });
                if (!response) {
                    retry(response);
                }
                return response;
            },
            {
                retries: 50,
                minTimeout: 1e3,
            }
        );
        return response;
    }
    async getQuote(inputMint, outputMint, amount, swapMode = 'ExactIn') {
        const params = new URLSearchParams({
            input: inputMint,
            outputLstMint: outputMint,
            amount: amount,
            mode: swapMode
        });
        const url = `${this.baseUrl}/swap/quote?${params.toString()}`; // 修改这里
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (response.body) {
            return response.json();
        } else {
            console.log('Empty response body');
            return null;
        }
    };
    async swap(inputMint, outputMint, amount, swapMode = 'ExactIn') {
        const quoteResponse = await this.getQuote(inputMint, outputMint, amount, swapMode);

        const url = `${this.baseUrl}/swap`; // 修改这里
        const swapResult = await (await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "input": inputMint,
                "outputLstMint": outputMint,
                "signer": this.wallet.publicKey.toBase58(),
                "amount": quoteResponse.inAmount,
                "quotedAmount": quoteResponse.outAmount,
                "mode":swapMode,
                "swapSrc": quoteResponse.swapSrc,
                "priorityFee": {
                  "Manual": {
                    "unit_limit": 1000000,
                    "unit_price_micro_lamports": 15000
                  }
                }
              }),

        })).json();


        
        const swapTransactionBuf = Buffer.from(swapResult.tx, 'base64');
        let transaction = VersionedTransaction.deserialize(swapTransactionBuf);
        console.log(transaction);
        process.exit(0);

        // sign the transaction
        transaction.sign([this.wallet.payer]);
        const signature = getSignature(transaction);
        logger.info(`Transaction signature: ${signature}`);

        // 模拟交易是否会成功
        // We first simulate whether the transaction would be successful
        const { value: simulatedTransactionResponse } =
            await this.connection.simulateTransaction(transaction, SEND_OPTIONS);
        const { err, logs } = simulatedTransactionResponse;

        if (err) {
            // Simulation error, we can check the logs for more details
            // If you are getting an invalid account error, make sure that you have the input mint account to actually swap from.
            logger.error("Simulation Error:");
            logger.error({ err, logs });
            return;
        };

        const transactionResponse = await this.transactionSenderAndConfirmationWaiter(
            serializedTransaction,
            {
                blockhash,
                lastValidBlockHeight: swapResult.lastValidBlockHeight,
            },
        );
        // If we are not getting a response back, the transaction has not confirmed.
        if (!transactionResponse) {
            logger.error("Transaction not confirmed");
            return;
        }

        if (transactionResponse.meta?.err) {
            logger.error(transactionResponse.meta?.err);
        }
        return signature;

        // const serializedTransaction = Buffer.from(transaction.serialize());
        // const blockhash = transaction.message.recentBlockhash;
        // const txid = await this.connection.sendRawTransaction(serializedTransaction, {
        //     skipPreflight: true,
        //     maxRetries: 50
        // });
        // return await connection.confirmTransaction(txid);
    }
}

export default Sanctum;