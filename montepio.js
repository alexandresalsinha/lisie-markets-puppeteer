// const puppeteer = require('puppeteer')
const screenshot = 'pageScreenShot.png';
// (async () => {
//   const browser = await puppeteer.launch({headless: true})
//   const page = await browser.newPage()
//   await page.goto('https://www.jumbo.pt/Frontoffice/MyAccount/Authentication')
//   await page.type('[name="username"]','alexandresalsinha@gmail.com')
//   await page.type('[name="password"]', '1234qwrefdsa')
//   await page.click('.login-form')
//   await page.waitForNavigation()
//   await page.screenshot({ path: screenshot })
//   browser.close()
//   console.log('See screenshot: ' + screenshot)
// })()

const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors'); 
const device = devices['iPhone 6'];

(async () => {
  //const browser = await puppeteer.launch({ headless: false })
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()

  await page.setViewport({ width: 1920, height: 1080 })
  await page.goto('https://m.bancomontepio.pt/netmovel24/login.jsp')

  const navigationPromise = page.waitForNavigation()

  
  //await page.click('#cookies-accept')
  // await page.waitForSelector('input[type="email"]')
  await page.type('#username', '3741896')

  // await page.waitForSelector('[name="password"]', { visible: true })
  await page.type('#password', '691412')

  // await page.waitForSelector('#passwordNext', { visible: true })
  await page.click('#form1 > div.ui-submit.ui-btn.ui-shadow.ui-btn-corner-all.ui-btn-up-a > input')

  await navigationPromise



    await page.goto('https://m.bancomontepio.pt/netmovel24/func/contasordem/ctaOrdemSaldos.jsp')

    await navigationPromise

    const isNotHidden = await page.$eval('.account-ammount', (elem) => {
      return elem.innerHTML
    })

  console.log(isNotHidden.replace('Saldo Contab.: ','').replace(' EUR',''))
  await page.screenshot({ path: screenshot })

  await browser.close()
})()