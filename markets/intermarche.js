// var io = require('socket.io')(server);
const puppeteer = require('puppeteer-extra')

var request = require('request');
// var scrollPageToBottom = require('puppeteer-autoscroll-down');
var fetch = require('node-fetch');
// var server = require('http').Server(app);
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { loadCookiesFromFile, saveCookiesToFile, saveToFile, deleteFile } = require('../utils');
const fs = require('node:fs');

var ioG;
var SocketUsersG;
var userIdG;


const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
puppeteer.use(StealthPlugin());

// Use the user's installed Chrome instead of the bundled Chromium.
// Chrome 136+ refuses automation on the default "User Data" directory, so a
// dedicated persistent profile is used instead (cookies/sessions persist there).
const CHROME_EXECUTABLE_PATH = (process.env['PROGRAMFILES'] || 'C:\\Program Files') + '\\Google\\Chrome\\Application\\chrome.exe';
const CHROME_USER_DATA_DIR = require('node:path').join(__dirname, '..', 'chrome-profile');

async function addUserList(userId, data, io, SocketUsers) {
    ioG = io;
    SocketUsersG = SocketUsers;
    userIdG = userId;
    // (async () => {
    var startDate = new Date();
    // const browser = await puppeteer.launch({ headless: false });
    const browser = await puppeteer.launch({
        executablePath: CHROME_EXECUTABLE_PATH,
        userDataDir: CHROME_USER_DATA_DIR,
        args: ['--disable-gpu']
    });
    const page = await browser.newPage();
    // page.on('console', msg => console.log(msg));

    var productItemsList = [];

    var screenshot = 'screenshot.png';

    console.log("### Starting addUserListToJumbo ###");
    await page.setViewport({ width: 1920, height: 1080 })

    // const navigationPromise = page.waitForNavigation()
    try {
        var response = await page.goto('https://www.auchan.pt', {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });

        await page.click('#onetrust-accept-btn-handler')
        await page.waitFor(2000);
        var responseLogin = await page.goto('https://www.auchan.pt/on/demandware.store/Sites-AuchanPT-Site/pt_PT/Login-OAuthLogin?oauthProvider=Salesforce&oauthLoginTargetEndPoint=0', {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });
        //await page.click('.auc-header-account')
        // await page.click('#btnLogin')
        await page.waitForSelector('[type="password"]', { visible: true, timeout: 0 });
        // await navigationPromise
        // await page.waitFor(5000)
        // var response = await page.goto('https://www.auchan.pt/Frontoffice/MyAccount/Authentication', {
        //     timeout: 25000,
        //     waitUntil: 'networkidle2',
        // });
        // var response = await page.goto('https://login.auchan.pt/authorization?language=pt', {
        //     timeout: 25000,
        //     waitUntil: 'networkidle2',
        // });
        // const navigationPromise = page.waitForNavigation()


        // //TESTING, if not working remove
        //await navigationPromise

        //await page.waitFor(2000);
        //console log source html code
        //console.log(await response.text());

        // var response = await page.goto('https://www.auchan.pt/Frontoffice/MyAccount/Authentication',{
        //     timeout: 25000,
        //     waitUntil: 'networkidle2',
        // });

        // await page.click('#cookies-accept')

        // await page.type('[name="username"]', data.username)
        // await page.type('[name="password"]', data.password)
        await page.type('[type="email"]', data.username)
        await page.type('[type="password"]', data.password)
    } catch (error) {
        console.log("### Erro a aceder ao auchan ###");
        let message = { "message": "Erro a aceder ao auchan", "sucess": "false" };
        // SendUpdateToUser(userId, message, io, SocketUsers);
        return;
    }
    console.log("### Authenticating ###");
    let message = { "message": "A autenticar ao Auchan...", "sucess": "true" };
    SendUpdateToUser(userId, message, io, SocketUsers);

    //var toremove = "";
    var anchorLogin = await page.$('#submitForm');
    await page.evaluate(e => e.click(), anchorLogin);

    try {
        //await page.type('[type="password"]', String.fromCharCode(13));
        //await navigationPromise

        await page.waitFor(5000);
        // await page.waitFor(10000);


        //See if login was sucessful
        try {
            var anchorLogin = await page.$('[type="password"]');
            // var anchorLogin = await page.$('#jumbo-login > form.jumbo-form.login-form > div.jumbo-submit.jumbo-button.jumbo-button-flex.login-form')
            if (anchorLogin) {
                try {
                    var emailReconfirmationPopup = await page.waitForSelector('#popUpAge', { visible: true, timeout: 2500 });
                    // var emailReconfirmationPopup = await page.waitForSelector('#popUpAge', { visible: true, timeout: 5000 });
                    if (emailReconfirmationPopup) {
                        console.log("### Necessita de re-confirmar email ###");
                        let message = { "message": "Necessitade re-confirmar o seu email no auchan online", "sucess": "true" };
                        SendUpdateToUser(userId, message, io, SocketUsers);
                        await page.close()
                        await browser.close()
                        return;
                    }
                } catch (error) {
                    console.log("### Não necessita de re-confirmar email ###");
                }

                //check if login was sucessful
                console.log("### Login do auchan online inválido ###");
                let message = { "message": "Login do auchan online inválido", "sucess": "true" };
                SendUpdateToUser(userId, message, io, SocketUsers);
                await page.close()
                await browser.close()
                return;
            }
        } catch (error) {
            console.log("### Login feito com sucesso ###");
        }

    } catch (error) {
        console.log("### Erro a autenticar ao Auchan ###");
        var jsonDataObj = {
            UserId: userId,
            Sucess: false,
            AuthenticationSucess: false
        };
        request.post({
            url: 'https://lisie.app/puppetter/NotifyProductsAddedToJumboOnline',
            //url: 'http://6c2c4bfa.ngrok.io/puppetter/NotifyProductsAddedToJumboOnline',
            body: jsonDataObj,
            json: true
        }, function (error, response, body) {
            console.log(body);
        });
        return;
    }


    await setStoreLocation(page, data.products);

    message = { "message": "A adicionar produtos ao Auchan...", "sucess": "true" };
    SendUpdateToUser(userId, message, io, SocketUsers);

    var productsAdded = [];
    var productsNotAdded = await addProducts(page, data.products)

    var endDate = new Date();
    var seconds = (endDate.getTime() - startDate.getTime()) / 1000;

    await page.close()
    await browser.close()

    //TODO - send products not added to webservice post NotifyProductsAddedToJumboOnline

    message = { "message": "Processo de adicionar produtos finalizado", "sucess": "true" };
    SendUpdateToUser(userId, message, io, SocketUsers);

    console.log("### Produtos não adicionados ###");
    console.log(productsNotAdded);

    var jsonDataObj = {
        UserId: userId,
        TimespanSeconds: seconds,
        ProductsNotAdded: productsNotAdded,
        ProductsAdded: productsAdded,
        TotalProducts: data.products.length,
        Sucess: true,
        AuthenticationSucess: true
    };

    request
        .get('http://lisie.app/puppetter/NotifyProductsAddedStore?userId=' + userId + '&store=Auchan&timespanseconds=' + seconds)
        .on('response', function (response) {
            console.log(response.statusCode)
        })
        .on('error', function (e) {
            console.log(e);
            console.log('Error calling lisie.app/puppetter/NotifyProductsAddedToJumboOnline');
        });
    return;
}

