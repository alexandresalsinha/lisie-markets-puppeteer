// var io = require('socket.io')(server);
const puppeteer = require('puppeteer');
var request = require('request');
// var scrollPageToBottom = require('puppeteer-autoscroll-down');
var fetch = require('node-fetch');
// var server = require('http').Server(app);

var ioG;
var SocketUsersG;
var userIdG;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Timestamped logging helpers. `ts()` returns local ISO-ish timestamp; `log`/`warn`/`error` prefix each call.
const ts = () => {
    const d = new Date();
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};
const log = (...args) => console.log(`[${ts()}] [auchan]`, ...args);
const logWarn = (...args) => console.warn(`[${ts()}] [auchan] [WARN]`, ...args);
const logError = (...args) => console.error(`[${ts()}] [auchan] [ERROR]`, ...args);

async function login(username, password) {
    const loginStart = Date.now();
    log(`login() called for username="${username}"`);
    // const browser = await puppeteer.launch({ headless: false });
    log('Launching puppeteer browser (headless)...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu']
    });
    log('Browser launched. Opening new page...');
    const page = await browser.newPage();
    // page.on('console', msg => console.log(msg));

    log('### Starting login flow ###');
    await page.setViewport({ width: 1920, height: 1080 });
    log('Viewport set to 1920x1080');
    // const navigationPromise = page.waitForNavigation()
    try {
        log('Navigating to https://www.auchan.pt ...');
        var response = await page.goto('https://www.auchan.pt', {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });
        log(`Home page loaded. status=${response && response.status && response.status()}`);

        log('Clicking cookie accept button (#onetrust-accept-btn-handler)...');
        await page.click('#onetrust-accept-btn-handler');
        log('Waiting 2000ms after cookie accept...');
        await delay(2000);
        log('Navigating to Login-OAuthLogin endpoint...');
        var responseLogin = await page.goto('https://www.auchan.pt/on/demandware.store/Sites-AuchanPT-Site/pt_PT/Login-OAuthLogin?oauthProvider=Salesforce&oauthLoginTargetEndPoint=0', {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });
        log(`Login page loaded. status=${responseLogin && responseLogin.status && responseLogin.status()}`);
        log('Waiting for password field to become visible...');
        await page.waitForSelector('[type="password"]', { visible: true, timeout: 5000 });
        log('Password field visible. Typing username...');
        await page.type('#uname1', username);
        log('Typing password...');
        await page.type('[type="password"]', password);
        log('Credentials typed.');
    } catch (error) {
        logError('### Erro a aceder ao auchan ###', error && error.message);
        await page.close();
        await browser.close();
        log(`login() aborted (access error). elapsed=${Date.now() - loginStart}ms`);
        return { Success: false, ErrorCode: -1, message: "Erro a aceder ao auchan" };
    }
    log('### Authenticating ###');

    log('Locating submit button #btnSubmit_login...');
    var anchorLogin = await page.$('#btnSubmit_login');
    log('Clicking submit button...');
    await page.evaluate(e => e.click(), anchorLogin);

    try {
        log('Waiting 5000ms for post-submit state...');
        await delay(5000);

        //See if login was sucessful
        try {
            log('Checking if password field still present (indicates failed login)...');
            var anchorLogin = await page.$('[type="password"]');
            if (anchorLogin) {
                log('Password field still visible - login likely failed. Checking for email re-confirmation popup...');
                try {
                    var emailReconfirmationPopup = await page.waitForSelector('#popUpAge', { visible: true, timeout: 2500 });
                    if (emailReconfirmationPopup) {
                        logWarn('### Necessita de re-confirmar email ###');
                        await page.close();
                        await browser.close();
                        log(`login() finished (needs email reconfirmation). elapsed=${Date.now() - loginStart}ms`);
                        return { Success: false, ErrorCode: -2, message: "Necessitade re-confirmar o seu email no auchan online" };
                    }
                } catch (error) {
                    log('### Não necessita de re-confirmar email ###');
                }

                //check if login was sucessful
                logWarn('### Login do auchan online inválido ###');
                await page.close();
                await browser.close();
                log(`login() finished (invalid credentials). elapsed=${Date.now() - loginStart}ms`);
                return { Success: false, ErrorCode: -3, message: "Login do auchan online inválido" };
            }
        } catch (error) {
            log('### Login feito com sucesso ###');
            await page.close();
            await browser.close();
            log(`login() finished OK. elapsed=${Date.now() - loginStart}ms`);
            return { Success: true, ErrorCode: 0, Message: "Login feito com sucesso" };
        }

    } catch (error) {
        logError('### Erro a autenticar ao Auchan ###', error && error.message);
        var jsonDataObj = {
            UserId: userId,
            Sucess: false,
            AuthenticationSucess: false
        };
        // request.post({
        //     url: 'https://lisie.app/puppetter/NotifyProductsAddedToJumboOnline',
        //     //url: 'http://6c2c4bfa.ngrok.io/puppetter/NotifyProductsAddedToJumboOnline',
        //     body: jsonDataObj,
        //     json: true
        // }, function (error, response, body) {
        //     console.log(body);
        // });
        await page.close();
        await browser.close();
        log(`login() finished (auth error). elapsed=${Date.now() - loginStart}ms`);
        return { Success: false, ErrorCode: -4, message: "Erro a autenticar ao Auchan" };
    }
    await page.close();
    await browser.close();
    log(`login() finished (fallthrough). elapsed=${Date.now() - loginStart}ms`);
    return { Success: true, ErrorCode: 1, message: "Reached end of function" };
}

