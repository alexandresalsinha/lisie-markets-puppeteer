// var io = require('socket.io')(server);
// const puppeteer = require('puppeteer');
var request = require('request');
// var scrollPageToBottom = require('puppeteer-autoscroll-down');
var fetch = require('node-fetch');
// var server = require('http').Server(app);
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const { PendingXHR } = require('pending-xhr-puppeteer');

var ioG;
var SocketUsersG;
var userIdG;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const BrowserArgs = [
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-accelerated-2d-canvas",
    "--disable-gpu",
    "--lang=en-US,en"
];
async function login(username, password, browser, page) {
    console.log("Authenticating continente")
    var _loggedIn = false;
    var _message = "";
    var _errorCode = 0;

    puppeteer.use(StealthPlugin());

    // const browser = await puppeteer.launch({ headless: false });
    // const browser = await puppeteer.launch({
    //     args: ['--no-sandbox',I. I. I. 
    //         '--disable-setuid-sandbox',
    //         '--disable-gpu']
    // });
    if (browser == undefined) {
        browser = await puppeteer.launch({
            // headless: 'new',
            headless: 'false',
            devtools: false, // disable dev tools
            ignoreHTTPSErrors: true, // ignore https error
            BrowserArgs,
            ignoreDefaultArgs: ["--disable-extensions"],
        });
    }
    // const browser = await puppeteer.launch({
    //     headless: 'new',
    //     args: ['--no-sandbox',
    //         '--disable-setuid-sandbox',
    //         '--disable-gpu']
    // });

    if (page == undefined) {
        page = await browser.newPage()
    }
    // const page = await browser.newPage()
    // const pendingXHR = new PendingXHR(page);
    try {
        await page.goto("https://www.continente.pt/login", {
            waitUntil: 'networkidle0',
        });

        var _cookiesAccept = await page.$('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll')
        await page.evaluate(e => e.click(), _cookiesAccept);

        await page.waitForTimeout(2000)

        const iframe = await page.waitForSelector('#maincontent > div > div > div.ct-login--form-wrapper.ct-login--form-wrapper-credentials.pwc-border--radius > div > iframe')
        await page.waitForTimeout(2000)
        
        const frame = await iframe.contentFrame()
        await frame.type('#userNameCC', username)
        await page.waitForTimeout(2000)
        await frame.click('#RegistrationUser > div.h-full.w-full.flex.flex-col.gap-4.justify-center.items-center > button')
        console.log('typing username: ' + username);
        await page.waitForTimeout(1000)
        await frame.type('#password_input', password)
         await page.waitForTimeout(2000)
        console.log('typing password: ' + password);
        await frame.click('#validate_password_form_email-login > div.h-full.w-full.flex.flex-col.gap-4.justify-center.items-center > button')

        await delay(2000);
        console.log("page url" + page.url());
        var _loginFirstStepSucess = true;
        try {
            var _errorLogin = await frame.$('.errorDiv', { visible: true });
            if (_errorLogin != null) {
                _loginFirstStepSucess = false;
                console.log('Password incorreta foi mostrada');
                _loggedIn = false;
                _errorCode = -4;
                _message = "'Password incorreta foi mostrada";

                if (page === undefined && browser === undefined) {
                    await page.close()
                    await browser.close()
                }
                // await page.close()
                // await browser.close()

                return { Success: _loggedIn, ErrorCode: _errorCode, message: _message };
            }
        } catch (error) {
            console.log('No error message for incorrect password', error);
        }

        try {
            console.log("page url" + page.url());

            // if (page.url() !== 'https://www.continente.pt/') {
            //     console.log("in main page, probably loggedIn");
            // }
            console.log('waiting for network to idle (30s timeout)');
            //IMPORTANT NOTES for wait for network
            // await page.waitForNetworkIdle({ waitUntil: 'domcontentloaded', timeout: 30000 });
            // await page.waitForNetworkIdle({ waitUntil: 'load', timeout: 30000 });
            // await page.waitForNetworkIdle();
            // await page.waitForNavigation({ waitUntil: 'networkidle2', timeout : 30000 })
            await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 })
            // await pendingXHR.waitForAllXhrFinished();
        } catch (error) {
            // console.log("page url" + page.url());
        }

        try {

            console.log("page url" + page.url());
            // var _errorLabel = await frame.$('#SetUserPassword-child(2) > div > div.container-input.margin-bottom-12 > div.d-inline-flex.errorDiv > span.errorLabel', { visible: true });
            // var _usernameLoggedInFound = await page.$('#brand-header > nav > div > div.header-wrapper.container-fluid.container-margin.d-flex.align-items-center.justify-content-between > div.user-util.d-flex.align-items-center > div.user-login.user-unauthenticated > div.user.nav-item.d-block.d-md-none > a');
            console.log('trying to find authentication div');
            // var _usernameLoggedInFound = await page.$('div.user-login.user-authenticated');
            // console.log("_usernameLoggedInFound" + _usernameLoggedInFound);
            var _usernameLoggedInFound = page.url() === 'https://www.continente.pt/';
            console.log("_usernameLoggedInFound" + _usernameLoggedInFound);
            // var _usernameLoggedInFound = await page.$('#brand-header > nav > div > div.header-wrapper.container-fluid.container-margin.d-flex.align-items-center.justify-content-between > div.user-util.d-flex.align-items-center > div.user-login.user-unauthenticated > a', { visible: true });
            if (_usernameLoggedInFound !== null) {
                console.log('Login success');
                console.log('');
                _loggedIn = true;
                _errorCode = 1;
                _message = "Login efetuado com sucesso";
            } else {
                console.log('Login rejeitado');
                _loggedIn = false;
                _errorCode = -1;
                _message = "Login rejeitado";
            }
        } catch (error) {
            console.log('Login error' + error);
            _loggedIn = false;
            _errorCode = -2;
            _message = "Login failed:" + error;
        }
        if (page === undefined && browser === undefined) {
            await page.close()
            await browser.close()
        }
        // await page.close()
        // await browser.close()

        return { Success: _loggedIn, ErrorCode: _errorCode, message: _message };

    } catch (error) {
        console.log('Login failed (global):' + error);
        _loggedIn = false;
        _errorCode = -3;
        _message = "Login failed (global):" + error;

        if (page === undefined && browser === undefined) {
            await page.close()
            await browser.close()
        }
        // await page.close()
        // await browser.close()

        return { Success: _loggedIn, ErrorCode: _errorCode, message: _message };
    }
}