function SendUpdateToUser(userName, message, io, SocketUsers) {
    var userSessionId = SocketUsers.get(userName);
    if (userSessionId != undefined && userSessionId != null) {
        try {
            io.sockets.sockets[userSessionId].emit('message', message);
        } catch (error) {
            console.log(' error sending update to user ');
        }
    }
    return;
}

function SendUpdateToUserG(message) {
    var userSessionId = SocketUsersG.get(userIdG);
    if (userSessionId != undefined && userSessionId != null) {
        try {
            ioG.sockets.sockets[userSessionId].emit('message', message);
        } catch (error) {
            console.log(' error sending update to user ');
        }
    }
    return;
}

async function setStoreLocation(page, products) {
    for (let index = 0; index < products.length; index++) {
        const product = products[index];

        try {
            console.log("### Openning ### " + 'https://www.auchan.pt' + product.Url);
            // let message = { "message": "A adicionar produto " + product.Name , "sucess": "true" };
            // SendUpdateToUser(userId, message, io, SocketUsers);

            await page.goto('https://www.auchan.pt' + product.Url, {
                timeout: 25000,
                waitUntil: 'networkidle2',
            });

            try { //first try to get quantity input
                //get quantity there
                await page.click('.auc-js-add-to-cart');
            } catch (error) { //quantity ele , find add button 
                try {
                    await page.click('.btn-increment');
                } catch (error) { //quantity element not found
                }
            }
            try {
                var _needToChooseLocation = await page.waitForSelector('#auc-delivery-options-modal', { visible: true, timeout: 2500 });
                if (_needToChooseLocation) {
                    console.log("### Necessita de por o local de busca ou entrega ###");
                    let message = { "message": "Necessita de por o local de busca ou entrega", "sucess": "true" };

                    await page.click('#auc-delivery-options-modal > div > div > div.modal-body.auc-modal__body.text-center > div > div:nth-child(2) > div');
                    var _needToChooseLocation2 = await page.waitForSelector('#auc-delivery-options-modal > div > div > div.modal-body.auc-modal__body > div > div > div.col-12.col-md-5.auc-modal--click-collect__stores > div.auc-modal--click-collect__stores-list > div > div > div > div > div.row.no-gutters.auc-modal--click-collect__stores-list__store__delivery-types > div.col-5.auc-modal--click-collect__stores-list__store__delivery-types__button > button', { visible: true, timeout: 2500 });
                    await page.click('#auc-delivery-options-modal > div > div > div.modal-body.auc-modal__body > div > div > div.col-12.col-md-5.auc-modal--click-collect__stores > div.auc-modal--click-collect__stores-list > div > div > div > div > div.row.no-gutters.auc-modal--click-collect__stores-list__store__delivery-types > div.col-5.auc-modal--click-collect__stores-list__store__delivery-types__button > button');
                    var _needToChooseLocation3 = await page.waitForSelector('#auc-delivery-options-modal', { visible: false, timeout: 10500 });
                    await page.waitFor(2000);
                    return true;
                }
            } catch (error) {
                console.log("### Não necessita de re-confirmar email ###");
            }
        } catch (error) {
            await page.screenshot({ path: './lastScreenshot.png' });
            await page.waitFor(500);
            console.log('### Error ### getting product url error', error);
            let message = { "message": "Produto " + product.Name + " , erro ao ir extrair informação ao url" + product.Url, "sucess": "true" };
            // SendUpdateToUser(userId, message, io, SocketUsers);
            continue;
        }
    }
}

