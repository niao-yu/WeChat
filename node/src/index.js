const express = require('express')
const crypto = require('crypto')  //引入加密模块
const config = require('./config')//引入配置文件
const request = require('request')
let bodyParser = require('body-parser') // 中间件,用于获取 post 的传值
const sha1 = require('sha1')
let urlLib = require('url') // 格式化 get 请求的传参

const app = express()
app.use(bodyParser.urlencoded({ extended: false }))


const myCache = {
  access_token: {
    setedTime: 0,
    val: undefined
  },
  jsapi_ticket: {
    setedTime: 0,
    val: undefined,
  },
}

// 获取 access_token
let _getAccess_token = () => {
  // access_token 未过期
  if (myCache.access_token.val && (Math.floor(Date.now()) - myCache.access_token.setedTime) / 1000 < 7100) {
    return Promise.resolve(myCache.access_token.val)
  } else { // access_token 过期了
    return new Promise((resolve, reject) => {
      request(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appId}&secret=${config.appSecret}`, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          let tokenMap = JSON.parse(body)
          // 缓存 access_token
          myCache.access_token.setedTime = Math.floor(Date.now())
          myCache.access_token.val = tokenMap.access_token
          resolve(tokenMap.access_token)
        } else {
          reject(error)
        }
      })
      // getAccess_token().then(tokenMap => resolve(tokenMap)).catch(error => reject(error))
    })
  }
}

// 获取 Ticket
let _getJsapi_ticket = () => {
  // 缓存的签名尚未过期 --- 微信规定过期时间为7200秒，这里自己设置7100秒，留100秒的延迟
  if (myCache.jsapi_ticket.val && (Math.floor(Date.now()) - myCache.jsapi_ticket.setedTime) / 1000 < 7100) {
    return Promise.resolve(myCache.jsapi_ticket.val)
  } else { // 已过期，重新获取
    return new Promise((resolve, reject) => {
      // 先获取 token
      _getAccess_token().then(access_token => {
        request('https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=' + access_token + '&type=jsapi', function (error, resp, json) {
          if (!error && resp.statusCode == 200) {
            let ticketMap = JSON.parse(json)
            // 缓存 ticket
            myCache.jsapi_ticket.setedTime = Math.floor(Date.now())
            myCache.jsapi_ticket.val = ticketMap.ticket
            resolve(ticketMap.ticket)
          } else {
            reject(error)
          }
        })
      }).catch(error => reject(error))
    })
  }
}

// 我自己的前端调用，获取微信的资源
app.post('/getsign', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*')
  try {
    params = req.body
    if (!params && !params.url) return res.send('please set url of page')
    let url = params.url
    // 获取 ticket
    _getJsapi_ticket().then(jsapi_ticket => {
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
app.get('/forWx', function (req, res) {
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

const server = app.listen(3000)