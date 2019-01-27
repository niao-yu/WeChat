const express = require('express')
const crypto = require('crypto')  //引入加密模块
const config = require('./config')//引入配置文件
let bodyParser = require('body-parser') // 中间件,用于获取 post 的传值
const sha1 = require('sha1')

const { getJsapi_ticket } = require('./utils')

const server = express()
server.use(bodyParser.urlencoded({ extended: false }))

server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

// 我自己的前端调用，获取微信签名
server.post('/getsign', (req, res) => {
  try {
    params = req.body
    if (!params && !params.url) return res.send('please set url of page')
    let url = params.url
    // 获取 ticket
    getJsapi_ticket().then(jsapi_ticket => {
      let num = Math.random()
      let noncestr = num.toString(32).substr(3, 20) // 随机字符串
      let timestamp = Math.floor(Date.now() / 1000) //精确到秒
      let obj = {
        noncestr,
        timestamp,
        url,
        appId: config.appId,
        jsapi_ticket,
        signature: sha1('jsapi_ticket=' + jsapi_ticket + '&noncestr=' + noncestr + '&timestamp=' + timestamp + '&url=' + url)
      }
      res.send(obj)
    }).catch(error => res.send(error))
  } catch (error) {
    res.send(error)
  }
})

// 提供给微信调用
server.get('/forWx', function (req, res) {
  res.header('Access-Control-Allow-Origin', '*')
  //1.获取微信服务器Get请求的参数 signature、timestamp、nonce、echostr
  let signature = req.query.signature // 微信加密签名
  let timestamp = req.query.timestamp // 时间戳
  let nonce = req.query.nonce // 随机数
  let echostr = req.query.echost // 随机字符串

  //2.将token、timestamp、nonce三个参数进行字典序排序
  let array = [config.token, timestamp, nonce]
  array.sort()

  //3.将三个参数字符串拼接成一个字符串进行sha1加密
  let tempStr = array.join('')
  const hashCode = crypto.createHash('sha1') //创建加密类型 
  let resultCode = hashCode.update(tempStr, 'utf8').digest('hex') //对传入的字符串进行加密
  //4.开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
  if (resultCode === signature) {
    res.send(echostr)
  } else {
    res.send('mismatch')
  }
})

const app = server.listen(3000)