import nacl from 'tweetnacl';
import bs58 from 'bs58';
// import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { Keypair } from '@solana/web3.js';
import readlineSync from 'readline-sync';
import Logger from '@youpaichris/logger';
const logger = new Logger();
import { sleep, convertCSVToObjectSync, decryptUsingAESGCM, appendObjectToCSV } from './src/utils.js';
import axios from 'axios-https-proxy-fix';



// 获取当前文件路径
const __filename = new URL(import.meta.url).pathname;
// 获取上级目录路径
const __dirname = path.dirname(__filename);
const logsPath = path.join(__dirname, 'logs');
// 如果logs文件夹不存在则创建
if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath);
}

const successPath = path.join(logsPath, 'AnswerQuestsSuccess.csv');
const errorPath = path.join(logsPath, 'AnswerQuestsError.csv');

const pwd = readlineSync.question('Please enter your password: ', {
    hideEchoBack: true // 密码不回显
});

const wallet_path = ''; // 钱包文件路径
const QuestionId = '3';  // 问题ID
const answer = 'GLOAMTIDE'; // 答案 任务 2 答案：EVENSTAR CATHEDRAL，任务3的答案是：GLOAMTIDE
const proxy = {
    host: '', // 代理服务器地址
    port: 33000, // 端口
    auth: {
      username: '', // 代理用户名
      password: '' // 代理密码
    }
}

const wallets = convertCSVToObjectSync(wallet_path);
; (async () => {
    for (let i = 0; i < wallets.length; i++) {
        while (true) {

            logger.info('开始测试代理...');
            try {
                const response = await axios.get('https://myip.ipip.net', {
                    proxy,
                    timeout: 5000  // 设置超时时间为 5000 毫秒，即 5 秒
                });
                logger.success('验证成功, ', response.data);
                break;
            } catch (error) {
                logger.success('代理失效，等待1分钟后重新验证')
                console.log('error', error);
                await sleep(1);
            }

        }

        const wt = wallets[i];
        const privateKey = decryptUsingAESGCM(wt.a, wt.e, wt.i, wt.s, pwd)
        // 创建一个新的密钥对，代表一个钱包
        const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));

        const params = {
            "pk": wallet.publicKey.toBase58(),
            "value": { answer: answer.toLowerCase() }
        };

        const url = `https://wonderland-api2.ngrok.dev/s1/quests/answer/${QuestionId}`;
        const headers = {
            'Content-Type': 'application/json'
        };
        let date;
        try {
            logger.success(`钱包: ${wallet.publicKey.toBase58()}, 开始答题`);

            const response = await axios.post(url, params, {
                headers,
                proxy,
                timeout: 10000
            });

            logger.success(`任务${QuestionId}答题成功`);
            // 获取当前本地时间
            date = new Date().toLocaleString();
            await appendObjectToCSV({ date, ...wt }, successPath);

        } catch (error) {
            logger.error(`任务${QuestionId}答题失败,错误信息：`, error.response.data);
            date = new Date().toLocaleString();
            await appendObjectToCSV({ date, ...wt, Error: error.response.data }, errorPath);
        }
        if (i < wallets.length - 1) {
            // 随机暂停 5-10分钟

            const sleepTime = Math.floor(Math.random() * (10 - 5) + 5);
            logger.info(`休息${sleepTime}分钟后继续...`)
            await sleep(sleepTime);
        }
    }
})();