async function addUserList(userId, data, io, SocketUsers) {
    ioG = io;
    SocketUsersG = SocketUsers;
    userIdG = userId;
    var startDate = new Date();
    log(`addUserList() called. userId=${userId} username=${data && data.username} productCount=${data && data.products && data.products.length}`);
    // const browser = await puppeteer.launch({ headless: false });
    // const browser = await puppeteer.launch({
    //     headless: 'new',
    //     args: ['--no-sandbox',
    //         '--disable-setuid-sandbox',
    //         '--disable-gpu']
    // });

    const args = [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--lang=en-US,en"
    ];

    log('Launching puppeteer browser (headed)...');
    const browser = await puppeteer.launch({
        headless: false,
        devtools: false, // disable dev tools
        ignoreHTTPSErrors: true, // ignore https error
        // args,
        ignoreDefaultArgs: ["--disable-extensions"],
    });
    log('Browser launched. Opening new page...');

    const page = await browser.newPage();
    // page.on('console', msg => console.log(msg));

    log("### Starting addUserListToJumbo ###");
    // await page.setViewport({ width: 1920, height: 1080 })

    // const navigationPromise = page.waitForNavigation()
    try {
        log('Navigating to https://www.auchan.pt ...');
        var response = await page.goto('https://www.auchan.pt', {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });
        log(`Home page loaded. status=${response && response.status && response.status()}`);

        log('Clicking cookie accept button (#onetrust-accept-btn-handler)...');
        await page.click('#onetrust-accept-btn-handler');
        // await page.waitFor(2000);
        log('Navigating to Login-OAuthLogin endpoint...');
        var responseLogin = await page.goto('https://www.auchan.pt/on/demandware.store/Sites-AuchanPT-Site/pt_PT/Login-OAuthLogin?oauthProvider=Salesforce&oauthLoginTargetEndPoint=0', {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });
        log(`Login page loaded. status=${responseLogin && responseLogin.status && responseLogin.status()}`);

        log('Waiting 1000ms before typing credentials...');
        await delay(1000);

        await page.type('#uname1', data.username);
        log('typing username: ' + data.username);
        await page.type('[type="password"]', data.password);
        log('typing password: ' + (data.password ? '(hidden, len=' + data.password.length + ')' : '(empty)'));

    } catch (error) {
        logError("### Erro a aceder ao auchan ###", error && error.message);
        let message = { "message": "Erro a aceder ao auchan", "sucess": "false" };
        // SendUpdateToUser(userId, message, io, SocketUsers);
        return;
    }
    log("### Authenticating ###");
    let message = { "message": "A autenticar ao Auchan...", "sucess": "true" };
    SendUpdateToUser(userId, message, io, SocketUsers);

    //var toremove = "";
    log('Locating submit button #btnSubmit_login...');
    var anchorLogin = await page.$('#btnSubmit_login');
    log('Clicking submit button and waiting for navigation...');
    await page.evaluate(e => e.click(), anchorLogin);
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    log('First post-submit navigation complete.');

    try {
        log('Waiting for a second navigation to settle...');
        await page.waitForNavigation();
        log('Second navigation complete. Verifying login state...');
        //See if login was sucessful
        try {
            var anchorLogin = await page.$('[type="password"]');
            // var anchorLogin = await page.$('#jumbo-login > form.jumbo-form.login-form > div.jumbo-submit.jumbo-button.jumbo-button-flex.login-form')
            if (anchorLogin) {
                log('Password field still present after login. Checking re-confirmation popup...');
                try {
                    var emailReconfirmationPopup = await page.waitForSelector('#popUpAge', { visible: true, timeout: 2500 });
                    // var emailReconfirmationPopup = await page.waitForSelector('#popUpAge', { visible: true, timeout: 5000 });
                    if (emailReconfirmationPopup) {
                        logWarn("### Necessita de re-confirmar email ###");
                        let message = { "message": "Necessitade re-confirmar o seu email no auchan online", "sucess": "true" };
                        SendUpdateToUser(userId, message, io, SocketUsers);
                        await page.close();
                        await browser.close();
                        return;
                    }
                } catch (error) {
                    // console.log("### Não necessita de re-confirmar email ###");
                }

                //check if login was sucessful
                logWarn("### Login do auchan online inválido ###");
                let message = { "message": "Login do auchan online inválido", "sucess": "true" };
                SendUpdateToUser(userId, message, io, SocketUsers);
                await page.close();
                await browser.close();
                return;
            }
        } catch (error) {
            log("### Login feito com sucesso ###");
        }

    } catch (error) {
        logError("### Erro a autenticar ao Auchan ###", error && error.message);
        return;
    }


    // await setStoreLocation(page, data.products, "2820-620");

    message = { "message": "A adicionar produtos ao Auchan...", "sucess": "true" };
    SendUpdateToUser(userId, message, io, SocketUsers);
    log(`Starting product-add loop with ${data.products.length} products...`);

    var productsNotAdded = await addProducts(page, data.products);

    var endDate = new Date();
    var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
    log(`addProducts finished. notAdded=${productsNotAdded ? productsNotAdded.length : 0} totalElapsedSec=${seconds}`);

    log('Closing page and browser...');
    await page.close();
    await browser.close();
    log('Browser closed.');

    message = { "message": "Processo de adicionar produtos finalizado", "sucess": "true" };
    SendUpdateToUser(userId, message, io, SocketUsers);
    log(`addUserList() DONE. elapsed=${seconds}s`);

    return productsNotAdded;
}