async function addProducts(page, products) {
    var productsNotAdded = [];
    var productsAdded = [];
    var _eleStr = '#maincontent > div.container.product-detail.product-wrapper.auc-pdp__body > div.row.no-gutters.auc-pdp__upper-section.auc-pdp__upper-section--grocery > div.col-12.col-md-7.col-xl-6.auc-pdp__right-section > div > div.auc-pdp__middle-section.row.no-gutters > div.prices-add-to-cart-actions.col-12.col-xl-5 > div > div > div > div > div > div > input';

    for (let index = 0; index < products.length; index++) {
        const product = products[index];

        try {
            console.log("### Openning ### " + 'https://www.auchan.pt' + product.Url);
            let message = { "message": "A adicionar produto " + product.Name, "sucess": "true" };
            // SendUpdateToUser(userId, message, io, SocketUsers);
            SendUpdateToUserG(message);

            await page.goto('https://www.auchan.pt' + product.Url, {
                timeout: 25000,
                waitUntil: 'networkidle2',
                // waitUntil: 'domcontentloaded',
            });

            // await page.waitForNavigation({timeout: 60000, waitUntil: 'load'});
            // await page.waitForNavigation({
            //     waitUntil: 'networkidle0',
            // });

            //first check if found
            try {
                var _notFound = await page.waitForSelector('.auc-404error', { visible: true, timeout: 2500 });
                productsNotAdded.push(product);
                continue;
            } catch (error) {
            }

            try { //first try to get quantity input
                //get quantity there
                // var _btnAddQuantityExists = await page.waitForSelector('.btn-increment', { visible: true, timeout: 2500 });
                const inputValue = await page.$eval(_eleStr, el => el.value);
                // var _quantityValue2 = await page.evaluate(e => e.value.trim(), _quantityEl);
                if (product.Quantity != parseInt(inputValue)) {
                    await page.focus(_eleStr);
                    for (let i = 0; i < inputValue.length; i++) {
                        await page.keyboard.press('Backspace');
                    }
                    await page.type(_eleStr, String(product.Quantity - 1))
                    await page.click('.btn-increment');
                }
            } catch (error) { //quantity ele , find add button 
                try {
                    // var _addButton = await page.waitForSelector('.auc-js-add-to-cart', { visible: true, timeout: 2500 });
                    await page.click('.auc-js-add-to-cart');
                    await page.waitFor(2000)
                    if (product.Quantity > 1) {
                        // await page.waitForSelector(_eleStr, { visible: true, timeout: 2500 });
                        const inputValue = await page.$eval(_eleStr, el => el.value);
                        if (product.Quantity != parseInt(inputValue)) {
                            await page.focus(_eleStr);
                            for (let i = 0; i < inputValue.length; i++) {
                                await page.keyboard.press('Backspace');
                            }
                            await page.type(_eleStr, String(product.Quantity - 1))
                            await page.click('.btn-increment');
                        }
                    }
                } catch (error) { //quantity element not found
                    productsNotAdded.push(product);
                    let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
                    // SendUpdateToUser(userId, message, io, SocketUsers);
                    SendUpdateToUserG(message);
                    continue;
                }
            }
            try {
                var _needToChooseLocation = await page.waitForSelector('#auc-delivery-options-modal', { visible: true, timeout: 2500 });
            } catch (error) {
                //productsAdded.push(product);
                console.log("### Não existe o diálogo de guardar loja ###");
            }

            message = { "message": (index + 1) + " de " + products.length + " produtos adicionados ao Auchan Online", "sucess": "true" };
            // SendUpdateToUser(userId, message, io, SocketUsers);
            SendUpdateToUserG(message);

            productsAdded.push(product);
        } catch (error) {
            await page.screenshot({ path: './lastScreenshot.png' });
            await page.waitFor(500);
            console.log('### Error ### getting product url error', error);
            let message = { "message": "Produto " + product.Name + " , erro ao ir extrair informação ao url" + product.Url, "sucess": "true" };
            SendUpdateToUser(userId, message, io, SocketUsers);
            continue;
        }

    }
    return productsNotAdded;
}

