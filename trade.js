import bs58  from "bs58";
import path from 'path';
import fs from 'fs';
import { Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from '@solana/web3.js';
import readlineSync from 'readline-sync';
import Logger from '@youpaichris/logger';
const logger = new Logger();
import { sleep, convertCSVToObjectSync, decryptUsingAESGCM, appendObjectToCSV } from './src/utils.js';
import Sanctum from "./src/sanctum/sanctum.js";
import { getSPLBalance } from './src/spl.js';
// 获取当前文件路径
const __filename = new URL(import.meta.url).pathname;
// 获取上级目录路径
const __dirname = path.dirname(__filename);
const logsPath = path.join(__dirname, 'logs');
// 如果logs文件夹不存在则创建
if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath);
}

const successPath = path.join(logsPath, 'TradingSuccess.csv');
const errorPath = path.join(logsPath, 'TradingError.csv');


const pwd = readlineSync.question('Please enter your password: ', {
    hideEchoBack: true // 密码不回显
});

const connection = new Connection(''); // RPC，到https://www.helius.dev/注册获取
const wallet_path = ''; // 钱包文件路径
const tokenIn = 'So11111111111111111111111111111111111111112';  // 支付Token，SOL Token 地址
const tokenOut = 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1'; // 获得Token，Bonk SOL 地址
const minAmount = 10 * 10 ** 6; // 最少买入jup数量
const maxAmount = 15 * 10 ** 6; // 最多买入jup数量

const wallets = convertCSVToObjectSync(wallet_path);

;(async () => {
        // 遍历钱包
        for (let i = 0; i < wallets.length; i++) {
            const wt = wallets[i];
            const privateKey = decryptUsingAESGCM(wt.a, wt.e, wt.i, wt.s, pwd)
            const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(privateKey)));

            const sanctum = new Sanctum(connection, wallet);
            const tokenOutBalanceInfo = await getSPLBalance(connection, wallet.publicKey, tokenOut);
            const MAX_RETRY = 5;
            let num = 0;
            let date;
            while (num < MAX_RETRY) {
                try {
                    // 查询SOL余额
                    const SOLBalance = await connection.getBalance(wallet.publicKey);
                    if (SOLBalance < 0.0003 * 10 ** 9) {
                        logger.error('SOL余额不足');
                        break;
                    }
    
                    const currentTokenOutBalanceInfo = await getSPLBalance(connection, wallet.publicKey, tokenOut);
                    if (currentTokenOutBalanceInfo.amount !== tokenOutBalanceInfo.amount) {
                      logger.info(`钱包:${wt.Address}余额发生变化, SOL余额:${SOLBalance}, 初始JUP余额:${tokenOutBalanceInfo.uiAmount}, 当前JUP余额:${currentTokenOutBalanceInfo.uiAmount}`);
                      if (currentTokenOutBalanceInfo.amount > tokenOutBalanceInfo.amount) {
                        logger.success(`当前余额大于初始余额,购买成功`);
                        // 获取当前本地时间
                        date = new Date().toLocaleString();
                        await appendObjectToCSV({ date, ...wt }, successPath)
                        break;
                      }
                    }
                    
    
                    const amount = Math.floor(Math.random() * (maxAmount - minAmount) + minAmount);
    
                    logger.info('wallet address', wt.Address, 'SOLBalance:', SOLBalance, 'trade amount:', amount);
                    let txid = await sanctum.swap(tokenIn, tokenOut, 1000000, 'ExactOut');
                    if (txid) {
                        logger.success(`交易成功:https://solscan.io/tx/${txid}`)
                        getSPLBalance(connection, wallet.publicKey, tokenOut).then(balance => {
                            logger.info(`JUP余额: ${balance.uiAmount}`);
                        })
                        // 获取当前本地时间
                        date = new Date().toLocaleString();
                        await appendObjectToCSV({ date, ...wt }, successPath)
                        break;
                    } else {
                        num++;
                        logger.error('交易失败,休息12秒后重试...');
                        await sleep(0.2);
                        if (num === MAX_RETRY) {
                            logger.error('重试次数已达上限');
                            date = new Date().toLocaleString();
                            await appendObjectToCSV({ date, ...wt, Error: '重试次数已达上限' }, errorPath)
                            break;
                        }
                    }
                } catch (error) {
                    num++;
                    logger.error('交易失败,休息12秒后重试...');
                    await sleep(0.2);
                    if (num === MAX_RETRY) {
                        logger.error('重试次数已达上限');
                        date = new Date().toLocaleString();
                        await appendObjectToCSV({ date, ...wt, Error: error }, errorPath)
                        break;
                    }
    
                }
            }
            if (i < wallets.length - 1) {
                // 随机暂停 5-10分钟
                const sleepTime = Math.floor(Math.random() * (10 - 5) + 5);
                logger.info(`休息${sleepTime}分钟后继续...`)
                await sleep(sleepTime);
            }
        }
})();