function SendUpdateToUser(userName, message, io, SocketUsers) {
    return;
    var userSessionId = SocketUsers.get(userName);
    if (userSessionId != undefined && userSessionId != null) {
        try {
            io.sockets.sockets[userSessionId].emit('message', message);
        } catch (error) {
            logError('error sending update to user', error && error.message);
        }
    }
    return;
}

function SendUpdateToUserG(message) {
    return;
    var userSessionId = SocketUsersG.get(userIdG);
    if (userSessionId != undefined && userSessionId != null) {
        try {
            ioG.sockets.sockets[userSessionId].emit('message', message);
        } catch (error) {
            logError('error sending update to user (G)', error && error.message);
        }
    }
    return;
}

async function setStoreLocation(page, products, postalCode) {
    log(`setStoreLocation() called. productCount=${products.length} postalCode=${postalCode}`);
    for (let index = 0; index < products.length; index++) {
        const product = products[index];

        try {
            log(`[${index + 1}/${products.length}] ### Opening ### https://www.auchan.pt${product.Url}`);
            // let message = { "message": "A adicionar produto " + product.Name , "sucess": "true" };
            // SendUpdateToUser(userId, message, io, SocketUsers);

            await page.goto('https://www.auchan.pt' + product.Url, {
                timeout: 25000,
                waitUntil: 'networkidle2',
            });
            log(`[${index + 1}/${products.length}] Page loaded.`);

            try { //first try to get quantity input
                //get quantity there
                log(`[${index + 1}/${products.length}] Trying .auc-js-add-to-cart click...`);
                await page.click('.auc-js-add-to-cart');
                log(`[${index + 1}/${products.length}] Clicked .auc-js-add-to-cart`);
            } catch (error) { //quantity ele , find add button 
                try {
                    log(`[${index + 1}/${products.length}] Fallback: clicking .btn-increment...`);
                    await page.click('.btn-increment');
                } catch (error) { //quantity element not found
                    logWarn(`[${index + 1}/${products.length}] Neither add-to-cart nor btn-increment found.`);
                }
            }
            try {
                log(`[${index + 1}/${products.length}] Checking for delivery-options modal...`);
                var _needToChooseLocation = await page.waitForSelector('#auc-delivery-options-modal', { visible: true, timeout: 2500 });
                if (_needToChooseLocation) {
                    log("### Necessita de por o local de busca ou entrega ###");
                    let message = { "message": "Necessita de por o local de busca ou entrega", "sucess": "true" };

                    log('Clicking delivery option (home delivery)...');
                    await page.click('#auc-delivery-options-modal > div > div > div.modal-body.auc-modal__body.text-center > div > div:nth-child(1) > div');
                    // var _needToChooseLocation2 = await page.waitForSelector('#auc-delivery-options-modal > div > div > div.modal-body.auc-modal__body > div > div > div.col-12.col-md-5.auc-modal--click-collect__stores > div.auc-modal--click-collect__stores-list > div > div > div > div > div.row.no-gutters.auc-modal--click-collect__stores-list__store__delivery-types > div.col-5.auc-modal--click-collect__stores-list__store__delivery-types__button > button', { visible: true, timeout: 2500 });

                    log('Waiting for #postal-code input...');
                    await page.waitForSelector('#postal-code', { visible: true, timeout: 2000 });
                    log(`Typing postal code ${postalCode}...`);
                    await page.type('#postal-code', postalCode);
                    log('Confirming home delivery (1st click)...');
                    await page.click('#auc-delivery-home-confirm');
                    await delay(2000);
                    log('Confirming home delivery (2nd click)...');
                    await page.click('#auc-delivery-home-confirm');

                    // await page.click('#auc-delivery-options-modal > div > div > div.modal-body.auc-modal__body > div > div > div.col-12.col-md-5.auc-modal--click-collect__stores > div.auc-modal--click-collect__stores-list > div > div > div > div > div.row.no-gutters.auc-modal--click-collect__stores-list__store__delivery-types > div.col-5.auc-modal--click-collect__stores-list__store__delivery-types__button > button');
                    log('Waiting for delivery-options modal to disappear...');
                    var _needToChooseLocation3 = await page.waitForSelector('#auc-delivery-options-modal', { visible: false, timeout: 10500 });
                    // await page.waitForNavigation({ waitUntil: 'networkidle2' })
                    await delay(2000);
                    log('setStoreLocation() done (delivery configured).');
                    return true;
                }
            } catch (error) {
                // console.log("### Não necessita de re-confirmar email ###");
            }

            try {
                var _uc_modal_loyalty_balance_expiration = await page.waitForSelector('#auc-modal-loyalty-balance-expiration', { visible: true });
                if (_uc_modal_loyalty_balance_expiration) {
                    log('Loyalty-balance-expiration modal detected; dismissing...');
                    await page.click('#auc-modal-loyalty-balance-expiration > div > div > div.modal-body.auc-modal__body > div > div.auc-modal--comarch-expiration__info > div.auc-modal--comarch-expiration__footer > button');
                }
            } catch (error) {
                // console.log("auc-modal-loyalty-balance-expiration not visible");

            }
        } catch (error) {
            // await page.screenshot({ path: './lastScreenshot.png' });
            await delay(500);
            logError(`[${index + 1}/${products.length}] ### Error ### getting product url error`, error && error.message);
            let message = { "message": "Produto " + product.Name + " , erro ao ir extrair informação ao url" + product.Url, "sucess": "true" };
            // SendUpdateToUser(userId, message, io, SocketUsers);
            continue;
        }
    }
    log('setStoreLocation() finished loop without configuring delivery.');
}

