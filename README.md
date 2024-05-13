# Sanctum-bot

# 加入Wonder Land

1. 打开`JoinWonderLand.js`, 修改代码中下面的内容：
``` javascript
const wallet_path = ''; // 钱包文件路径
const referralCode = ''; // 邀请码

const proxy = {
    host: '',  // 代理IP地址
    port: 33000, // 代理端口
    auth: {
      username: '',  // 验证用户名
      password: '' // 验证密码
    }
  }
```
2. 在终端中运行`node JoinWonderLand.js` 。


# 答题

1. 打开`Quests.js`, 修改代码中下面的内容：
``` javascript
const wallet_path = ''; // 钱包文件路径
const QuestionId = '2';  // 问题ID  1,2,3
const answer = 'EVENSTAR CATHEDRAL'; // 答案 任务 2 答案：EVENSTAR CATHEDRAL，任务3的答案是：GLOAMTIDE

const proxy = {
    host: '',  // 代理IP地址
    port: 33000, // 代理端口
    auth: {
      username: '',  // 验证用户名
      password: '' // 验证密码
    }
  }
```
2. 在终端中运行`node Quests.js` 。
