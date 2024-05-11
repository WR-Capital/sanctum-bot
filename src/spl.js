import { Connection, Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
export async function getSPLBalance(connection, address, mint) {
    const addressKey = new PublicKey(address)
    const mintKey = new PublicKey(mint);
    let tokenAccounts = await connection.getParsedTokenAccountsByOwner(addressKey, { mint: mintKey });
    
    let amount = 0;
    let decimals = 0;
    let uiAmount = 0;
    if (tokenAccounts.value.length > 0) {

        for (const account of tokenAccounts.value) {
            const tokenAmount =  account.account.data.parsed.info.tokenAmount;
            amount += Number(tokenAmount.amount);
            uiAmount += tokenAmount.uiAmount;
            decimals = tokenAmount.decimals;
        }
    }
    return { amount, uiAmount, decimals };
}