async function addProducts(page, products) {
    log(`addProducts() called with ${products.length} products.`);
    var productsNotAdded = [];
    var productsAdded = [];
    var _eleStr = '#maincontent > div.container.product-detail.product-wrapper.auc-pdp__body > div.row.no-gutters.auc-pdp__upper-section.auc-pdp__upper-section--grocery > div.col-12.col-md-7.col-xl-6.auc-pdp__right-section > div > div.auc-pdp__middle-section.row.no-gutters > div.prices-add-to-cart-actions.col-12.col-xl-5 > div > div > div > div > div > div > input';

    var _dialogDeliveryChecked = false;
    for (let index = 0; index < products.length; index++) {
        const product = products[index];
        const productStart = Date.now();

        try {
            log(`[${index + 1}/${products.length}] Adding product - id=${product.ProductId} qty=${product.Quantity} name="${product.Name}" url=https://www.auchan.pt${product.Url}`);
            let message = { "message": "A adicionar produto " + product.Name, "sucess": "true" };
            // SendUpdateToUser(userId, message, io, SocketUsers);
            // SendUpdateToUserG(message);

            await page.goto('https://www.auchan.pt' + product.Url, {
                timeout: 25000,
                // waitUntil: 'networkidle2',
                waitUntil: 'domcontentloaded',
            });
            log(`[${index + 1}/${products.length}] Page DOM loaded.`);

            // await page.waitForNavigation({timeout: 60000, waitUntil: 'load'});
            // await page.waitForNavigation({
            //     waitUntil: 'networkidle0',
            // });

            //first check if found
            try {
                var _notFound = await page.waitForSelector('.auc-404error', { visible: true, timeout: 2500 });
                productsNotAdded.push(product);
                logWarn(`[${index + 1}/${products.length}] NOT ADDED (404) - ${product.Name} - ProductId - ${product.ProductId}`);
                continue;
            } catch (error) {
            }

            try { //first try to get quantity input
                //get quantity there
                // var _btnAddQuantityExists = await page.waitForSelector('.btn-increment', { visible: true, timeout: 2500 });
                log(`[${index + 1}/${products.length}] Reading current quantity input value...`);
                const inputValue = await page.$eval(_eleStr, el => el.value);
                log(`[${index + 1}/${products.length}] Current qty in cart=${inputValue}, target=${product.Quantity}`);
                // var _quantityValue2 = await page.evaluate(e => e.value.trim(), _quantityEl);
                if (product.Quantity != parseInt(inputValue)) {
                    log(`[${index + 1}/${products.length}] Adjusting quantity from ${inputValue} to ${product.Quantity}...`);
                    await page.focus(_eleStr);
                    for (let i = 0; i < inputValue.length; i++) {
                        await page.keyboard.press('Backspace');
                    }
                    await page.type(_eleStr, String(product.Quantity - 1));
                    await page.click('.btn-increment');
                    log(`[${index + 1}/${products.length}] Quantity adjusted.`);

                    // if (!_dialogDeliveryChecked) {
                    //     _dialogDeliveryChecked = await checkForDeliveryDialog(page);
                    // }
                }
            } catch (error) { //quantity ele , find add button 
                try {
                    // var _addButton = await page.waitForSelector('.auc-js-add-to-cart', { visible: true, timeout: 2500 });
                    log(`[${index + 1}/${products.length}] Quantity input not present; clicking .auc-js-add-to-cart...`);
                    await page.click('.auc-js-add-to-cart');
                    log(`[${index + 1}/${products.length}] Clicked add-to-cart.`);

                    await delay(1000);

                    // if (!_dialogDeliveryChecked) {
                    //     _dialogDeliveryChecked = await checkForDeliveryDialog(page);
                    // }

                    if (product.Quantity > 1) {
                        log(`[${index + 1}/${products.length}] Target qty ${product.Quantity} > 1, reading input value...`);
                        // await page.waitForSelector(_eleStr, { visible: true, timeout: 2500 });
                        const inputValue = await page.$eval(_eleStr, el => el.value);
                        log(`[${index + 1}/${products.length}] Post-add qty=${inputValue}, target=${product.Quantity}`);
                        if (product.Quantity != parseInt(inputValue)) {
                            log(`[${index + 1}/${products.length}] Adjusting quantity to ${product.Quantity}...`);
                            await page.focus(_eleStr);
                            for (let i = 0; i < inputValue.length; i++) {
                                await page.keyboard.press('Backspace');
                            }
                            await page.type(_eleStr, String(product.Quantity - 1));
                            await page.click('.btn-increment');
                            log(`[${index + 1}/${products.length}] Quantity adjusted.`);
                        }

                        // if (!_dialogDeliveryChecked) {
                        //     _dialogDeliveryChecked = await checkForDeliveryDialog(page);
                        // }
                    }
                } catch (error) { //quantity element not found
                    productsNotAdded.push(product);
                    logWarn(`[${index + 1}/${products.length}] NOT ADDED - ${product.Name} - ProductId - ${product.ProductId}`, error && error.message);
                    let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
                    // SendUpdateToUser(userId, message, io, SocketUsers);
                    // SendUpdateToUserG(message);
                    // if (!_dialogDeliveryChecked) {
                    //     _dialogDeliveryChecked = await checkForDeliveryDialog(page);
                    // }
                    continue;
                }
            }
            // try {
            //     var _needToChooseLocation = await page.waitForSelector('#auc-delivery-options-modal', { visible: true, timeout: 2500 });
            // } catch (error) {
            //     //productsAdded.push(product);
            //     console.log("### Não existe o diálogo de guardar loja ###");
            // }

            message = { "message": (index + 1) + " de " + products.length + " produtos adicionados ao Auchan Online", "sucess": "true" };
            log(`[${index + 1}/${products.length}] ADDED "${product.Name}" in ${Date.now() - productStart}ms`);
            // SendUpdateToUser(userId, message, io, SocketUsers);
            // SendUpdateToUserG(message);

            productsAdded.push(product);
        } catch (error) {
            // await page.screenshot({ path: './lastScreenshot.png' });
            await delay(500);
            logError(`[${index + 1}/${products.length}] ### Error ### getting product url error`, error && error.message);
            let message = { "message": "Produto " + product.Name + " , erro ao ir extrair informação ao url" + product.Url, "sucess": "true" };
            // SendUpdateToUser(userId, message, io, SocketUsers);
            if (index === 0) {
                log('First product errored - triggering delivery dialog check...');
                _dialogDeliveryChecked = await checkForDeliveryDialog(page);
                log(`Delivery dialog check result=${_dialogDeliveryChecked}`);
            }
            continue;
        }


    }
    log(`addProducts() done. added=${productsAdded.length} notAdded=${productsNotAdded.length}`);
    return productsNotAdded;
}

