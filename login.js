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
(async () => {
  // const browser = await puppeteer.launch({ headless: false })
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()

  await page.setViewport({ width: 1920, height: 1080 })
  await page.goto('https://www.jumbo.pt/Frontoffice/MyAccount/Authentication')

  const navigationPromise = page.waitForNavigation()

  await page.click('#cookies-accept')
  // await page.waitForSelector('input[type="email"]')
  await page.type('[name="username"]', 'alexandresalsinha@gmail.com')

  // await page.waitForSelector('[name="password"]', { visible: true })
  await page.type('[name="password"]', '1234qwrefdsa')

  // await page.waitForSelector('#passwordNext', { visible: true })
  await page.click('#jumbo-login > form.jumbo-form.login-form > div.jumbo-submit.jumbo-button.jumbo-button-flex.login-form')

  await navigationPromise


  var lines = require('fs').readFileSync('urls.txt', 'utf-8')
    .split('\n')
    .filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    console.log('Line from file:', line);

    await page.goto('https://www.jumbo.pt' + line)

    await navigationPromise

    await page.click('#conteudo > div.product-detail > div:nth-child(1) > div.col-md-11.col-sm-11.col-xs-12 > div > div.col-md-5.col-sm-5.col-xs-12.text-info.pull-right > div.product-btns-panel > button.btn.btn-link.large.hidden-xs')

    await navigationPromise
    // if (await page.$('deliveryMethodModal') !== null) {
    //   console.log('found');
    const isNotHidden = await page.$eval('#deliveryMethodModal', (elem) => {
      return elem.style.display !== 'none'
    })
    if (isNotHidden) {
      // const deliveryConfirmationExists = await page.$eval('#deliveryMethodComfirmation', (elem) => {
      //   return true
      // })
      if (await page.$('#deliveryMethodComfirmation') !== null) await page.click('#deliveryMethodComfirmation')
    }
    // }

    await navigationPromise
  }


  console.log(isNotHidden)
  await page.screenshot({ path: screenshot })

  await browser.close()
})()