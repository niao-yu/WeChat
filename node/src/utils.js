const request = require('request')
const config = require('./config') // 引入配置文件
const urlLib = require('url') // 格式化 get 请求的传参
const qs = require('qs')

// 缓存
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

const utils = {
  // 获取 access_token
  getAccess_token() {
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
      })
    }
  },
  // 获取 Ticket
  getJsapi_ticket() {
    // 缓存的签名尚未过期 --- 微信规定过期时间为7200秒，这里自己设置7100秒，留100秒的延迟
    if (myCache.jsapi_ticket.val && (Math.floor(Date.now()) - myCache.jsapi_ticket.setedTime) / 1000 < 7100) {
      return Promise.resolve(myCache.jsapi_ticket.val)
    } else { // 已过期，重新获取
      return new Promise((resolve, reject) => {
        // 先获取 token
        utils.getAccess_token().then(access_token => {
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
  },
  // 通过 code 获取 openId 和 access_token
  getOpenIdAndAccessToken(code) {
    let params = {
      appid: config.appId,
      secret: config.appSecret,
      code,
      grant_type: 'authorization_code'
    }
    let url = `https://api.weixin.qq.com/sns/oauth2/access_token?${qs.stringify(params)}`
    return new Promise((resolve, reject) => {
      request(url, function (error, res, body) {
        if (res) {
          let bodyObj = JSON.parse(body)
          resolve(bodyObj);
        } else {
          reject(error);
        }
      })
    })
  },
  // 获取用户信息
  getUserInfo({ access_token, openid }) {
    let params = {
      access_token,
      openid,
      lang: 'zh_CN'
    };
    let url = `https://api.weixin.qq.com/sns/userinfo?${qs.stringify(params)}`
    return new Promise((resolve, reject) => {
      request(url, function (err, res, body) {
        if (res) {
          resolve(JSON.parse(body))
        } else {
          reject(err);
        }
      });
    })
  }
}

module.exports = utils