async function getAllCategories() {
    // const browser = await puppeteer.launch({ headless: false });
    const browser = await puppeteer.launch({
        executablePath: CHROME_EXECUTABLE_PATH,
        userDataDir: CHROME_USER_DATA_DIR,
        args: ['--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    var finalData = [];
    try {
        var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana', {
            timeout: 25000,
            waitUntil: 'domcontentloaded',
        });

        await page.waitFor(2000);
        var _categoriesFinal = [];

        //IMPORTAT - page DOM hml source
        // const data = await page.evaluate(() => document.querySelector('*').outerHTML);

        // var _categories = await page.$$('.vignette_produit_info');
        var _categories = await page.$$("#main > nav > ul > li.separateur > nav > div > div > ul > li > a");

        for (const _category of _categories) {
            //IMPORTANT - get href of anchor
            const _categoryHref = await page.evaluate(anchor => anchor.getAttribute('href'), _category);
            _categoriesFinal.push(_categoryHref);
        }

        console.log(_categoriesFinal);
        await page.close();
        return _categoriesFinal;
    } catch (error) {
        console.log(error);
    }

    await page.close()
    // await browser.close()
    return finalData;
}
// async function getNewProducts() {
//     const browser = await puppeteer.launch({ headless: false });
//     // const browser = await puppeteer.launch({
//     //     args: ['--no-sandbox',
//     //         '--disable-setuid-sandbox',
//     //         '--disable-gpu']
//     // });
//     const page = await browser.newPage();
//     await page.setViewport({ width: 1920, height: 1080 });

//     try {
//         var response = await page.goto('https://www.auchan.pt', {
//             timeout: 25000,
//             waitUntil: 'networkidle2',
//         });

//         await page.click('.accept-policy.auc-button__rounded--primary')

//         const _allCategories = await page.$$('.dropdown-link'); //first level

//         var counter = 1;
//         for (const _category of _allCategories) {
//             const _aHref = await page.evaluate(anchor => anchor.getAttribute('href'), _category);
//             const _aClass = await page.evaluate(anchor => anchor.getAttribute('class'), _category);
//             if (_aClass.indexOf('dropdown-toggle') > -1) {
//                 continue;
//             }

//             // var response = await page.goto('https://www.auchan.pt' + _aHref, {
//             var response = await page.goto('https://www.auchan.pt' + '/pt/produtos-frescos/legumes/abobora-cenoura-e-alho-frances/', {
//                 timeout: 25000,
//                 waitUntil: 'networkidle2',
//             });

//             await page.evaluate(scrollToBottom);
//             await page.waitFor(3000);

//             const _allProducts = await page.$$('.product'); //first level
//             var finalData = [];
//             var counter = 1;
//             for (const _product of _allProducts) {
//                 const _product_a = await _product.$('a');
//                 const _product_a_href = await page.evaluate(anchor => anchor.getAttribute('href'), _product_a);
//                 var _productId = _product_a_href.replace('.html', '');
//                 _productId = _productId.substring(_productId.lastIndexOf('/') + 1);
//                 console.log(_productId);
//                 finalData.push(_productId);
//             }
//             break;
//             // counter++;
//         }

//         await page.close()
//         await browser.close()
//         return finalData;

//     } catch (error) {
//         console.log("### Erro a aceder ao auchan ###", error);
//         let message = { "message": "Erro a aceder ao auchan", "sucess": "false" };
//         // SendUpdateToUser(userId, message, io, SocketUsers);
//         await page.close()
//         await browser.close()
//         // return;
//     }
//     return finalData;
// }

async function getNewProducts(url) {
    // const browser = await puppeteer.launch({ headless: false });
    const browser = await puppeteer.launch({
        executablePath: CHROME_EXECUTABLE_PATH,
        userDataDir: CHROME_USER_DATA_DIR,
        args: ['--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    var finalData = [];

    try {
        var response = await page.goto('https://lojaonline.intermarche.pt' + url, {
            timeout: 25000,
            waitUntil: 'domcontentloaded',
        });

        await page.waitFor(2000);

        //list_produits_serveur
        var responseText = await response.text();
        var searchResults = (await page.evaluate(() => list_produits_serveur));

        finalData = searchResults.map(function (val, index) {
            return val.list_product_id;
        });

    } catch (error) {
        console.log(error);
    }

    await page.close()
    await browser.close()
    return finalData;
}

// var LastCookies = [];
async function getProductMetadata(url) {
    
    const args = [
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--lang=en-US,en"
    ];

    const browser = await puppeteer.launch({
        // headless: 'new',
        headless: true,
        devtools: false, // disable dev tools
        ignoreHTTPSErrors: true, // ignore https error
        executablePath: CHROME_EXECUTABLE_PATH,
        userDataDir: CHROME_USER_DATA_DIR,
        args,
        ignoreDefaultArgs: ["--disable-extensions"],
    });

    const page = await browser.newPage();
    try {
        console.log("GetProductMetadata - " + url);
        puppeteer.use(StealthPlugin());

        await page.setViewport({ width: 1280, height: 720 });

        await page.setExtraHTTPHeaders({
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'upgrade-insecure-requests': '1',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9,en;q=0.8'
        });
        // await page.setViewport({ width: 1920, height: 1080 });

        var finalData = [];

        try {
            await loadCookiesFromFile(page, 'interCookies.json')

            // var response = await page.goto('https://loja-online.intermarche.pt' + url, {
            //     timeout: 50000,
            //     waitUntil: 'networkidle0',
            // });

            console.log('https://loja-online.intermarche.pt' + url);
             var response = await page.goto('https://loja-online.intermarche.pt' + url, {'timeout': 10000, 'waitUntil':'load'});
            await waitTillHTMLRendered(page)
            const datad = await page.content()

            
            fs.writeFile('intermarche_html.html', datad, err => {
            if (err) {
                console.error(err);
            } else {
                console.log("File written successfully");
            }
            });
            await page.close()
            await browser.close()
            return datad;

            // await page.waitForNavigation()
            await delay(2000);

            const _url = await page.url();
            console.log(_url);

            //failed to restart from cookie
            if (_url === 'https://loja-online.intermarche.pt/') {
            await delay(2000);

                var _acceptCookiesButtton = await page.$('#didomi-notice-agree-button')
                await page.evaluate(e => e.click(), _acceptCookiesButtton);

                await delay(2000);
                console.log("Inputing postal code 2820-620");
                await page.type('#storeLocator__inputSearchId', '2820-620', { delay: 2100 });
                await delay(2000);

                console.log("CLicking first result");
                var _firstResult = await page.$('#storeLocator__suggestionsId');
                var _divToCLick = await _firstResult.$('div');
                await page.evaluate(e => e.click(), _divToCLick);
                await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 })
                await delay(5000);
                console.log('Navigating to https://loja-online.intermarche.pt' + url);
                var response2 = await page.goto('https://loja-online.intermarche.pt' + url, {
                    timeout: 25000,
                    waitUntil: 'networkidle2',
                });
                console.log('saveCookiesToFile interCookies.json');
                await saveCookiesToFile(page, 'interCookies.json');
            }

            try {
                console.log('awaiting for .productDetail - timout 10000');
                await page.waitForSelector('.productDetail', { visible: true, timeout: 10000 })
            } catch (error) {
                // await page.close()
                // await browser.close()
                console.log("ERROR", error);
                console.log("Deleting interCookies.json")
                // await deleteFile('interCookies.json');
                return "";
            }

            //IMPORTANT: get html source in various ways
            const _dataJSd = await (await page.$(".productDetail")).evaluate((content => content.outerHTML));
            // const html = await page.content();
            // const data3 = await page.evaluate(() => document.querySelector('*').outerHTML);
            // const _dataJS = await (await page.$("html")).evaluate((content => content.innerHTML));
            // const data = await page.content();
            // let bodyHTML = await page.evaluate(() => document.body.innerHTML);
            // // list_produits_serveur
            // var responseText = await response.text();
            finalData = _dataJSd;

            finalData = await page.evaluate(() => {
                const walk = doc => {
                    doc.querySelectorAll("*").forEach(e => {
                        if (e.shadowRoot) {
                            e.innerHTML = walk(e.shadowRoot);
                        }
                    });
                    return doc.innerHTML;
                };
                return walk(document.body);
            });
            // console.log(finalData);
            saveToFile(finalData, 'outHtml.html');
            // console.log(finalData);
        } catch (error) {
            console.log("ERROR", error);
            console.log("Deleting interCookies.json")
            // await deleteFile('interCookies.json');
        }

        // await page.close()
        // await browser.close()
        return finalData;
    } catch (error) {
        // await page.close()
        // await browser.close()
        return null;
    }

}
async function getSearchResults(search) {
    
    const args = [
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--lang=en-US,en"
    ];

    const browser = await puppeteer.launch({
        // headless: 'new',
        headless: true,
        devtools: false, // disable dev tools
        ignoreHTTPSErrors: true, // ignore https error
        executablePath: CHROME_EXECUTABLE_PATH,
        userDataDir: CHROME_USER_DATA_DIR,
        args,
        ignoreDefaultArgs: ["--disable-extensions"],
    });

    const page = await browser.newPage();
    try {
        console.log("getSearchResults - " + search);
        puppeteer.use(StealthPlugin());

        await page.setViewport({ width: 1280, height: 720 });

        await page.setExtraHTTPHeaders({
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'upgrade-insecure-requests': '1',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9,en;q=0.8'
        });
        // await page.setViewport({ width: 1920, height: 1080 });

        var finalData = [];

        try {
            // await loadCookiesFromFile(page, 'interCookies.json')

            // var response = await page.goto('https://loja-online.intermarche.pt' + url, {
            //     timeout: 50000,
            //     waitUntil: 'networkidle0',
            // });

            console.log('https://www.intermarche.pt/search/' + encodeURIComponent(search));
             var response = await page.goto('https://www.intermarche.pt/search/' + encodeURIComponent(search), {'timeout': 50000, 'waitUntil':'networkidle2'});
            await waitTillHTMLRendered(page)
            const datad = await page.content()

            
            fs.writeFile('intermarche_search.html', datad, err => {
            if (err) {
                console.error(err);
            } else {
                console.log("File written successfully");
            }
            });
            await page.close()
            await browser.close()
            return datad;

            // await page.waitForNavigation()
            await delay(2000);

            const _url = await page.url();
            console.log(_url);

            //failed to restart from cookie
            if (_url === 'https://loja-online.intermarche.pt/') {
            await delay(2000);

                var _acceptCookiesButtton = await page.$('#didomi-notice-agree-button')
                await page.evaluate(e => e.click(), _acceptCookiesButtton);

                await delay(2000);
                console.log("Inputing postal code 2820-620");
                await page.type('#storeLocator__inputSearchId', '2820-620', { delay: 2100 });
                await delay(2000);

                console.log("CLicking first result");
                var _firstResult = await page.$('#storeLocator__suggestionsId');
                var _divToCLick = await _firstResult.$('div');
                await page.evaluate(e => e.click(), _divToCLick);
                await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 })
                await delay(5000);
                console.log('Navigating to https://loja-online.intermarche.pt' + url);
                var response2 = await page.goto('https://loja-online.intermarche.pt' + url, {
                    timeout: 25000,
                    waitUntil: 'networkidle2',
                });
                console.log('saveCookiesToFile interCookies.json');
                await saveCookiesToFile(page, 'interCookies.json');
            }

            try {
                console.log('awaiting for .productDetail - timout 10000');
                await page.waitForSelector('.productDetail', { visible: true, timeout: 10000 })
            } catch (error) {
                // await page.close()
                // await browser.close()
                console.log("ERROR", error);
                console.log("Deleting interCookies.json")
                // await deleteFile('interCookies.json');
                return "";
            }

            //IMPORTANT: get html source in various ways
            const _dataJSd = await (await page.$(".productDetail")).evaluate((content => content.outerHTML));
            // const html = await page.content();
            // const data3 = await page.evaluate(() => document.querySelector('*').outerHTML);
            // const _dataJS = await (await page.$("html")).evaluate((content => content.innerHTML));
            // const data = await page.content();
            // let bodyHTML = await page.evaluate(() => document.body.innerHTML);
            // // list_produits_serveur
            // var responseText = await response.text();
            finalData = _dataJSd;

            finalData = await page.evaluate(() => {
                const walk = doc => {
                    doc.querySelectorAll("*").forEach(e => {
                        if (e.shadowRoot) {
                            e.innerHTML = walk(e.shadowRoot);
                        }
                    });
                    return doc.innerHTML;
                };
                return walk(document.body);
            });
            // console.log(finalData);
            saveToFile(finalData, 'outHtml.html');
            // console.log(finalData);
        } catch (error) {
            console.log("ERROR", error);
            console.log("Deleting interCookies.json")
            // await deleteFile('interCookies.json');
        }

        // await page.close()
        // await browser.close()
        return finalData;
    } catch (error) {
        // await page.close()
        // await browser.close()
        return null;
    }

}