async function checkForDeliveryDialog(page) {
    log('checkForDeliveryDialog() called.');
    try {
        log('Waiting for delivery-options modal (up to 2000ms)...');
        await page.waitForSelector('#auc-delivery-options-modal > div > div > div.modal-body.auc-modal__body.text-center > div > div:nth-child(1) > div', { visible: true, timeout: 2000 });
    } catch (error) {
        log('No delivery dialog visible - returning false.');
        return false;
    }

    try {
        log('Delivery dialog visible - clicking home delivery option...');
        await page.click('#auc-delivery-options-modal > div > div > div.modal-body.auc-modal__body.text-center > div > div:nth-child(1) > div');
        // await page.waitFor(2000);
        log('Waiting for #postal-code input...');
        await page.waitForSelector('#postal-code', { visible: true, timeout: 2000 });
        log('Typing postal code 2820-620...');
        await page.type('#postal-code', '2820-620');
        log('Confirming home delivery (1st click)...');
        await page.click('#auc-delivery-home-confirm');
        await delay(2000);
        log('Confirming home delivery (2nd click)...');
        await page.click('#auc-delivery-home-confirm');
        log('Delivery configured. Returning true.');
        return true;

    } catch (error) {
        logError('checkForDeliveryDialog() error during config', error && error.message);
        return false;
    }


}