async function addUserList(userId, data, io, SocketUsers) {
    ioG = io;
    SocketUsersG = SocketUsers;
    userIdG = userId;
    var productsNotAdded = [];
    // (async () => {
    var startDate = new Date();
    const browser = await puppeteer.launch({ headless: false });
    // const browser = await puppeteer.launch({
    //     headless: 'false',
    //     // headless: 'new',
    //     devtools: false, // disable dev tools
    //     ignoreHTTPSErrors: true, // ignore https error
    //     BrowserArgs,
    //     ignoreDefaultArgs: ["--disable-extensions"],
    // });

    const page = await browser.newPage()
    // await page.goto("https://www.continente.pt/login", {
    //     waitUntil: 'networkidle0',
    // });

    // var _cookiesAccept = await page.$('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll')
    // await page.evaluate(e => e.click(), _cookiesAccept);

    // await page.waitForTimeout(2000)

    // const iframe = await page.waitForSelector('#maincontent > div > div > div.ct-login--form-wrapper.ct-login--form-wrapper-credentials.pwc-border--radius > div > iframe')
    // const frame = await iframe.contentFrame()
    // await frame.type('#userNameCC', "alexandresalsinha@gmail.com")
    // // await frame.type('input[name="password"]', '123')
    // // await frame.click('.mt-4 buttons-primary-normal')
    // await frame.click('#RegistrationUser > div:nth-child(4) > button > div')
    // await page.waitForTimeout(1000)
    // await frame.type('#emailPasswordValidCC', '1234qwrefdsa')
    // await frame.click('#SetUserPassword > div:nth-child(4) > button > div')
    // await page.waitForNavigation({ waitUntil: 'networkidle2' })

    //  try {
    //     // var _errorLabel = await frame.$('#SetUserPassword-child(2) > div > div.container-input.margin-bottom-12 > div.d-inline-flex.errorDiv > span.errorLabel', { visible: true });



    //     var _usernameLoggedInFound = await page.$('#SetUserPassword > div:nth-child(2) > div > div.container-input.margin-bottom-12 > div.d-inline-flex.errorDiv > span.errorLabel', { visible: true });

    //     // var _usernameLoggedInFound = await page.$('#brand-header > nav > div > div.header-wrapper.container-fluid.container-margin.d-flex.align-items-center.justify-content-between > div.user-util.d-flex.align-items-center > div.user-login.user-unauthenticated > a', { visible: true });
    //     if (_usernameLoggedInFound !== null) {
    //         console.log('Login success');
    //         _loggedIn = true;
    //         _errorCode = 0;
    //         _message = "Login efetuado com sucesso";
    //     } else {
    //         console.log('Login rejeitado');
    //         _loggedIn = false;
    //         _errorCode = -1;
    //         _message = "Login rejeitado";
    //     }
    // } catch (error) {
    //     console.log('Login error');
    //     _loggedIn = false;
    //     _errorCode = -2;
    //     _message = "Login failed:" + error;
    // }

    var _emptyShoppingCartResult = await login(data.username, data.password, browser, page);
    if (!_emptyShoppingCartResult.Success) {
        await page.close()
        await browser.close()
        return null;
    }

    message = { "message": "A apagar a lista de compras...", "sucess": "true" };
    var _emptyShoppingCartResult = await emptyShoppingCart(browser, page);
    if (!_emptyShoppingCartResult.Success) {
        await page.close()
        await browser.close()
        return null;
    }

    message = { "message": "A adicionar produtos ao Continente...", "sucess": "true" };
    // SendUpdateToUser(userId, message);

    var _productsAddedWithSucess = 0;
    for (let index = 0; index < data.products.length; index++) {
        const product = data.products[index];
        console.log('adding product: ', product.Name);

        try {
            var response = await page.goto('https://www.continente.pt/' + product.OnlineProductId + '.html', {
                timeout: 25000,
                waitUntil: 'domcontentloaded',
            });

            if (response.url() === 'https://www.continente.pt/') {
                productsNotAdded.push(product);
                console.log("Produto " + product.Name + " não adicionado");
                // console.log("Product not added", product);
                continue;
            }
            // var responseText = await response.text();
            const scriptHandleSetVar = await page.addScriptTag({ content: 'var lproductquantity = ' + product.Quantity + ';' });

            //Set quantity
            var _quantityStr = 'div.ct-tile-quantity-update.quantity-update.product-qty-vue > div > input';
            try { //first try to get quantity input
                //get quantity there
                await page.focus(_quantityStr);
                const inputValue = await page.$eval(_quantityStr, el => el.value);
                if (inputValue == '') {
                    // console.log("Error getting quantity element");
                    throw Error
                }
                // var _quantityValue2 = await page.evaluate(e => e.value.trim(), _quantityEl);
                if (product.Quantity != parseInt(inputValue)) {
                    // await page.focus(_quantityStr);
                    for (let i = 0; i < inputValue.length; i++) {
                        await page.keyboard.press('Backspace');
                    }
                    await page.type(_quantityStr, String(product.Quantity));
                    await page.keyboard.press('Enter');
                    await delay(2000);
                    // await page.click('.btn-increment');
                }
            } catch (error) { //quantity ele , find add button 
                try {
                    // var _addButton = await page.waitForSelector('.auc-js-add-to-cart', { visible: true, timeout: 2500 });
                    await page.click('.add-to-cart');
                    // await delay(2000)
                    await delay(3000)
                    if (product.Quantity > 1) {
                        await page.focus(_quantityStr);
                        // await page.waitForSelector(_eleStr, { visible: true, timeout: 2500 });
                        const inputValue = await page.$eval(_quantityStr, el => el.value);
                        if (product.Quantity != parseInt(inputValue)) {
                            // await page.focus(_eleStr);
                            for (let i = 0; i < inputValue.length; i++) {
                                await page.keyboard.press('Backspace');
                            }
                            await page.type(_quantityStr, String(product.Quantity))
                            await page.keyboard.press('Enter');
                            await delay(2000);
                        }
                    }
                } catch (error) { //quantity element not found
                    productsNotAdded.push(product);
                    console.log("Produto " + product.Name + " não adicionado");
                    let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
                    // SendUpdateToUser(userId, message, io, SocketUsers);
                    SendUpdateToUserG(message);
                    continue;
                }
            }

            // var _addToCartButton = await page.$('.add-to-cart');
            // await page.evaluate(e => e.click(), _addToCartButton);
            // await delay(1000);
            // _productsAddedWithSucess++;

            let message = { "message": _productsAddedWithSucess + " de " + data.products.length + " produtos adicionados ao Continente Online", "sucess": "true" };
            SendUpdateToUser(userId, message);
        } catch (error) {
            console.log('getting product url error', error);
            let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
            SendUpdateToUser(userId, message)
        }
        await delay(500);
    }
    var endDate = new Date();
    var seconds = (endDate.getTime() - startDate.getTime()) / 1000;

    await page.close()
    await browser.close()

    message = { "message": "Processo de adicionar produtos finalizado", "sucess": "true" };
    SendUpdateToUser(userId, message);

    // console.log(productsNotAdded);
    // request
    //     .get('http://lisie.app/puppetter/NotifyProductsAddedStore?userId=' + userId + '&store=Continente&timespanseconds=' + seconds)
    //     .on('response', function (response) {
    //         console.log(response.statusCode)
    //     })
    //     .on('error', function (e) {
    //         console.log(e);
    //         console.log('Error calling lisie.app/puppetter/NotifyProductsAddedToJumboOnline');
    //     });

    return productsNotAdded;
}

