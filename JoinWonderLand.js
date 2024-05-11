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

const successPath = path.join(logsPath, 'JoinWonderlandSuccess.csv');
const errorPath = path.join(logsPath, 'JoinWonderlandError.csv');

const pwd = readlineSync.question('Please enter your password: ', {
    hideEchoBack: true // 密码不回显
});

const wallet_path = '/Users/lishuai/Documents/crypto/bockchainbot/SOLTestWalle加密.csv'; // 钱包文件路径
const referralCode = '5RL3SE'; // 邀请码

const proxy = {
    host: '85.239.53.78',
    port: 33000,
    auth: {
      username: 'wrtest66781-sess_8zix1690gxdp_1+hk',
      password: 'AsdBBcDtRERy'
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

        // // 创建一个新的密钥对，代表一个钱包
        // const wallet = Keypair.generate();

        logger.info(`地址: ${wallet.publicKey.toBase58()} , 开始加入Wonderland...`);
        // 要签名的消息
        const message = "WAT IS WONDERLAND";

        // 将消息转换为 Buffer
        const messageBuffer = Buffer.from(message, 'utf8');

        // 使用钱包的私钥对消息进行签名
        const signature = nacl.sign.detached(messageBuffer, wallet.secretKey);

        // 将拼接后的结果转换为 Base58 格式
        const signatureBase58 = bs58.encode(signature);

        const params = {
            "pk": wallet.publicKey.toBase58(),
            "code": referralCode, // 邀请码
            "sig": signatureBase58,
            "msg": messageBuffer.toString('base64')
        };

        const url = 'https://wonderland-api2.ngrok.dev/s1/onboard'
        const headers = {
            'Content-Type': 'application/json'
        };
        let date;
        try {
            const response = await axios.post(url, params, { 
                headers, 
                proxy,
                timeout: 10000
            });
            if ('referralCode' in response.data) {
                logger.success(`加入Wonderland成功, 钱包地址: ${wallet.publicKey.toBase58()}, 邀请码: ${response.data.referralCode}`);
            }

            // 获取当前本地时间
            date = new Date().toLocaleString();
            await appendObjectToCSV({ date, ...wt }, successPath);

        } catch (error) {
            logger.error('加入Wonderland失败,错误信息：', error.response.data);
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