async function getAllCategories() {
    log('getAllCategories() called.');
    // const browser = await puppeteer.launch({ headless: false });
    const browser = await puppeteer.launch({
        args: ['--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu']
    });
    log('Browser launched.');
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    var finalData = [];
    try {
        log('Navigating to https://www.auchan.pt ...');
        var response = await page.goto('https://www.auchan.pt', {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });
        log(`Home page loaded. status=${response && response.status && response.status()}`);

        // await page.click('.accept-policy.auc-button__rounded--primary');
        log('Clicking cookie accept...');
        await page.click('#onetrust-accept-btn-handler');

        log('Querying .dropdown-link elements...');
        const _allCategories = await page.$$('.dropdown-link'); //first level
        log(`Found ${_allCategories.length} dropdown-link elements.`);

        var counter = 1;
        for (const _category of _allCategories) {
            const _aHref = await page.evaluate(anchor => anchor.getAttribute('href'), _category);
            const _aClass = await page.evaluate(anchor => anchor.getAttribute('class'), _category);
            if (_aClass.indexOf('dropdown-toggle') > -1) {
                continue;
            }

            finalData.push(_aHref);
        }
        log(`Collected ${finalData.length} category hrefs.`);
        // return finalData;

    } catch (error) {
        logError('getAllCategories() error', error && error.message);
    }

    await page.close();
    await browser.close();
    log('getAllCategories() done.');
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
    log(`getNewProducts() called. url=${url}`);
    // const browser = await puppeteer.launch({ headless: false });
    const browser = await puppeteer.launch({
        args: ['--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu']
    });
    log('Browser launched.');
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    var finalData = [];

    try {
        log(`Navigating to https://www.auchan.pt${url} ...`);
        var response = await page.goto('https://www.auchan.pt' + url, {
            timeout: 25000,
            waitUntil: 'networkidle2',
        });
        log(`Page loaded. status=${response && response.status && response.status()}`);
        // await page.click('.accept-policy.auc-button__rounded--primary')
        log('Clicking cookie accept...');
        await page.click('#onetrust-accept-btn-handler');

        // const lastPosition = await scrollPageToBottom(page, 250, 500)
        // await page.evaluate(scrollToBottom);
        // await page.waitFor(3000);

        log('Querying .product elements...');
        const _allProducts = await page.$$('.product'); //first level
        log(`Found ${_allProducts.length} .product elements.`);
        var counter = 1;
        for (const _product of _allProducts) {
            const _product_a = await _product.$('a');
            const _product_a_href = await page.evaluate(anchor => anchor.getAttribute('href'), _product_a);
            var _productId = _product_a_href.replace('.html', '');
            _productId = _productId.substring(_productId.lastIndexOf('/') + 1);
            // console.log(_productId);
            finalData.push(_productId);
        }
        log(`Collected ${finalData.length} product ids.`);

    } catch (error) {
        logError('getNewProducts() error', error && error.message);
    }

    await page.close();
    await browser.close();
    log('getNewProducts() done.');
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
    log(`addNewProducts() called with ${onlineProductIds.length} online product ids.`);
    for (let index = 0; index < onlineProductIds.length; index++) {
        const onlineProductId = onlineProductIds[index];
        try {
            log(`[${index + 1}/${onlineProductIds.length}] Posting new product onlineProductId=${onlineProductId}`);
            var _newProduct = {
                "UserId": "9ff8224f-17cf-49fb-b555-05779a13eb40",
                "FirstAddedProductFromStoreId": 1,
                "Barcode": "",
                // "Lists":["shoppingList"],
                "SelectedResults": [
                    {
                        "StoreId": 1,
                        "OnlineProductId": onlineProductId
                    }
                ]
            };
            // var response = await fetch('http://localhost:4430/api/Products/PostV2?userId=9ff8224f-17cf-49fb-b555-05779a13eb40', {
            var response = await fetch('https://lisie.app/api/Products/PostV2?userId=9ff8224f-17cf-49fb-b555-05779a13eb40', {
                method: 'POST',
                body: JSON.stringify(_newProduct),
                headers: { 'Content-Type': 'application/json' }
            });
            var _responseText = await response.text();
            log(`[${index + 1}/${onlineProductIds.length}] added status=${response.status} body=`, _responseText);

            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            logError(`[${index + 1}/${onlineProductIds.length}] addNewProducts() error`, error && error.message);
        }
    }
    log('addNewProducts() done.');
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