function SendUpdateToUser(userName, message, io, SocketUsers) {
    try {
        var userSessionId = SocketUsers.get(userName);
        if (userSessionId != undefined && userSessionId != null) {
            try {
                io.sockets.sockets[userSessionId].emit('message', message);
            } catch (error) {
                console.log(' error sending update to user ');
            }
        }
        return;
    } catch (error) {
        return;
    }

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
                    await delay(2000);
                    return true;
                }
            } catch (error) {
                console.log("### Não necessita de re-confirmar email ###");
            }
        } catch (error) {
            await page.screenshot({ path: './lastScreenshot.png' });
            await delay(500);
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
                productsNotAdded.push(product.ProductId);
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
                    await delay(2000)
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
                    productsNotAdded.push(product.ProductId);
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
            await delay(500);
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
        headless: 'new',
        devtools: false, // disable dev tools
        ignoreHTTPSErrors: true, // ignore https error
        BrowserArgs,
        ignoreDefaultArgs: ["--disable-extensions"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    var finalData = [];
    try {
        var response = await page.goto('https://www.continente.pt', {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });

        // await page.click('.accept-policy.auc-button__rounded--primary');

        const _allCategories = await page.$$("[class='dropdown-item']"); //first level

        var counter = 1;
        for (let i = 0; i < _allCategories.length; i++) {
            //IMPORTANT - QUERY CHILDREN WTH "JQUERY"
            const link = await _allCategories[i].$eval('a', a => a.getAttribute('href'));
            // console.log(link);
            finalData.push(link);
        }
        // return finalData;

    } catch (error) {
        console.log(error);
    }

    await page.close()
    await browser.close()
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
//             await delay(3000);

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
        headless: 'new',
        devtools: false, // disable dev tools
        ignoreHTTPSErrors: true, // ignore https error
        BrowserArgs,
        ignoreDefaultArgs: ["--disable-extensions"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    var finalData = [];

    try {
        var response = await page.goto(url, {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });

        // const lastPosition = await scrollPageToBottom(page, 250, 500)
        // await page.evaluate(scrollToBottom);
        // await delay(3000);

        const _allProducts = await page.$$('.product'); //first level
        var counter = 1;
        for (const _product of _allProducts) {
            const _product_a = await _product.$('a');
            const _product_a_href = await page.evaluate(anchor => anchor.getAttribute('href'), _product_a);
            var _productId = _product_a_href.replace('.html', '');
            _productId = _productId.substring(_productId.lastIndexOf('-') + 1);
            // console.log(_productId);
            finalData.push(_productId);
        }

    } catch (error) {
        console.log(error);
    }

    await page.close()
    await browser.close()
    return finalData;
}

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
                "FirstAddedProductFromStoreId": 2,
                "Barcode": "",
                // "Lists":["shoppingList"],
                "SelectedResults": [
                    {
                        "StoreId": 2,
                        "OnlineProductId": onlineProductId
                    }
                ]
            };
            console.log(_newProduct);
            console.log("https://www.continente.pt/produto/produto/" + onlineProductId + ".html")
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

async function emptyShoppingCart(browser, page) {
    console.log("emptyShoppingCart continente")
    var _loggedIn = false;
    var _message = "";
    var _errorCode = 0;

    puppeteer.use(StealthPlugin());

    if (browser == undefined) {
        browser = await puppeteer.launch({
            headless: 'new',
            devtools: false, // disable dev tools
            ignoreHTTPSErrors: true, // ignore https error
            BrowserArgs,
            ignoreDefaultArgs: ["--disable-extensions"],
        });

    }
    if (page == undefined) {
        page = await browser.newPage()
    }

    try {
        await page.goto("https://www.continente.pt/", {
            waitUntil: 'networkidle0',
        });

        var _deleteAll = await page.$('#confirm-clean-cart-modal > div > div > div.modal-body.confirm-clean-cart-actions > div > div:nth-child(2) > button.button.button--primary.confirm-confirm-clean-cart-select')
        await page.evaluate(e => e.click(), _deleteAll);

        // await page.click('#confirm-clean-cart-modal > div > div > div.modal-body.confirm-clean-cart-actions > div > div:nth-child(2) > button.button.button--primary.confirm-confirm-clean-cart-select')
        await delay(5000);
        if (page === undefined && browser === undefined) {
            await page.close()
            await browser.close()
        }
        return { Success: true, ErrorCode: 0, message: "Shopping cart empty sucessful" };
    } catch (error) {
        return { Success: false, ErrorCode: -1, message: error };
    }
}
exports.addUserList = async function (userId, data, io, SocketUsers) {
    return await addUserList(userId, data, io, SocketUsers)
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

exports.login = async function (username, password) {
    return await login(username, password)
};

exports.emptyShoppingCart = async function (browser, page) {
    return await emptyShoppingCart(browser, page)
};