const waitTillHTMLRendered = async (page, timeout = 30000) => {
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 3;

  while(checkCounts++ <= maxChecks){
    let html = await page.content();
    let currentHTMLSize = html.length; 

    let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

    console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, " body html size: ", bodyHTMLSize);

    if(lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize) 
      countStableSizeIterations++;
    else 
      countStableSizeIterations = 0; //reset the counter

    if(countStableSizeIterations >= minStableSizeIterations) {
      console.log("Page rendered fully..");
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await page.waitForTimeout(checkDurationMsecs);
  }  
};

async function scrollToBottom() {
    // await new Promise(resolve => {
    //     // const distance = 100; // should be less than or equal to window.innerHeight
    //     const distance = 75; // should be less than or equal to window.innerHeight
    //     const delay = 100;
    //     const timer = setInterval(() => {
    //         document.scrollingElement.scrollBy(0, distance);
    //         console.log(document.scrollingElement.scrollTop + window.innerHeight);
    //         console.log(document.scrollingElement.scrollHeight);
    //         if (document.scrollingElement.scrollTop + window.innerHeight >= document.scrollingElement.scrollHeight) {
    //             clearInterval(timer);
    //             resolve();
    //         }
    //     }, delay);
    // });
    const distance = 100;
    const delay = 100;
    while (document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight) {
        document.scrollingElement.scrollBy(0, distance);
        await new Promise(resolve => { setTimeout(resolve, delay); });
    }
}


async function addNewProducts(onlineProductIds) {
    for (let index = 0; index < onlineProductIds.length; index++) {
        const onlineProductId = onlineProductIds[index];
        try {
            var _newProduct = {
                "UserId": "9ff8224f-17cf-49fb-b555-05779a13eb40",
                "FirstAddedProductFromStoreId": 4,
                "Barcode": "",
                // "Lists":["shoppingList"],
                "SelectedResults": [
                    {
                        "StoreId": 4,
                        "OnlineProductId": onlineProductId
                    }
                ]
            };
            // console.log(_newProduct);
            console.log("https://lisie.app/api/Online/GetMarketProductByOnlineId?onlineProductId=" + onlineProductId + "&storeId=4")
            // var response = await fetch('http://localhost:4430/api/Products/PostV2?userId=9ff8224f-17cf-49fb-b555-05779a13eb40', {
            var response = await fetch('https://lisie.app/api/Products/PostV2?userId=9ff8224f-17cf-49fb-b555-05779a13eb40', {
                method: 'POST',
                body: JSON.stringify(_newProduct),
                headers: { 'Content-Type': 'application/json' }
            });
            var _responseText = await response.text();
            console.log("added", _responseText);


            await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
            console.log(error);
        }
    }
}
exports.addUserList = async function (userId, data, io, SocketUsers) {
    await addUserListToJumbo(userId, data, io, SocketUsers)
};

exports.getAllCategories = async function () {
    return await getAllCategories()
};

exports.getNewProducts = async function (page, url) {
    return await getNewProducts(page, url)
};

exports.addNewProducts = async function (onlineProductIds) {
    return await addNewProducts(onlineProductIds)
};

exports.getProductMetadata = async function (url, page) {
    return await getProductMetadata(url, page)
};

exports.getSearchResults = async function (search, page) {
    return await getSearchResults(search, page)
};