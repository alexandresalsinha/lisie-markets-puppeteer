const bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

const express = require("express");
const app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

const puppeteer = require('puppeteer');
var request = require('request');
const requestPromise = require("request-promise");
const querystring = require('querystring');
const fs = require('fs');
var schedule = require('node-schedule');

//TODO, turn with map with id, for multiple polling
var pingoDoceResults = [];
var pingoDoceProductData = {};

var requestedUsersShoppingList = ['hehehe'];

var SocketUsers = new Map();

require('dotenv').config()

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.set('port', (process.env.PORT || 3000));

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use(cookieParser());

var isToAddItemsToBasket = false;

function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

app.post("/addUserListToJumbo/:userId", (req, res) => {
    var jsonBody = req.body;
    var userId = req.params.userId;
    res.send("Doing the work ;)");
    (async () => {
        var startDate = new Date();
        // const browser = await puppeteer.launch({ headless: false });
        const browser = await puppeteer.launch({
            args: ['--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu']
        });
        const page = await browser.newPage();
        // page.on('console', msg => console.log(msg));

        var productItemsList = [];

        var screenshot = 'screenshot.png';

        // await page.setRequestInterception(true);
        // page.on('request', interceptedRequest => {
        //     if (isToAddItemsToBasket) {
        //         isToAddItemsToBasket = false;
        //         var sendJson = {shopingListId:1,items : productItemsList};
        //         var data = {
        //             'method': 'POST',
        //             'Content-Type': 'application/json; charset=UTF-8',
        //             'Accept': 'application/json, text/javascript, */*; q=0.01',
        //             'postData': JSON.stringify(sendJson)
        //         };

        //         // Request modified... finish sending! 
        //         interceptedRequest.continue(data);
        //     } else {
        //         interceptedRequest.continue();
        //     }
        //     // Here, is where you change the request method and 
        //     // add your post data

        // });

        console.log("### Starting ###");
        await page.setViewport({ width: 1920, height: 1080 })


        const navigationPromise = page.waitForNavigation()
        try {
            var response = await page.goto('https://www.auchan.pt', {
                timeout: 25000,
                waitUntil: 'networkidle2',
            });

            await page.click('#btnLogin')
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

            // await page.type('[name="username"]', jsonBody.username)
            // await page.type('[name="password"]', jsonBody.password)
            await page.type('[type="email"]', jsonBody.username)
            await page.type('[type="password"]', jsonBody.password)
        } catch (error) {
            console.log("### Erro a aceder ao auchan ###");
            let message = { "message": "Erro a aceder ao auchan", "sucess": "false" };
            SendUpdateToUser(userId, message);
            return;
        }
        console.log("### Authenticating ###");
        let message = { "message": "A autenticar ao Auchan...", "sucess": "true" };
        SendUpdateToUser(userId, message);

        //var toremove = "";
        var anchorLogin = await page.$('#submitForm');
        //Not working because of click bug on website, when it´s good again, take comments
        // await clickOnElement(anchorLogin, 4);
        await page.evaluate(e => e.click(), anchorLogin);
        // await navigationPromise

        //testing2
        try {
            //await page.type('[type="password"]', String.fromCharCode(13));
            //await navigationPromise
            await page.waitFor(10000);


            //See if login was sucessful
            try {
                var anchorLogin = await page.$('[type="password"]');
                // var anchorLogin = await page.$('#jumbo-login > form.jumbo-form.login-form > div.jumbo-submit.jumbo-button.jumbo-button-flex.login-form')
                if (anchorLogin) {
                    try {
                        var emailReconfirmationPopup = await page.waitForSelector('#popUpAge', { visible: true, timeout: 5000 });
                        if (emailReconfirmationPopup) {
                            console.log("### Necessita de re-confirmar email ###");
                            let message = { "message": "Necessitade re-confirmar o seu email no auchan online", "sucess": "true" };
                            SendUpdateToUser(userId, message);
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
                    SendUpdateToUser(userId, message);
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

        // await page.click('#cookies-accept')

        message = { "message": "A adicionar produtos ao Auchan...", "sucess": "true" };
        SendUpdateToUser(userId, message);

        // await page.evaluateOnNewDocument((data) => {
        //     var productsToAddToBasket = [];
        //   }, {});

        var buyButtonFound = false;
        var productsNotAdded = [];
        var productsAdded = [];
        for (let index = 0; index < jsonBody.products.length; index++) {
            const product = jsonBody.products[index];

            //console.log('product:', product);

            try {
                console.log("### Openning ### " + 'https://www.auchan.pt' + product.Url);
                // let message = { "message": "A adicionar produto " + product.Name , "sucess": "true" };
                // SendUpdateToUser(userId, message);

                await page.goto('https://www.auchan.pt' + product.Url, {
                    timeout: 25000,
                    waitUntil: 'networkidle2',
                });



                //Try to click on Buy and see if popup appears
                if (index == 0 || !buyButtonFound) {
                    try {
                        var anchorLogin = await page.$('#conteudo > div.product-detail > div:nth-child(1) > div.col-md-11.col-sm-11.col-xs-12 > div > div.col-md-5.col-sm-5.col-xs-12.text-info.pull-right > div.product-btns-panel > button.btn.btn-link.large.hidden-xs', { timeout: 5000 })

                        await page.evaluate(e => e.click(), anchorLogin);
                        buyButtonFound = true;
                        var modalContainerPopup = await page.waitForSelector('#deliveryMethodModal > div > div > div.modal-body > form > div > div:nth-child(2) > div.dropdown.col-xs-6', { visible: true, timeout: 5000 })
                        console.log("modalContainerPopup", modalContainerPopup);

                        if (modalContainerPopup) {
                            var anchorLogin2 = await page.$('#deliveryMethodComfirmation')
                            await page.evaluate(e => e.click(), anchorLogin2);
                        }
                    } catch (error) {
                        console.error(error);
                        if (buyButtonFound) {
                            await page.waitFor(500);
                            console.log('### Delivery Method Modal Not Found ###', error);

                            //check if delivery adress modal exists
                            try {
                                var modalAdressContainerPopup = await page.waitForSelector('#deliveryAddress', { visible: true, timeout: 5000 })
                                console.log("modalAdressContainerPopup", modalAdressContainerPopup);
                                if (modalAdressContainerPopup) {
                                    console.log("### modalAdressContainerPopup - Auchan store needs delivery adress ###");
                                    let message = { "message": "Necessita de introduzir a sua morada na loja online Auchan para continuar", "sucess": "true" };
                                    SendUpdateToUser(userId, message);
                                    await page.close()
                                    await browser.close()
                                    return;
                                }

                            } catch (error) {
                                console.log('### Delivery Address Modal Not Found ###');
                            }
                        }
                    }
                }

                var productItem = (await page.evaluate(() => productsToAddToBasket = creatBasketItemBasicInfo($('#conteudo > div.product-detail > div:nth-child(1) > div.col-md-11.col-sm-11.col-xs-12 > div > div.col-md-5.col-sm-5.col-xs-12.text-info.pull-right > div.product-btns-panel > button.btn.btn-link.large.hidden-xs').closest('.row').find('.info :input'))));
                if (!isEmpty(productItem)) {
                    productItem.Quantity = product.Quantity;
                    console.log('### FETCHED ### ' + product.Url);
                    // let message = { "message": "Produto " + product.Name + " adicionado", "sucess": "true" };
                    productItemsList.push(productItem);
                    productsAdded.push(product);
                    let message = { "message": (index + 1) + " de " + jsonBody.products.length + " produtos adicionados ao Auchan Online", "sucess": "true" };
                    SendUpdateToUser(userId, message);
                }
                else {
                    console.log('### NOT ADDED ### ' + product.Url);
                    let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
                    SendUpdateToUser(userId, message);

                    productsNotAdded.push(product);
                }
            } catch (error) {
                await page.screenshot({ path: './lastScreenshot.png' });
                await page.waitFor(500);
                console.log('### Error ### getting product url error', error);
                let message = { "message": "Produto " + product.Name + " , erro ao ir extrair informação ao url" + product.Url, "sucess": "true" };
                SendUpdateToUser(userId, message);
                continue;
            }
            await page.waitFor(500);
            //await page.goto('https://www.auchan.pt' + product.Url);

            //var resultPush = (await page.evaluate(() => basketItems.push(productsToAddToBasket)));
            //var resultPushText = (await page.evaluate(() => basketItems));


            // var addToBasket2 = (await page.evaluate(() => productsToAddToBasket = [productsToAddToBasket]));
            // var addToBasket2 = (await page.evaluate(() => productsToAddToBasket));
            // var addToBasket = (await page.evaluate(() => addItemsToBasket(productsToAddToBasket, null)));

            // const scriptHandle = await page.addScriptTag({ content: 'var productItemsList = ' + JSON.stringify(productItemsList) +';' });
            // var addToBaskhahaha2 = (await page.evaluate(() => productItemsList));
            // var hahaha3 = (await page.evaluate(() => console.log(productItemsList)));
        }
        // await browser.close()
        var endDate = new Date();
        var seconds = (endDate.getTime() - startDate.getTime()) / 1000;

        // isToAddItemsToBasket = true;

        //TODO send all products in array at the same time
        // var addToBasket2 = (await page.evaluate(() => productsToAddToBasket));
        // var addToBasket2 = (await page.evaluate(() => productsToAddToBasket = [productsToAddToBasket]));
        // var addToBasket2 = (await page.evaluate(() => productsToAddToBasket));
        // var addToBasket = (await page.evaluate(() => addItemsToBasket(productsToAddToBasket, null)));

        const scriptHandle = await page.addScriptTag({ content: 'var productItemsList = ' + JSON.stringify(productItemsList) + ';' });
        var addToBaskhahaha2 = (await page.evaluate(() => productItemsList));
        var hahaha3 = (await page.evaluate(() => console.log(productItemsList)));
        var addToBasket = (await page.evaluate(() => addItemsToBasket(productItemsList, null)));


        await page.close()
        await browser.close()

        //TODO - send products not added to webservice post NotifyProductsAddedToJumboOnline

        message = { "message": "Processo de adicionar produtos finalizado", "sucess": "true" };
        SendUpdateToUser(userId, message);

        console.log("### Produtos não adicionados ###");
        console.log(productsNotAdded);

        var jsonDataObj = {
            UserId: userId,
            TimespanSeconds: seconds,
            ProductsNotAdded: productsNotAdded,
            ProductsAdded: productsAdded,
            TotalProducts: jsonBody.products.length,
            Sucess: true,
            AuthenticationSucess: true
        };

        // request.post({
        //     //url: 'http://lisie.app/puppetter/NotifyProductsAddedToJumboOnline',
        //     url: 'https://lisie.app/puppetter/NotifyProductsAddedToJumboOnline',
        //     body: jsonDataObj,
        //     json: true
        // }, function (error, response, body) {
        //     console.log(body);
        // });

        request
            .get('http://lisie.app/puppetter/NotifyProductsAddedStore?userId=' + userId + '&store=Auchan&timespanseconds=' + seconds)
            .on('response', function (response) {
                console.log(response.statusCode)
            })
            .on('error', function (e) {
                console.log(e);
                console.log('Error calling lisie.app/puppetter/NotifyProductsAddedToJumboOnline');
            });

        // request
        //     .get('http://lisie.app/puppetter/NotifyProductsAddedToJumboOnline?userId=' + userId + '&timespanseconds=' + seconds)
        //     .on('response', function (response) {
        //         console.log(response.statusCode)
        //     })
        //     .on('error', function (e) {
        //         console.log(e);
        //         console.log('Error calling lisie.app/puppetter/NotifyProductsAddedToJumboOnline');
        //     });
        return;
        // async function clickOnElement(elem, x = null, y = null) {
        //     const rect = await page.evaluate(el => {
        //         const { top, left, width, height } = el.getBoundingClientRect();
        //         return { top, left, width, height };
        //     }, elem);

        //     // Use given position or default to center
        //     const _x = x !== null ? x : rect.width / 2;
        //     const _y = y !== null ? y : rect.height / 2;

        //     await page.mouse.click(rect.left + _x, rect.top + _y);
        // }
    })()
});

app.post("/addUserListToContinente/:userId", (req, res) => {
    var jsonBody = req.body;
    var userId = req.params.userId;
    res.send("Doing the work ;)");
    (async () => {
        var startDate = new Date();
        //RIGHT ONE FOR LOCAL
        // const browser = await puppeteer.launch({ args: ['--enable-features=NetworkService'], headless: false, ignoreHTTPSErrors: true })

        //RIGHT ONE FOR PRODUCTION
        const browser = await puppeteer.launch({
            args: ['--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--enable-features=NetworkService'],
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage()
        // page.on('console', msg => console.log(msg));

        var productItemsList = [];

        var screenshot = 'screenshot.png';

        await page.setViewport({ width: 1920, height: 1080 })

        await page.goto('https://www.continente.pt/pt-pt/public/Pages/homepage.aspx', {
            timeout: 250000,
            // waitUntil: 'networkidle2',
            waitUntil: 'domcontentloaded'
        });

        const navigationPromise = page.waitForNavigation()


        await page.type('#username', jsonBody.username)
        await page.type('#password', jsonBody.password)

        console.log("### Authenticating ###");
        let message = { "message": "A autenticar ao Continente...", "sucess": "true" };
        SendUpdateToUser(userId, message);

        var anchorLogin = await page.$('#btnLogin')
        await page.evaluate(e => e.click(), anchorLogin);

        try {
            await page.waitFor(5000);
            //check if authentication data was wrong
            var errorOnLoginIsVisible = await page.$('#loginerror', { visible: true });
            if (errorOnLoginIsVisible) {
                console.log("### Login do continente online inválido ###");
                let message = { "message": "Login do continente online inválido", "sucess": "true" };
                await page.close()
                await browser.close()
                return;
            }
            console.log("### Testing if a modal popup exists ###");
            // var modalContainerPopup = await page.waitForSelector('#simplemodal-container', { visible: true, timeout: 5000 })
            // var modalContainerPopup = await page.waitForSelector('#simplemodal-container', { visible: true, timeout: 15000 })
            var modalContainerPopup = await page.waitForSelector('#simplemodal-container', { visible: true, timeout: 10000 })
            console.log("modalContainerPopup", modalContainerPopup)

            if (modalContainerPopup) {
                console.log("### Modal popup exists, closing it... ###");
                var anchorLogin = await page.$('#chkshowavailablecoupons')
                await page.evaluate(e => e.click(), anchorLogin);
                var anchorLogin = await page.$('#blockUIClose')
                await page.evaluate(e => e.click(), anchorLogin);
            }
        } catch (error) {
            console.log("### ERROR ###");
            console.error(error);
        }


        await navigationPromise

        message = { "message": "A adicionar produtos ao Continente...", "sucess": "true" };
        SendUpdateToUser(userId, message);

        var _productsAddedWithSucess = 0;
        for (let index = 0; index < jsonBody.products.length; index++) {
            const product = jsonBody.products[index];
            console.log('product:', product);

            try {
                var response = await page.goto('https://www.continente.pt' + product.Url, {
                    timeout: 25000,
                    waitUntil: 'domcontentloaded',
                });

                //change quantity
                // var quantityInput = await page.$('#ctl00_SPWebPartManager1_g_bb0b4bf8_4286_4ae5_b9f5_c4307362f018_ctl00__panelcontrol_ > div > div.product._ecsfProductDetailWrapper.ecsf_product_icons > div.productInfoArea.basketWrapperProductDetail.ecsf_add_product_to_basket > div.productInfoBottom > div.addToCartArea.ProductDetailWrapper._addToListBtnWrapper.ecsf_add_product_to_shopping_list > ul > li:nth-child(1) > div > div.unitsTextBoxArea > input');
                // await page.focus('#ctl00_SPWebPartManager1_g_bb0b4bf8_4286_4ae5_b9f5_c4307362f018_ctl00__panelcontrol_ > div > div.product._ecsfProductDetailWrapper.ecsf_product_icons > div.productInfoArea.basketWrapperProductDetail.ecsf_add_product_to_basket > div.productInfoBottom > div.addToCartArea.ProductDetailWrapper._addToListBtnWrapper.ecsf_add_product_to_shopping_list > ul > li:nth-child(1) > div > div.unitsTextBoxArea > input');
                // await page.type('#ctl00_SPWebPartManager1_g_bb0b4bf8_4286_4ae5_b9f5_c4307362f018_ctl00__panelcontrol_ > div > div.product._ecsfProductDetailWrapper.ecsf_product_icons > div.productInfoArea.basketWrapperProductDetail.ecsf_add_product_to_basket > div.productInfoBottom > div.addToCartArea.ProductDetailWrapper._addToListBtnWrapper.ecsf_add_product_to_shopping_list > ul > li:nth-child(1) > div > div.unitsTextBoxArea > input', product.Quantity);

                // var responseText = await response.text();
                const scriptHandleSetVar = await page.addScriptTag({ content: 'var lproductquantity = ' + product.Quantity + ';' });

                await page.evaluate(() => document.querySelector("#ctl00_SPWebPartManager1_g_bb0b4bf8_4286_4ae5_b9f5_c4307362f018_ctl00__panelcontrol_ > div > div.product._ecsfProductDetailWrapper.ecsf_product_icons > div.productInfoArea.basketWrapperProductDetail.ecsf_add_product_to_basket > div.productInfoBottom > div.addToCartArea.ProductDetailWrapper._addToListBtnWrapper.ecsf_add_product_to_shopping_list > ul > li:nth-child(1) > div > div.unitsTextBoxArea > input").value = lproductquantity);

                var anchorLogin = await page.$('#ctl00_SPWebPartManager1_g_bb0b4bf8_4286_4ae5_b9f5_c4307362f018_ctl00__panelcontrol_ > div > div.product._ecsfProductDetailWrapper.ecsf_product_icons > div.productInfoArea.basketWrapperProductDetail.ecsf_add_product_to_basket > div.productInfoBottom > div.addToCartArea.ProductDetailWrapper._addToListBtnWrapper.ecsf_add_product_to_shopping_list > ul > li.actionsArea > div:nth-child(1) > input');
                await page.evaluate(e => e.click(), anchorLogin);
                await page.waitFor(1000);
                _productsAddedWithSucess++;

                let message = { "message": _productsAddedWithSucess + " de " + jsonBody.products.length + " produtos adicionados ao Continente Online", "sucess": "true" };
                SendUpdateToUser(userId, message);
            } catch (error) {
                console.log('getting product url error', error);
                let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
                // let message = { "message": "Produto " + product.Name + " , erro ao ir extrair informação ao url" + product.Url, "sucess": "true" };
                // let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true" };
                SendUpdateToUser(userId, message)
            }
            await page.waitFor(500);
        }
        var endDate = new Date();
        var seconds = (endDate.getTime() - startDate.getTime()) / 1000;

        await page.close()
        await browser.close()

        message = { "message": "Processo de adicionar produtos finalizado", "sucess": "true" };
        SendUpdateToUser(userId, message);

        request
            .get('http://lisie.app/puppetter/NotifyProductsAddedStore?userId=' + userId + '&store=Continente&timespanseconds=' + seconds)
            .on('response', function (response) {
                console.log(response.statusCode)
            })
            .on('error', function (e) {
                console.log(e);
                console.log('Error calling lisie.app/puppetter/NotifyProductsAddedToJumboOnline');
            });
        return;
    })()
});

app.post("/authenticateToContinente/:userId", async (req, res) => {
    var jsonBody = req.body;
    var userId = req.params.userId;
    res.send("Doing the work of trying to authenticate to continente. Listen to the socketsss ;)");
    (async () => {
        var startDate = new Date();
        //RIGHT ONE FOR LOCAL
        // const browser = await puppeteer.launch({ args: ['--enable-features=NetworkService'], headless: false, ignoreHTTPSErrors: true })

        //RIGHT ONE FOR PRODUCTION
        const browser = await puppeteer.launch({
            args: ['--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--enable-features=NetworkService'],
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage()
        await page.setViewport({ width: 1920, height: 1080 })

        await page.goto('https://www.continente.pt/pt-pt/public/Pages/homepage.aspx', {
            timeout: 250000,
            waitUntil: 'domcontentloaded'
        });

        const navigationPromise = page.waitForNavigation()

        await page.type('#username', jsonBody.username)
        await page.type('#password', jsonBody.password)

        console.log("### Authenticating ###");
        let message = { "message": "A autenticar ao Continente...", "sucess": "true" };
        SendUpdateToUser(userId, message);

        var anchorLogin = await page.$('#btnLogin')
        await page.evaluate(e => e.click(), anchorLogin);

        try {
            await page.waitFor(2000);
            //check if authentication data was wrong
            var errorOnLoginIsVisible = await page.$('#loginerror', { visible: true });
            if (errorOnLoginIsVisible) { //not authenticated
                console.log("### Login do continente online inválido ###");
                let message = { "message": "Login do continente online inválido", "sucess": "true" };
                SendUpdateToUser(userId, message);
            } else { //authenticated
                console.log("### Login do continente online inválido ###");
                let message = { "message": "Login do continente online inválido", "sucess": "true" };
                SendUpdateToUser(userId, message);
            }
        } catch (error) {
            console.log("### ERROR ###");
            console.error(error);
        }

        await page.close()
        await browser.close()
        return;
    })()
});

// app.post("/addUserListToContinente2/:userId", (req, res) => {
//     const CDP = require('chrome-remote-interface');

//     CDP(async (client) => {
//         const { Page, Security } = client;
//         // ignore all the certificate errors
//         Security.certificateError(({ eventId }) => {
//             Security.handleCertificateError({
//                 eventId,
//                 action: 'continue'
//             });
//         });
//         try {
//             await Page.enable();
//             await Security.enable();
//             // enable the override
//             await Security.setOverrideCertificateErrors({ override: true });
//             // load the URL as usual
//             await Page.navigate({ url: 'https://www.continente.pt/pt-pt/public/Pages/homepage.aspx' }); // example.com
//             await Page.loadEventFired();
//             console.log('Finished!');
//         } catch (err) {
//             console.error(err);
//         } finally {
//             await client.close();
//         }
//     }).on('error', (err) => {
//         console.error(err);
//     });
// });

app.get("/getPingoDoceSearchResults/:search/:counter", (req, res) => {
    var search = req.params.search;
    var counter = req.params.counter;
    pingoDoceResults = [];
    res.send('Working on Pingo Doce - Mercadao.pt ;)');

    (async () => {
        // const browser = await puppeteer.launch({ headless: false })
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
        const page = await browser.newPage()

        var screenshot = 'screenshotPingoDoce.png';
        await page.setViewport({ width: 1920, height: 1080 })
        await page.goto('https://mercadao.pt/store/pingo-doce/search?queries="' + encodeURIComponent(search), {
            timeout: 0,
            waitUntil: ['domcontentloaded', 'networkidle0']
        })

        const products = await page.$$('.pdo-product-item');
        var finalData = [];
        for (const product of products) {
            var anchor = await product.$('article > a')
            await anchor.click()
            if (await page.$('pdo-enter-postal-code') !== null) {
                await page.type('#postalCode', '2610062')
                await page.click('pdo-enter-postal-code > div > form > div > div > div > button')
                await page.waitForNavigation()

                finalData = await getPingoDoceSearchResults(page, search, true, counter);
                break;
            }
            else {
                finalData = await getPingoDoceSearchResults(page, search, false, counter);
                break;
            }
        }
        pingoDoceResults = finalData;

        // await page.screenshot({ path: screenshot })
        await browser.close()

        return;
    })()
});

app.get("/getPingoDoceSearchResultsData", (req, res) => {
    res.json(pingoDoceResults);
    pingoDoceResults = [];
});

app.post("/updateUsersShoppingListProductsPrices", async (req, res) => {
    var _userProducts = req.body;
    res.json(req.params.userId);
    for (let index = 0; index < _userProducts.length; index++) {
        const _userProduct = _userProducts[index];

        setTimeout(() => {
            console.log('Calling http://lisie.app/api/ProductsApi/UpdatePrices?productId=' + _userProduct.ProductId)
            request
                .get('http://lisie.app/api/ProductsApi/UpdatePrices?productId=' + _userProduct.ProductId)
                //.get('http://localhost:4430/api/ProductsApi/UpdatePrices?productId=' + _userProduct.ProductId)
                .on('response', function (response) {
                    console.log(response.statusCode);
                })
                .on("data", function (chunk) {
                    console.log("BODY: " + chunk);
                })
                .on('error', function (e) {
                    console.log(e);
                    console.log('Error calling lisie.app/puppetter/NotifyProductsAddedToJumboOnline');
                });
            //return;
        }, 30000 * index);
        console.log('product:', _userProduct);

    }
    //TODO - make request to delete user update prices requests (anwsered == false)
    requestedUsersShoppingList.push(req.params.userId);
});

async function getPingoDoceSearchResults(page, search, reload, number) {
    if (reload) {
        await page.goto('https://mercadao.pt/store/pingo-doce/search?queries=' + encodeURIComponent(search), {
            timeout: 0,
            waitUntil: ['domcontentloaded', 'networkidle0']
        })
    }

    const products = await page.$$('.pdo-product-item');
    var finalData = [];
    var counter = 1;
    for (const product of products) {
        const title = await product.$('.detail-title')
        var titleText = await page.evaluate(e => e.textContent.trim(), title)

        const img = await product.$('.pdo-block.media')
        var imgSrc = await page.evaluate(e => e.src, img)

        // const price = await product.$('.detail-price')
        //var priceValue = await page.evaluate(e => e.textContent.trim(), price)
        const price = await product.$('article > a > div > div > h4 > pdo-product-price-tag > span')
        var priceValue = await page.evaluate(e => e.textContent.trim(), price)

        const priceWeight = await product.$('.pdo-text-xxs.detail-text')
        var priceWeightText = await page.evaluate(e => e.textContent.trim(), priceWeight)

        var priceWeightTextSpl = priceWeightText.split('|');
        var weightText = '';
        if (priceWeightTextSpl.length > 0) {
            weightText = priceWeightTextSpl[0].trim();
            priceWeightText = priceWeightTextSpl[1].trim();
        }
        // var anchor = await product.$('article > a')
        //if(num % 2 == 0) continue;
        console.log('clicking - ' + titleText)
        //await page.waitFor(5000)
        await page.evaluate(e => e.click(), anchor);
        // await anchor.click()
        // await anchor.click({delay:2500})
        //var popupExists = await page.$('div.pdo-product') == null;
        // console.log('selector')
        // await page.waitForNavigation()
        // await page.waitForSelector('div.pdo-product',  { visible: true })
        if (counter == 1) {
            await page.waitFor(1000)
        } else {
            await page.waitFor(500)
        }
        // await page.waitForNavigation()
        var productUrl = page.url();
        console.log('url of - ' + titleText + ':' + productUrl);

        if (productUrl.indexOf('https://mercadao.pt') > -1) productUrl = productUrl.replace('https://mercadao.pt', '');
        finalData.push({ Name: titleText, ImageUrl: imgSrc, Price: priceValue, PriceWeight: priceWeightText, Store: 'Pingo Doce', Url: productUrl, Weight: weightText });

        if (await page.$('div.pdo-product') != null)
            await page.click('pdo-icon-close')
        await page.waitFor(500)

        if (finalData.length == parseInt(number)) break;
        counter++;
    }
    return await finalData;
}



app.get("/getPingoDoceProduct", (req, res) => {
    var url = req.query.url;
    //res.send('Doing the work');
    res.send('Working on Pingo Doce - Getting Product Data of url ' + url);
    (async () => {
        // const browser = await puppeteer.launch({ headless: false })
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
        const page = await browser.newPage()

        var screenshot = 'screenshotPingoDoce.png';
        await page.setViewport({ width: 1920, height: 1080 })
        await page.goto('https://mercadao.pt/store/pingo-doce/search?queries="' + encodeURIComponent('tomate'), {
            timeout: 0,
            waitUntil: ['domcontentloaded', 'networkidle0']
        })

        const products = await page.$$('.pdo-product-item');
        var finalData = [];
        for (const product of products) {
            var anchor = await product.$('article > a')
            await anchor.click()
            if (await page.$('pdo-enter-postal-code') !== null) {
                await page.type('#postalCode', '2610062')
                await page.click('pdo-enter-postal-code > div > form > div > div > div > button')
                await page.waitForNavigation()

                finalData = await getPingoDoceProductData(page, url);
                break;
            }
            else {
                // finalData = await getPingoDoceSearchResults(page, search, false, counter);
                break;
            }
        }
        console.log('Pingo Doce Product Results received', finalData);
        pingoDoceProductData = finalData;
        // await page.screenshot({ path: screenshot })
        await browser.close()
        return;
    })()
});

app.get("/getPingoDoceProductData", (req, res) => {
    res.json(pingoDoceProductData);
    pingoDoceProductData = [];
});
async function getPingoDoceProductData(page, url) {
    // await page.goto('https://www.mercadao.pt' + url, {
    //     timeout: 0,
    //     waitUntil: ['domcontentloaded', 'networkidle0']
    // })
    await page.goto('https://mercadao.pt' + url, {
        timeout: 0,
        waitUntil: ['domcontentloaded', 'networkidle0']
    })
    //await page.screenshot({ path: screenshot })
    const product = await page.$('div.pdo-product');
    const title = await product.$('.product-title')
    var titleText = await page.evaluate(e => e.textContent.trim(), title)

    const img = await product.$('.pdo-square-media > img')
    var imgSrc = await page.evaluate(e => e.src, img)

    const price = await product.$('pdo-product-price-tag > span.pdo-inline-block.pdo-middle.ng-star-inserted')
    var priceValue = await page.evaluate(e => e.textContent.trim(), price)

    const priceWeight = await product.$('pdo-product-price-per-unit')
    var priceWeightText = await page.evaluate(e => e.textContent.trim(), priceWeight)

    var priceWeightTextSpl = priceWeightText.split('|');
    var weightText = '';
    if (priceWeightTextSpl.length > 0) {
        weightText = priceWeightTextSpl[0].trim();
        priceWeightText = priceWeightTextSpl[1].trim();
    }
    //get product url
    var productData = { Name: titleText, ImageUrl: imgSrc, Price: priceValue, PriceWeight: priceWeightText, Store: 'Pingo Doce', Url: url, Weight: weightText };
    return productData;
}

app.get("/getAccountBalance", (req, res) => {
    (async () => {
        //const browser = await puppeteer.launch({ headless: false })
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
        const page = await browser.newPage()

        await page.setViewport({ width: 1920, height: 1080 })
        await page.goto('https://m.bancomontepio.pt/netmovel24/login.jsp')

        const navigationPromise = page.waitForNavigation()

        await page.type('#username', '3741896')
        await page.type('#password', '691412')
        // await page.click('#form1 > div.ui-submit.ui-btn.ui-shadow.ui-btn-corner-all.ui-btn-up-a > input')
        // await navigationPromise

        var anchorLogin = await page.$('#form1 > div.ui-submit.ui-btn.ui-shadow.ui-btn-corner-all.ui-btn-up-a > input')
        await page.evaluate(e => e.click(), anchorLogin);

        await navigationPromise


        await page.goto('https://m.bancomontepio.pt/netmovel24/func/contasordem/ctaOrdemSaldos.jsp')

        await navigationPromise

        const isNotHidden = await page.$eval('.account-ammount', (elem) => {
            return elem.innerHTML
        })

        var balanceValue = isNotHidden.replace('Saldo Contab.: ', '').replace(' EUR', '');
        console.log(balanceValue);
        //await page.screenshot({ path: screenshot })
        res.send(balanceValue);
        await browser.close()
    })()
    //res.send({ hello: "world2" });
});

app.get("/getAccountSavingsBalance", (req, res) => {
    (async () => {
        // const browser = await puppeteer.launch({ headless: false })
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
        const page = await browser.newPage()

        await page.setViewport({ width: 1920, height: 1080 })
        await page.goto('https://m.bancomontepio.pt/netmovel24/login.jsp')

        const navigationPromise = page.waitForNavigation()

        await page.type('#username', '3741896')
        await page.type('#password', '691412')
        // await page.click('#form1 > div.ui-submit.ui-btn.ui-shadow.ui-btn-corner-all.ui-btn-up-a > input')
        // await navigationPromise

        var anchorLogin = await page.$('#form1 > div.ui-submit.ui-btn.ui-shadow.ui-btn-corner-all.ui-btn-up-a > input')
        await page.evaluate(e => e.click(), anchorLogin);

        await navigationPromise


        await page.goto('https://m.bancomontepio.pt/netmovel24/func/poupancas/consultaMovimentosPoupancasResultado.jsp')

        await navigationPromise



        var anchorGo = await page.$('#continuar')
        await page.evaluate(e => e.click(), anchorGo);

        await navigationPromise

        await page.waitFor(1000)

        const isNotHidden = await page.$eval('#form1 > div.simple-box > dl > dd:nth-child(4)', (elem) => {
            return elem.innerHTML
        })

        var balanceValue = isNotHidden.replace('Saldo Contab.: ', '').replace(' EUR', ' Euros');
        console.log(balanceValue);
        //await page.screenshot({ path: screenshot })
        res.send(balanceValue);
        await browser.close()
    })()
    //res.send({ hello: "world2" });
});

app.get("/keepalive", (req, res) => {
    res.send("just keeping it real");
});

// app.listen(app.get('port'), function () {
//     console.log("Node app running at localhost:" + app.get('port'));
// });

app.get("/RequestUsersShoppingListProductsUpdatePrices", (req, res) => {
    request
        .get('http://lisie.app/api/UserLists/RequestUsersShoppingListProductsUpdatePrices')
        //.get('http://localhost:4430/api/UserLists/RequestUsersShoppingListProductsUpdatePrices')
        .on('response', function (response) {
            console.log(response.statusCode)

        })
        .on('error', function (e) {
            console.log(e);
            console.log('Error calling lisie.app/puppetter/NotifyProductsAddedToJumboOnline');
        });
    res.json({ text: 'doing the good work ;)' })
});

app.get("/lastScreenshot", (req, res) => {
    res.sendFile('/lastScreenshot.png');
});


var updatePricesSchedule = schedule.scheduleJob('20 * * * *', function (fireDate) {
    var dateNow = new Date();
    var dateCompare = new Date();
    var dateCompare2 = new Date();
    dateCompare.setHours(10, 0, 0, 0);
    dateCompare2.setHours(23, 0, 0, 0);
    if (dateNow.getTime() > dateCompare.getTime() && dateNow.getTime() < dateCompare2.getTime()) {
        console.log("### RUNNING SCHEDULE ###");
        request
            .get('http://lisie.app/api/UserLists/RequestUsersShoppingListProductsUpdatePrices')
            //.get('http://localhost:4430/api/UserLists/RequestUsersShoppingListProductsUpdatePrices')
            .on('response', function (response) {
                console.log(response.statusCode);

            });
    }
    else {
        console.log("### NOT RUNNING SCHEDULE - Too late, it's after midnight, shhhhhh..... ###");
    }
});

var saveTotalStatistics = schedule.scheduleJob('00 22 * * *', function (fireDate) {
    // var saveTotalStatistics = schedule.scheduleJob({ hour: 21, minute: 30, dayOfWeek: 7 }, function (fireDate) {
    var dateNow = new Date();
    var dateCompare = new Date();
    var dateCompare2 = new Date();
    dateCompare.setHours(10, 0, 0, 0);
    dateCompare2.setHours(23, 0, 0, 0);
    if (dateNow.getTime() > dateCompare.getTime() && dateNow.getTime() < dateCompare2.getTime()) {
        console.log("### RUNNING SCHEDULE - Save Total Statistics");
        request
            .get('http://lisie.app//Interactions/RecordCurrentTotals')
            //.get('http://localhost:4430/api/UserLists/RequestUsersShoppingListProductsUpdatePrices')
            .on('response', function (response) {
                console.log(response.statusCode);

            });
    }
    else {
        console.log("### NOT RUNNING SCHEDULE - Too late, it's after midnight, shhhhhh..... ###");
    }
});


// app.get("/getContinenteSearchResults/:search/:counter", (req, res) => {
//     var search = req.params.search;
//     var counter = req.params.counter;
//     pingoDoceResults = [];
//     res.send('Working on Pingo Doce - Mercadao.pt ;)');

//     (async () => {
//         const browser = await puppeteer.launch({
//             headless: false,
//             args: [
//                 '--user-agent=Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322)',
//                 // THIS IS THE KEY BIT!
//                 '--lang=en-US,en;q=0.9',
//             ]
//         })
//         // const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
//         const page = await browser.newPage()

//         page.on('console', msg => console.log(msg));

//         page.on('response', async resp => {
//             if (resp.ok) {
//                 console.log(await resp.text());
//             }
//         });

//         await page.setUserAgent("Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322)");
//         var screenshot = 'screenshotPingoDoce.png';
//         await page.setViewport({ width: 1920, height: 1080 })
//         await page.goto('https://www.continente.pt/pt-pt/public/Pages/searchresults.aspx?k=' + encodeURIComponent(search), {
//             timeout: 25000,
//             waitUntil: ['load', 'networkidle2']
//         })

//         // const navigationPromise = page.waitForNavigation()

//         await page.waitFor(50000)

//         await page.goto("https://www.continente.pt/pt-pt/public/Pages/searchresults.aspx?k=" + encodeURIComponent(search), {
//             timeout: 0
//         })
//         let bodyHTML = await page.evaluate(() => document.body.innerHTML);

//         const products = await page.$$('.productItem');
//         var finalData = [];
//         for (const product of products) {
//             var anchor = await product.$('article > a')
//             await anchor.click()
//             if (await page.$('pdo-enter-postal-code') !== null) {
//                 await page.type('#postalCode', '2610062')
//                 await page.click('pdo-enter-postal-code > div > form > div > div > div > button')
//                 await page.waitForNavigation()

//                 finalData = await getContinenteSearchResults(page, search, true, counter);
//                 break;
//             }
//             else {
//                 finalData = await getContinenteSearchResults(page, search, false, counter);
//                 break;
//             }
//         }
//         pingoDoceResults = finalData;

//         // await page.screenshot({ path: screenshot })
//         await browser.close()

//         return;
//     })()
// });

// async function getContinenteSearchResults(page, search, reload, number) {
//     if (reload) {
//         await page.goto('https://mercadao.pt/store/pingo-doce/search?queries=' + encodeURIComponent(search), {
//             timeout: 0,
//             waitUntil: ['domcontentloaded', 'networkidle0']
//         })
//     }

//     const products = await page.$$('.pdo-product-item');
//     var finalData = [];
//     var counter = 1;
//     for (const product of products) {
//         const title = await product.$('.detail-title')
//         var titleText = await page.evaluate(e => e.textContent.trim(), title)

//         const img = await product.$('.pdo-block.media')
//         var imgSrc = await page.evaluate(e => e.src, img)

//         // const price = await product.$('.detail-price')
//         //var priceValue = await page.evaluate(e => e.textContent.trim(), price)
//         const price = await product.$('article > a > div > div > h4 > pdo-product-price-tag > span')
//         var priceValue = await page.evaluate(e => e.textContent.trim(), price)

//         const priceWeight = await product.$('.pdo-text-xxs.detail-text')
//         var priceWeightText = await page.evaluate(e => e.textContent.trim(), priceWeight)

//         var priceWeightTextSpl = priceWeightText.split('|');
//         var weightText = '';
//         if (priceWeightTextSpl.length > 0) {
//             weightText = priceWeightTextSpl[0].trim();
//             priceWeightText = priceWeightTextSpl[1].trim();
//         }
//         // var anchor = await product.$('article > a')
//         //if(num % 2 == 0) continue;
//         console.log('clicking - ' + titleText)
//         //await page.waitFor(5000)
//         await page.evaluate(e => e.click(), anchor);
//         // await anchor.click()
//         // await anchor.click({delay:2500})
//         //var popupExists = await page.$('div.pdo-product') == null;
//         // console.log('selector')
//         // await page.waitForNavigation()
//         // await page.waitForSelector('div.pdo-product',  { visible: true })
//         if (counter == 1) {
//             await page.waitFor(1000)
//         } else {
//             await page.waitFor(500)
//         }
//         // await page.waitForNavigation()
//         var productUrl = page.url();
//         console.log('url of - ' + titleText + ':' + productUrl);

//         if (productUrl.indexOf('https://mercadao.pt') > -1) productUrl = productUrl.replace('https://mercadao.pt', '');
//         finalData.push({ Name: titleText, ImageUrl: imgSrc, Price: priceValue, PriceWeight: priceWeightText, Store: 'Pingo Doce', Url: productUrl, Weight: weightText });

//         if (await page.$('div.pdo-product') != null)
//             await page.click('pdo-icon-close')
//         await page.waitFor(500)

//         if (finalData.length == parseInt(number)) break;
//         counter++;
//     }
//     return await finalData;
// }

var LastSearchResult = '';

app.get("/getContinenteSearchResultsHtml/:search/:counter", (req, res) => {
    var search = req.params.search;
    LastSearchResult = search;
    var counter = req.params.counter;
    var options = {
        'method': 'GET',
        'url': 'https://www.continente.pt/pt-pt/public/Pages/searchresults.aspx?k=' + encodeURIComponent(search),
        'headers': {
            'User-Agent': ' Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36',
            'Cookie': 'rbzid=' + 'UPee4f2A2WNavYP6YKhznW0ndCOWwp2z1pjoTNvbir7I9HXd/AUtRB94AmtNSc1XoJZu/k2tio9Q37kdEqYrp7kt7eND7t4+whTo0JmWRzHFuiu8GNvFUORvHuKhB5DmaRGCB5O19OejCMJe04TXXCj6S4lsPRqbZs/PdBmk5sS/adogxECu6Afup0jl3YmRshag3UurlaWAlBAEbl/4Zq2NTz0A/fcLik5h0ZbNUKFHetQueU9FWnh21iggUD9Ll/5NbsKgSRufWAvnCyY2sLQlyuUdCWmFQTFOGmQtUM0='
        }
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        var json = {
            sucess: true,
            html: response.body
        };
        //res.json(json);
        // res.text(response.body);
        // res.sendStatus(200);
        res.send(response.body);
        //console.log(response.body);
    });
});

app.get("/getContinenteSearchResultsHtmlMyCp/:search/:counter", (req, res) => {
    var search = req.params.search;
    var counter = req.params.counter;
    var options = {
        'method': 'GET',
        'url': 'http://050d135e.ngrok.io/getContinenteSearchResultsHtml/' + encodeURIComponent(search) + "/40",
        'headers': {
            'User-Agent': ' Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36'
        }
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        var json = {
            sucess: true,
            html: response.body
        };
        //res.json(json);
        // res.text(response.body);
        // res.sendStatus(200);
        res.send(response.body);
        //console.log(response.body);
    });
});
var redirectUrlTimes = 0;
app.use((req, res, next) => {
    console.log('I run on every request!');
    if (req.path.indexOf("/70") > -1) {
        if (redirectUrlTimes == 1) return;
        redirectUrlTimes++;
        console.log("continente request key path: " + req.path);
        //console.log(req);
        console.log("Request Cookies :  ", req.cookies);

        res.status(200).end();
        var xZebraName = "";
        var xZebraValue = "";
        // Object.keys(obj);
        Object.keys(req.headers).forEach(header => {
            if (header.indexOf('x-zebra') > -1) {
                console.log(header);
                xZebraName = header;
                xZebraValue = req.headers[header];
                console.log(req.headers[header]);
            }
        });
        var options = {
            'method': 'GET',
            'url': 'https://www.continente.pt' + req.path,
            'headers': {
                'User-Agent': ' Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36'
            }
        };
        options.headers[xZebraName] = xZebraValue;
        console.log("second request options");
        console.log(options);
        console.log('making second request - ' + 'https://www.continente.pt' + req.path);
        request(options, function (error, response) {
            if (error) console.log("second request ERROR ", error);
            // var json = {
            //     sucess: true,
            //     html: response.body
            // };
            //res.json(json);
            // res.text(response.body);
            // res.sendStatus(200);
            //res.send(response.body);
            console.log("second request RESPONSE");
            //console.log(response);
            console.log("second request RESPONSE BODY, THE KEY");
            console.log(response.body);

            var optionsFinal = {
                'method': 'GET',
                'url': 'https://www.continente.pt/pt-pt/public/Pages/searchresults.aspx?k=' + encodeURIComponent(LastSearchResult),
                'headers': {
                    'User-Agent': ' Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36',
                    'Cookie': 'rbzid=' + response.body.replace('\n', '')
                }
            };
            console.log("final request options");
            console.log(optionsFinal);
            request(optionsFinal, function (error2, response2) {
                if (error2) throw new Error(error2);
                console.log("Response FINAL BODY");
                console.log(response2.body);
            });
        });
    }
    else
        next();
})


app.get("/getContinenteProductMetadataHtml/:productUrl", (req, res) => {
    var productUrl = req.params.productUrl;
    var options = {
        'method': 'GET',
        'url': 'https://www.continente.pt' + productUrl,
        'headers': {
            'User-Agent': ' Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36',
            'Cookie': 'rbzid=' + 'UPee4f2A2WNavYP6YKhznW0ndCOWwp2z1pjoTNvbir7I9HXd/AUtRB94AmtNSc1XoJZu/k2tio9Q37kdEqYrp7kt7eND7t4+whTo0JmWRzHFuiu8GNvFUORvHuKhB5DmaRGCB5O19OejCMJe04TXXCj6S4lsPRqbZs/PdBmk5sS/adogxECu6Afup0jl3YmRshag3UurlaWAlBAEbl/4Zq2NTz0A/fcLik5h0ZbNUKFHetQueU9FWnh21iggUD9Ll/5NbsKgSRufWAvnCyY2sLQlyuUdCWmFQTFOGmQtUM0='
        }
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        var json = {
            sucess: true,
            html: response.body
        };
        res.send(response.body);
    });
});

io.on('connection', (socket) => {

    console.log('user connected')

    socket.on('join', function (userNickname) {
        SocketUsers.set(userNickname.toLowerCase(), socket.client.id);
        // SendUpdateToUser(userNickname);
        //socket.broadcast.emit('userjoinedthechat', userNickname + " : has joined the chatt ");
    });


    socket.on('messagedetection', (senderNickname, messageContent) => {

        //log the message in console 

        console.log(senderNickname + " :" + messageContent)
        //create a message object 
        let message = { "message": messageContent, "senderNickname": senderNickname }
        // send the message to the client side  
        io.emit('message', message);

    });


    socket.on('disconnect', function () {
        console.log(' user has left ');
        socket.broadcast.emit("userdisconnect", " user has left ");

    });
});

function SendUpdateToUser(userName, message) {
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

app.get("/getIntermarcheSearchResults", (req, res) => {
    var searh = req.query.search;
    // res.send("Doing the work ;)");
    (async () => {
        var startDate = new Date();
        // const browser = await puppeteer.launch({ headless: false });
        const browser = await puppeteer.launch({
            args: ['--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu']
        });
        const page = await browser.newPage();

        console.log("### Starting ###");
        await page.setViewport({ width: 1920, height: 1080 })


        const navigationPromise = page.waitForNavigation()
        try {
            var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana/produit/recherche?mot=' + encodeURI(searh), {
                timeout: 25000,
                waitUntil: 'domcontentloaded',
            });

            await page.waitFor(2000);

            //list_produits_serveur
            // var responseText = await response.text();
            // var searchResults = (await page.evaluate(() => list_produits_serveur));



            const products = await page.$$('#content > div > section.ombre3.inline.liste_produits_mae > div.content_vignettes.js-vignette_recherche > ul > li');

            var finalData = [];
            for (const product of products) {
                var title = await product.$('.vignette_info');
                var titlePlist = await title.$$('p');
                var titleText = await page.evaluate(e => e.textContent.trim(), titlePlist[1]);

                var brand = await title.$('.js-marque');
                var brandText = await page.evaluate(e => e.textContent.trim(), brand);

                const weight = await title.$('.vignette_produit_quantite')
                var weightText = await page.evaluate(e => e.textContent.trim(), weight)

                var divId = await product.$('.vignette_footer');
                var _id = await page.evaluate((obj) => {
                    return obj.getAttribute('idproduit');
                }, divId);

                //inject ID
                const scriptHandle = await page.addScriptTag({ content: 'var _productId = ' + parseInt(_id) + ';' });
                var filteredId = (await page.evaluate(() => list_produits_serveur.filter(function (item) {
                    return item.list_product_id == _productId;
                })));

                var imageUrl = filteredId[0].list_product_url_picture;
                var price = filteredId[0].list_product_unitprice_ati + "€";
                var url = "/" + filteredId[0].list_product_id;


                const priceWeight = await product.$('.vignette_prix');
                var priceWeightPlist = await priceWeight.$$('p');
                var priceWeightText = await page.evaluate(e => e.textContent.trim(), priceWeightPlist[1])

                finalData.push({ Name: titleText, OnlineProductId: _id, Brand: brandText, ImageUrl: imageUrl, Price: price, PriceWeight: priceWeightText, StoreId: 4, StoreName: 'Intermarché', Url: url, Weight: weightText });
            }

            // for (let i = 0; i < products.length; i++) {
            //     var product = products[i];
            //     console.log(product);
            //     // console.log(await product.text());
            //     const example_parent = (await product.$$('vignette_produit_quantite')); // Element Parent

            //     const tweet = await (awaitexample_parent.getProperty('innerText')).jsonValue();
            //     // const tweet = await (await tweets[i].getProperty('innerText')).jsonValue();
            //     console.log(tweet);
            // }

            // console.log(responseText);
            await page.close()
            await browser.close()
            res.json(finalData);
            return;
        } catch (error) {
            console.log("### Erro a aceder ao Intermarche ###", error);
            return;
        }
    })()
});

app.get("/getIntermarcheProductMetadata/:idProduit", (req, res) => {
    // res.send("Doing the work ;)");
    intermarcheProductResult = {};
    (async () => {
        var startDate = new Date();
        // const browser = await puppeteer.launch({ headless: false });
        const browser = await puppeteer.launch({
            args: ['--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu']
        });
        const page = await browser.newPage();

        console.log("### Starting ###");
        await page.setViewport({ width: 1920, height: 1080 })


        // var response = await page.goto('https://lojaonline.intermarche.pt/62-arco-do-cego', {
        //     timeout: 25000,
        //     waitUntil: 'domcontentloaded',
        // });

        var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana', {
            timeout: 25000,
            waitUntil: 'domcontentloaded',
        });

        await page.waitFor(2000);
        // page.on('request', interceptedRequest => {
        //     if (isToAddItemsToBasket) {
        //         isToAddItemsToBasket = false;
        //         var sendJson = {shopingListId:1,items : productItemsList};
        //         var data = {
        //             'method': 'POST',
        //             'Content-Type': 'application/json; charset=UTF-8',
        //             'Accept': 'application/json, text/javascript, */*; q=0.01',
        //             'postData': JSON.stringify(sendJson)
        //         };

        //         // Request modified... finish sending! 
        //         interceptedRequest.continue(data);
        //     } else {
        //         interceptedRequest.continue();
        //     }
        //     // Here, is where you change the request method and 
        //     // add your post data

        // });







        // await page.setRequestInterception(true);
        // page.on('response', async resp => {
        //     let status;
        //     let text;
        //     if (resp.status) {
        //         status = resp.status();
        //     }
        //     if (
        //         status // we actually have an status for the response
        //         && !(status > 299 && status < 400) // not a redirect
        //         && !(status === 204) // not a no-content response
        //         && !(resp.resourceType === 'image') // not an image
        //     ) {
        //         try {
        //             const req = resp.request();
        //             const orig = req.url();
        //             // text = await resp.text();
        //             console.log(orig);
        //             if (orig == "https://lojaonline.intermarche.pt/FicheProduit") {
        //                 const data = await response.buffer();
        //                 const jsnon2 = await response.json();
        //                 console.log(data);
        //                 console.log(jsnon2);
        //             }
        //         } catch (error) {

        //         }

        //     }
        // });

        // var sendJson = { idProduit: req.params.idProduit, idPdv: "null", trackingCode: "" };
        // page.once('request', request => {
        //     var data = {
        //         'method': 'POST',
        //         'postData': JSON.stringify(sendJson),
        //         'headers': {
        //             'Content-Type': 'application/json; charset=UTF-8',
        //             'Accept': 'application/json, text/javascript, */*; q=0.01'
        //         },
        //     };

        //     request.continue(data);

        //     // Immediately disable setRequestInterception, or all other requests will hang
        //     page.setRequestInterception(false);
        // });

        // const responseProduct = await page.goto('https://lojaonline.intermarche.pt/FicheProduit', {
        //     timeout: 25000,
        //     waitUntil: 'networkidle0',
        // });

        // var textt = await responseProduct.text();
        // // const data = await response.buffer();
        // const jsnon2 = await response.json();




        const results = []; // collects all results
        var intermarcheProductResult = {};

        let paused = false;
        let pausedRequests = [];

        const nextRequest = () => { // continue the next request or "unpause"
            if (pausedRequests.length === 0) {
                paused = false;
            } else {
                // continue first request in "queue"
                (pausedRequests.shift())(); // calls the request.continue function
            }
        };

        await page.setRequestInterception(true);
        page.on('request', request => {
            var sendJson = { idProduit: req.params.idProduit, idPdv: "null", trackingCode: "" };
            if (paused) {
                if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
                    var data = {
                        'method': 'POST',
                        'postData': JSON.stringify(sendJson),
                        'headers': {
                            'Content-Type': 'application/json; charset=UTF-8',
                        },
                    };

                    pausedRequests.push(() => request.continue(data));
                    page.setRequestInterception(false);
                } else {
                    pausedRequests.push(() => request.continue());
                }
            } else {
                paused = true; // pause, as we are processing a request now

                if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
                    var data = {
                        'method': 'POST',
                        'postData': JSON.stringify(sendJson),
                        'headers': {
                            'Content-Type': 'application/json; charset=UTF-8',
                            'Accept': 'application/json, text/javascript, */*; q=0.01'
                        },
                    };

                    request.continue(data);
                }
                else {
                    request.continue();
                }
            }
        });

        page.on('requestfinished', async (request) => {
            if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
                var productJson = await request.response().text();
                var product = JSON.parse(productJson);
                // product.Fiche.EAN //BARCODE????
                var productParsed = { Name: product.Fiche.LibelleCourt, Barcode: product.Fiche.Ean, Brand: product.Fiche.Marque, ImageUrl: product.Fiche.UrlImage, Price: product.Fiche.Prix, PriceWeight: product.Fiche.PrixParQuantite, StoreId: 4, StoreName: 'Intermarché', Url: '/' + product.Fiche.IdProduit, Weight: product.Fiche.Conditionnement };
                intermarcheProductResult = productParsed;
                // results.push(productJson);
            }

            const response = await request.response();

            const responseHeaders = response.headers();
            let responseBody;
            if (request.redirectChain().length === 0) {
                // body can only be access for non-redirect responses
                responseBody = await response.buffer();
            }

            const information = {
                url: request.url(),
                requestHeaders: request.headers(),
                requestPostData: request.postData(),
                responseHeaders: responseHeaders,
                responseSize: responseHeaders['content-length'],
                responseBody,
            };
            // results.push(information);

            nextRequest(); // continue with next request
        });
        page.on('requestfailed', (request) => {
            // handle failed request
            nextRequest();
        });

        await page.goto('https://lojaonline.intermarche.pt/FicheProduit', { waitUntil: 'networkidle0' });
        console.log(intermarcheProductResult);

        // await browser.close();




        // await page.waitFor(20000);
        // const navigationPromise = page.waitForNavigation()

        await page.close()
        await browser.close()
        res.json(intermarcheProductResult);
        return;
    })()
});

app.get("/getIntermarchePageProducts", (req, res) => {
    var pageUrl = req.query.pageUrl;
    // res.send("Doing the work ;)");
    (async () => {
        var startDate = new Date();
        // const browser = await puppeteer.launch({ headless: false });
        const browser = await puppeteer.launch({
            args: ['--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu']
        });
        const page = await browser.newPage();

        console.log("### Starting ###");
        await page.setViewport({ width: 1920, height: 1080 })

        const navigationPromise = page.waitForNavigation()
        try {
            var response = await page.goto('https://lojaonline.intermarche.pt' + pageUrl, {
                timeout: 25000,
                waitUntil: 'domcontentloaded',
            });

            await page.waitFor(2000);

            //list_produits_serveur
            var responseText = await response.text();
            var searchResults = (await page.evaluate(() => list_produits_serveur));

            var _searchResults = searchResults.map(function (val, index) {
                return val.list_product_id;
            })

            var _productsMetadata = [];
            for (let index = 0; index < _searchResults.length; index++) {
                const element = _searchResults[index];
                _productsMetadata.push(await getIntermarchePageProducts(browser, element, pageUrl));
            }
            res.json(_productsMetadata);
            return;
        } catch (error) {
            console.log("### Erro a aceder ao Intermarche ###", error);
            res.json("error");
            return;
        }
    })()
});

app.get("/goGetterIntermarche", (req, res) => {
    var pageUrl = req.query.pageUrl;
    // res.send("Doing the work ;)");
    (async () => {
        var startDate = new Date();
        // const browser = await puppeteer.launch({ headless: false });
        const browser = await puppeteer.launch({
            args: ['--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu']
        });
        const page = await browser.newPage();

        console.log("### Starting ###");
        await page.setViewport({ width: 1920, height: 1080 })

        var _productsMetadata = [];

        //get all categories
        var _categories = await getIntermarcheCategoriesPages(browser);
        var _toContinueGettingAfterReached = false;
        for (const _category of _categories) {
            // const navigationPromise = page.waitForNavigation()
            try {
                if (_category == "/9-sao-domingos-de-rana/rayon/lazer/presentes-de-natal/10882-livros")
                    _toContinueGettingAfterReached = true;

                if (!_toContinueGettingAfterReached) continue;

                console.log("Getting products of category - " + _category);
                var response = await page.goto('https://lojaonline.intermarche.pt' + _category, {
                    timeout: 25000,
                    waitUntil: 'domcontentloaded',
                });

                await page.waitFor(2000);

                //list_produits_serveur
                var responseText = await response.text();
                var searchResults = (await page.evaluate(() => list_produits_serveur));

                var _searchResults = searchResults.map(function (val, index) {
                    return val.list_product_id;
                })

                //ckeck wich search results id´s already exust on db
                // request.post({
                //     // url: 'https://lisie.app/api/ProductsApi/PostNewIntermarcheGoGetter',
                //     url: 'http://localhost:4430/api/ProductsGhost/IntermarcheProductsIdExists',
                //     body: _searchResults,
                //     json: true
                // }, function (error, response, body) {
                //     console.log("Products of category not found on db");
                //     console.log(body);
                // });

                for (let index = 0; index < _searchResults.length; index++) {
                    const element = _searchResults[index];
                    var _productMetadata = await getIntermarchePageProducts(browser, element);
                    _productsMetadata.push(_productMetadata);

                    //Add to Lisie DB
                    request.post({
                        // url: 'https://lisie.app/api/ProductsApi/PostNewIntermarcheGoGetter',
                        url: 'http://localhost:4430/api/ProductsApi/PostNewIntermarcheGoGetter',
                        body: _productMetadata,
                        json: true
                    }, function (error, response, body) {
                        console.log("Product " + _productMetadata.Name + " added to Lisie DB");
                        console.log(body);
                    });

                    await page.waitFor(2000);
                }
                await page.waitFor(8000);

            } catch (error) {
                console.log("### Erro a aceder ao Intermarche ###", error);
                return;
            }
        }
        res.json(_productsMetadata);
        return;
    })()
});

async function getIntermarcheCategoriesPages(browser) {

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 })

        // var response = await page.goto('https://lojaonline.intermarche.pt/62-arco-do-cego', {
        //     timeout: 25000,
        //     waitUntil: 'domcontentloaded',
        // });
        var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana', {
            timeout: 25000,
            waitUntil: 'domcontentloaded',
        });

        await page.waitFor(2000);
        // const _categories = []; // collects all results
        var _categoriesFinal = [];

        //IMPORTAT - page DOM hml source
        // const data = await page.evaluate(() => document.querySelector('*').outerHTML);
        // console.log(data);

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
        return _categoriesFinal;
    }
}

async function getIntermarchePageProducts(browser, idProduit, pageUrl) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 })

    // var response = await page.goto('https://lojaonline.intermarche.pt/62-arco-do-cego', {
    //     timeout: 25000,
    //     waitUntil: 'domcontentloaded',
    // });
    var _url = (pageUrl != undefined) ?
        'https://lojaonline.intermarche.pt' + pageUrl :
        'https://lojaonline.intermarche.pt/9-sao-domingos-de-rana';

    var response = await page.goto(_url, {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
    });
    // var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana/rayon/frescos/legumes/10136-ervas-aromaticas', {
    //     timeout: 25000,
    //     waitUntil: 'domcontentloaded',
    // });

    await page.waitFor(2000);
    const results = []; // collects all results
    var intermarcheProductResult = {};

    let paused = false;
    let pausedRequests = [];

    const nextRequest = () => { // continue the next request or "unpause"
        if (pausedRequests.length === 0) {
            paused = false;
        } else {
            // continue first request in "queue"
            (pausedRequests.shift())(); // calls the request.continue function
        }
    };

    await page.setRequestInterception(true);
    page.on('request', request => {
        var sendJson = { idProduit: idProduit, idPdv: "null", trackingCode: "" };
        if (paused) {
            if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
                var data = {
                    'method': 'POST',
                    'postData': JSON.stringify(sendJson),
                    'headers': {
                        'Content-Type': 'application/json; charset=UTF-8',
                    },
                };

                pausedRequests.push(() => request.continue(data));
                page.setRequestInterception(false);
            } else {
                pausedRequests.push(() => request.continue());
            }
        } else {
            paused = true; // pause, as we are processing a request now

            if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
                var data = {
                    'method': 'POST',
                    'postData': JSON.stringify(sendJson),
                    'headers': {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Accept': 'application/json, text/javascript, */*; q=0.01'
                    },
                };

                request.continue(data);
            }
            else {
                request.continue();
            }
        }
    });

    page.on('requestfinished', async (request) => {
        if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
            var productJson = await request.response().text();
            var product = JSON.parse(productJson);

            // product.Fiche.EAN //BARCODE????
            var productParsed = { Name: product.Fiche.LibelleCourt, Barcode: product.Fiche.Ean, OnlineProductId: product.Fiche.IdProduit, Category: product.Fiche.Rayon, Brand: product.Fiche.Marque, ImageUrl: product.Fiche.UrlImage, Price: product.Fiche.Prix, PriceWeight: product.Fiche.PrixParQuantite, StoreId: 4, StoreName: 'Intermarché', Url: '/' + product.Fiche.IdProduit, Weight: product.Fiche.Conditionnement };
            intermarcheProductResult = productParsed;
            // results.push(productJson);
        }

        const response = await request.response();

        const responseHeaders = response.headers();
        let responseBody;
        if (request.redirectChain().length === 0) {
            // body can only be access for non-redirect responses
            responseBody = await response.buffer();
        }

        const information = {
            url: request.url(),
            requestHeaders: request.headers(),
            requestPostData: request.postData(),
            responseHeaders: responseHeaders,
            responseSize: responseHeaders['content-length'],
            responseBody,
        };
        // results.push(information);

        nextRequest(); // continue with next request
    });
    page.on('requestfailed', (request) => {
        // handle failed request
        nextRequest();
    });

    await page.goto('https://lojaonline.intermarche.pt/FicheProduit', { waitUntil: 'networkidle0' });
    console.log(intermarcheProductResult);

    await page.close()
    return intermarcheProductResult;
}

///PINGO DOCE - Go Getter
app.get("/goGetterPingoDoce", (req, res) => {
    res.send("Ghost Getter doing it´s wizardry on Pingo Doce online store");
    // res.send("Doing the work ;)");
    (async () => {
        var startDate = new Date();
        // const browser = await puppeteer.launch({ headless: false });
        const browser = await puppeteer.launch({
            args: ['--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu']
        });
        const page = await browser.newPage();

        console.log("### Starting ###");
        await page.setViewport({ width: 1920, height: 1080 })

        var _productsMetadata = [];

        //get all categories
        var _categories = await getPingoDoceCategoriesPages(browser);
        var _toContinueGettingAfterReached = false;
        for (const _category of _categories) {
            // console.log(_category.id);
            // if(_category.id != "5b2d35f0f8bef3001f44c541") continue;
            // const navigationPromise = page.waitForNavigation()
            try {
                // if (_category == "/9-sao-domingos-de-rana/rayon/casa/escritorio/10638-desenho-e-pintura")
                //     _toContinueGettingAfterReached = true;

                // if (!_toContinueGettingAfterReached) continue;

                console.log("Getting products of categoryId - " + _category.id);
                var _url = "https://mercadao.pt/api/catalogues/5b2d35b85ce104001af36fca/products/search?filter={\"from\":0,\"mainCategoriesIds\":[\"" + _category.id + "\"],\"sort\":0,\"size\":1000,\"esPreference\":0.6900572617558458}";
                var response = await page.goto(_url, {
                    timeout: 25000,
                    waitUntil: 'domcontentloaded',
                });
                // var response = await page.goto("https://mercadao.pt/api/catalogues/5b2d35b85ce104001af36fca/products/search?filter=%7B%22from%22:0,%22mainCategoriesIds%22:%5B%" + _categoryId + "%22%5D,%22sort%22:0,%22size%22:100,%22esPreference%22:0.6900572617558458%7D", {
                //     timeout: 25000,
                //     waitUntil: 'domcontentloaded',
                // });

                // await page.waitFor(2000);

                //list_produits_serveur
                var responseText = await response.text();
                var _categoryProducts = JSON.parse(removeTags(responseText));

                if (_categoryProducts.sections.null != undefined) {
                    for (const _product of _categoryProducts.sections.null.products) {

                        var _productData = _product._source;
                        // if(_productData.firstName != "Leite UHT Meio Gordo Matinal") continue;
                        var _priceWeight = Math.round((_productData.netContent * _productData.buyingPrice + Number.EPSILON) * 100) / 100

                        var _productParsed = {
                            Name: _productData.firstName,
                            Barcode: (_productData.eans.length > 1) ? _productData.eans[_productData.eans.length - 1] : _productData.eans[0],
                            OnlineProductId: _product._id,
                            Category: _category.name,
                            Brand: _productData.brand.name,
                            ImageUrl: "https://res.cloudinary.com/fonte-online/image/upload/c_fill,h_300,q_auto,w_300/v1/PDO_PROD/" + _productData.sku + "_1",
                            Price: _productData.buyingPrice.toString(),
                            PriceWeight: _priceWeight + ' €/' + _productData.netContentUnit.substring(0, _productData.netContentUnit.length - 1),
                            StoreId: 3,
                            StoreName: 'Pingo Doce',
                            Url: '/api/catalogues/5b2d35b85ce104001af36fca/product/' + _productData.slug,
                            ViewableUrl: '/api/catalogues/5b2d35b85ce104001af36fca/product/' + _productData.slug,
                            Weight: _productData.capacity
                        };


                        // netContent:0.42
                        // netContentUnit:
                        await new Promise(resolve => setTimeout(resolve, 500));
                        request.post({
                            // url: 'https://lisie.app/api/ProductsApi/PostNewIntermarcheGoGetter',
                            url: 'http://localhost:4430/api/ProductsApi/PostNewIntermarcheGoGetter',
                            body: _productParsed,
                            json: true
                        }, function (error, response, body) {
                            console.log("Product " + _productParsed.Name + " added to Lisie DB");
                            console.log(body);
                        });

                        // await page.waitFor(2000);
                    }
                }
                // var _searchResults = searchResults.map(function (val, index) {
                //     return val.list_product_id;
                // })

                // for (let index = 0; index < _searchResults.length; index++) {
                //     const element = _searchResults[index];
                //     var _productMetadata = await getIntermarchePageProducts(browser, element);
                //     _productsMetadata.push(_productMetadata);

                //     //Add to Lisie DB
                //     request.post({
                //         // url: 'https://lisie.app/api/ProductsApi/PostNewIntermarcheGoGetter',
                //         url: 'http://localhost:4430/api/ProductsApi/PostNewIntermarcheGoGetter',
                //         body: _productMetadata,
                //         json: true
                //     }, function (error, response, body) {
                //         console.log("Product " + _productMetadata.Name + " added to Lisie DB");
                //         console.log(body);
                //     });

                //     await page.waitFor(2000);
                // }
                await page.waitFor(1000);

            } catch (error) {
                console.log("### Erro a aceder ao Intermarche ###", error);
                return;
            }
        }
        // res.json(_productsMetadata);
        return;
    })()
});

async function getPingoDoceCategoriesPages(browser) {

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 })

        // var response = await page.goto('https://lojaonline.intermarche.pt/62-arco-do-cego', {
        //     timeout: 25000,
        //     waitUntil: 'domcontentloaded',
        // });
        var response = await page.goto('https://mercadao.pt/api/catalogues/5b2d35b85ce104001af36fca/with-descendants', {
            timeout: 25000,
            waitUntil: 'domcontentloaded',
        });

        // await page.waitFor(2000);
        // const _categories = []; // collects all results
        var _categoriesFinal = [];

        //IMPORTAT - page DOM hml source
        const data = await page.evaluate(() => document.querySelector('*').outerHTML);
        // console.log(data);

        var _obj = JSON.parse(removeTags(data));

        var _categoriesId = [];
        var _properties = Object.getOwnPropertyNames(_obj.tree);
        for (const _propertyName of _properties) {
            var _property = _obj.tree[_propertyName];
            if (_property.children != undefined) {
                var _propertiesChildren = Object.getOwnPropertyNames(_property.children);
                for (const _propertyChildrenName of _propertiesChildren) {
                    var _propertyChildren = _property.children[_propertyChildrenName];
                    _categoriesId.push(_propertyChildren);
                }
            }
            else
                _categoriesId.push(_property);
        }
        // var _categories = await page.$$('.vignette_produit_info');
        // var _categories = await page.$$("#main > nav > ul > li.separateur > nav > div > div > ul > li > a");

        // for (const _category of _categories) {
        //     //IMPORTANT - get href of anchor
        //     const _categoryHref = await page.evaluate(anchor => anchor.getAttribute('href'), _category);
        //     _categoriesFinal.push(_categoryHref);
        // }

        console.log(_categoriesId);
        await page.close();
        return _categoriesId;
    } catch (error) {
        console.log(error);
        return _categoriesFinal;
    }
}
function removeTags(str) {
    if ((str === null) || (str === ''))
        return false;
    else
        str = str.toString();
    return str.replace(/(<([^>]+)>)/ig, '');
}
async function getPingoDoceCategoryProducts(browser, idProduit, pageUrl) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 })

    // var response = await page.goto('https://lojaonline.intermarche.pt/62-arco-do-cego', {
    //     timeout: 25000,
    //     waitUntil: 'domcontentloaded',
    // });
    var _url = (pageUrl != undefined) ?
        'https://lojaonline.intermarche.pt' + pageUrl :
        'https://lojaonline.intermarche.pt/9-sao-domingos-de-rana';

    var response = await page.goto(_url, {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
    });
    // var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana/rayon/frescos/legumes/10136-ervas-aromaticas', {
    //     timeout: 25000,
    //     waitUntil: 'domcontentloaded',
    // });

    await page.waitFor(2000);
    const results = []; // collects all results
    var intermarcheProductResult = {};

    let paused = false;
    let pausedRequests = [];

    const nextRequest = () => { // continue the next request or "unpause"
        if (pausedRequests.length === 0) {
            paused = false;
        } else {
            // continue first request in "queue"
            (pausedRequests.shift())(); // calls the request.continue function
        }
    };

    await page.setRequestInterception(true);
    page.on('request', request => {
        var sendJson = { idProduit: idProduit, idPdv: "null", trackingCode: "" };
        if (paused) {
            if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
                var data = {
                    'method': 'POST',
                    'postData': JSON.stringify(sendJson),
                    'headers': {
                        'Content-Type': 'application/json; charset=UTF-8',
                    },
                };

                pausedRequests.push(() => request.continue(data));
                page.setRequestInterception(false);
            } else {
                pausedRequests.push(() => request.continue());
            }
        } else {
            paused = true; // pause, as we are processing a request now

            if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
                var data = {
                    'method': 'POST',
                    'postData': JSON.stringify(sendJson),
                    'headers': {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Accept': 'application/json, text/javascript, */*; q=0.01'
                    },
                };

                request.continue(data);
            }
            else {
                request.continue();
            }
        }
    });

    page.on('requestfinished', async (request) => {
        if (request.url() == "https://lojaonline.intermarche.pt/FicheProduit") {
            var productJson = await request.response().text();
            var product = JSON.parse(productJson);

            // product.Fiche.EAN //BARCODE????
            var productParsed = { Name: product.Fiche.LibelleCourt, Barcode: product.Fiche.Ean, OnlineProductId: product.Fiche.IdProduit, Category: product.Fiche.Rayon, Brand: product.Fiche.Marque, ImageUrl: product.Fiche.UrlImage, Price: product.Fiche.Prix, PriceWeight: product.Fiche.PrixParQuantite, StoreId: 4, StoreName: 'Intermarché', Url: '/' + product.Fiche.IdProduit, Weight: product.Fiche.Conditionnement };
            intermarcheProductResult = productParsed;
            // results.push(productJson);
        }

        const response = await request.response();

        const responseHeaders = response.headers();
        let responseBody;
        if (request.redirectChain().length === 0) {
            // body can only be access for non-redirect responses
            responseBody = await response.buffer();
        }

        const information = {
            url: request.url(),
            requestHeaders: request.headers(),
            requestPostData: request.postData(),
            responseHeaders: responseHeaders,
            responseSize: responseHeaders['content-length'],
            responseBody,
        };
        // results.push(information);

        nextRequest(); // continue with next request
    });
    page.on('requestfailed', (request) => {
        // handle failed request
        nextRequest();
    });

    await page.goto('https://lojaonline.intermarche.pt/FicheProduit', { waitUntil: 'networkidle0' });
    console.log(intermarcheProductResult);

    await page.close()
    return intermarcheProductResult;
}
server.listen(app.get('port'), () => {
    console.log('Node app is running on port ' + app.get('port'));
});

app.get("/addProductsToIntermarche", (req, res) => {
    var jsonBody = req.body;
    var userId = req.params.userId;

    // res.send("Doing the work ;)");
    (async () => {
        try {
            var startDate = new Date();
            const browser = await puppeteer.launch({ headless: false });
            // const browser = await puppeteer.launch({
            //     args: ['--no-sandbox',
            //         '--disable-setuid-sandbox',
            //         '--disable-gpu']
            // });
            const page = await browser.newPage();

            console.log("### Starting ###");
            await page.setViewport({ width: 1920, height: 1080 })


            var productsNotAdded = [];
            var productsAdded = [];

            const navigationPromise = page.waitForNavigation()

            var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana/', {
                timeout: 25000,
                waitUntil: 'domcontentloaded',
            });

            await page.waitFor(2000);

            console.log("### Authenticating ###");
            let message = { "message": "A autenticar ao Intermarché...", "sucess": "true" };
            SendUpdateToUser(userId, message);

            var anchorLogin = await page.$('#header-top > div.connexion.inline.js-bloc_connexion > div.sous_menu.js-connecter.deconnecte.cursor');
            //Not working because of click bug on website, when it´s good again, take comments
            // await clickOnElement(anchorLogin, 4);
            await page.evaluate(e => e.click(), anchorLogin);

            await page.waitFor(2000);

            var emailTxt = await page.$('#popup_connexion > div.popup_content > div:nth-child(2) > form > input.js-popup_connexion_email.inline');

            await page.type('#popup_connexion > div.popup_content > div:nth-child(2) > form > input.js-popup_connexion_email.inline', jsonBody.username)
            await page.type('#popup_connexion > div.popup_content > div:nth-child(2) > form > input.js-popup_connexion_mdp.inline', jsonBody.password)

            var _loginButton = await page.$('#popup_connexion > div.popup_content > div:nth-child(2) > form > input.js-authentifier.after_button');
            await page.evaluate(e => e.click(), _loginButton);
            // var _logiSucess = await loginToIntermarche(browser, jsonBody.username, jsonBody.password);

            // "#header-top > div.connexion.inline.js-bloc_connexion > div.sous_menu.js-connecter.deconnecte.cursor"
            // if (_logiSucess) {
            for (let index = 0; index < jsonBody.products.length; index++) {
                const product = jsonBody.products[index];
                console.log("### Adding product ###");
                console.log(product);
                try {
                    var _addProductSucess = await addProductToIntermarche(browser, product.OnlineProductId, "", 
                    function(){
                        productsAdded.push(product);
                        let message = { "message": (index + 1) + " de " + jsonBody.products.length + " produtos adicionados ao Intermarché Online", "sucess": "true" };
                        SendUpdateToUser(userId, message);
                    }, 
                    function (){
                        productsNotAdded.push(product);
                        let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
                        SendUpdateToUser(userId, message);
                    });
                    console.log(_addProductSucess);
                } catch (error) {
                    console.log("### Erro a aceder ao Intermarche ###", error);
                    continue;
                }
            }
            // }


            // await browser.close()
            var endDate = new Date();
            var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
            await page.close()
            await browser.close()
            res.json(finalData);
            return;
        } catch (error) {
            console.log("### Erro a aceder ao Intermarche ###", error);
            return;
        }
    })()
});

async function loginToIntermarche(browser, username, password) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 })

    // var response = await page.goto('https://lojaonline.intermarche.pt/62-arco-do-cego', {
    //     timeout: 25000,
    //     waitUntil: 'domcontentloaded',
    // });
    var _url = 'https://lojaonline.intermarche.pt/9-sao-domingos-de-rana';

    var response = await page.goto(_url, {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
    });
    // var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana/rayon/frescos/legumes/10136-ervas-aromaticas', {
    //     timeout: 25000,
    //     waitUntil: 'domcontentloaded',
    // });

    await page.waitFor(2000);
    const results = []; // collects all results
    var intermarcheProductResult = {};

    let paused = false;
    let pausedRequests = [];

    const nextRequest = () => { // continue the next request or "unpause"
        if (pausedRequests.length === 0) {
            paused = false;
        } else {
            // continue first request in "queue"
            (pausedRequests.shift())(); // calls the request.continue function
        }
    };

    await page.setRequestInterception(true);
    page.on('request', request => {
        var sendJson = { txtEmail: username, txtMotDePasse: password, 'largeur': '1920', 'hauteur': '1080', 'resteConnecte': 'false' };
        if (paused) {
            if (request.url() == "https://lojaonline.intermarche.pt/Connexion") {
                var data = {
                    'method': 'POST',
                    'postData': JSON.stringify(sendJson),
                    'headers': {
                        'Content-Type': 'application/json; charset=UTF-8',
                    },
                };

                pausedRequests.push(() => request.continue(data));
                page.setRequestInterception(false);
            } else {
                pausedRequests.push(() => request.continue());
            }
        } else {
            paused = true; // pause, as we are processing a request now

            if (request.url() == "https://lojaonline.intermarche.pt/Connexion") {
                var data = {
                    'method': 'POST',
                    'postData': JSON.stringify(sendJson),
                    'headers': {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Accept': 'application/json, text/javascript, */*; q=0.01'
                    },
                };

                request.continue(data);
            }
            else {
                request.continue();
            }
        }
    });

    page.on('requestfinished', async (request) => {
        if (request.url() == "https://lojaonline.intermarche.pt/Connexion") {
            var _result = await request.response().text();
            console.log('https://lojaonline.intermarche.pt/Connexion result');
            console.log(_result);
            // var product = JSON.parse(productJson);

            // var productParsed = { Name: product.Fiche.LibelleCourt, Barcode: product.Fiche.Ean, OnlineProductId: product.Fiche.IdProduit, Category: product.Fiche.Rayon, Brand: product.Fiche.Marque, ImageUrl: product.Fiche.UrlImage, Price: product.Fiche.Prix, PriceWeight: product.Fiche.PrixParQuantite, StoreId: 4, StoreName: 'Intermarché', Url: '/' + product.Fiche.IdProduit, Weight: product.Fiche.Conditionnement };
            // intermarcheProductResult = productParsed;
            // results.push(productJson);
        }

        const response = await request.response();

        const responseHeaders = response.headers();
        let responseBody;
        if (request.redirectChain().length === 0) {
            // body can only be access for non-redirect responses
            responseBody = await response.buffer();
        }

        const information = {
            url: request.url(),
            requestHeaders: request.headers(),
            requestPostData: request.postData(),
            responseHeaders: responseHeaders,
            responseSize: responseHeaders['content-length'],
            responseBody,
        };
        // results.push(information);

        nextRequest(); // continue with next request
    });
    page.on('requestfailed', (request) => {
        // handle failed request
        nextRequest();
    });

    await page.goto('https://lojaonline.intermarche.pt/Connexion', { waitUntil: 'networkidle0' });
    console.log(intermarcheProductResult);

    var _url = 'https://lojaonline.intermarche.pt/9-sao-domingos-de-rana';

    var response = await page.goto(_url, {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
    });

    // await page.close()
    return intermarcheProductResult;
}

async function addProductToIntermarche(browser, idProduit, pageUrl, productsAddedCallback, productsNotAddedCallback) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 })

    // var response = await page.goto('https://lojaonline.intermarche.pt/62-arco-do-cego', {
    //     timeout: 25000,
    //     waitUntil: 'domcontentloaded',
    // });
    var _url = 'https://lojaonline.intermarche.pt/9-sao-domingos-de-rana';

    var response = await page.goto(_url, {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
    });
    // var response = await page.goto('https://lojaonline.intermarche.pt/9-sao-domingos-de-rana/rayon/frescos/legumes/10136-ervas-aromaticas', {
    //     timeout: 25000,
    //     waitUntil: 'domcontentloaded',
    // });

    await page.waitFor(2000);
    const results = []; // collects all results
    var intermarcheProductResult = {};

    let paused = false;
    let pausedRequests = [];

    const nextRequest = () => { // continue the next request or "unpause"
        if (pausedRequests.length === 0) {
            paused = false;
        } else {
            // continue first request in "queue"
            (pausedRequests.shift())(); // calls the request.continue function
        }
    };

    await page.setRequestInterception(true);
    page.on('request', request => {
        var sendJson = { idProduit: idProduit, trackingCode: '', idSource: 4, idUniversProduitComplementaire: null };
        if (paused) {
            if (request.url() == "https://lojaonline.intermarche.pt/Plus") {
                var data = {
                    'method': 'POST',
                    'postData': JSON.stringify(sendJson),
                    'headers': {
                        'Content-Type': 'application/json; charset=UTF-8',
                    },
                };

                pausedRequests.push(() => request.continue(data));
                page.setRequestInterception(false);
            } else {
                pausedRequests.push(() => request.continue());
            }
        } else {
            paused = true; // pause, as we are processing a request now

            if (request.url() == "https://lojaonline.intermarche.pt/Plus") {
                var data = {
                    'method': 'POST',
                    'postData': JSON.stringify(sendJson),
                    'headers': {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Accept': 'application/json, text/javascript, */*; q=0.01'
                    },
                };

                request.continue(data);
            }
            else {
                request.continue();
            }
        }
    });

    page.on('requestfinished', async (request) => {
        if (request.url() == "https://lojaonline.intermarche.pt/Plus") {
            try {
                var result = await request.response().text();
                console.log('https://lojaonline.intermarche.pt/Plus result');
                console.log(result);
                if(productsAddedCallback != null) productsAddedCallback();
            } catch (error) {
                //TODO - put on products not added
                console.log(error);
                if(productsNotAddedCallback != null) productsNotAddedCallback();
            }
            // var product = JSON.parse(productJson);

            // var productParsed = { Name: product.Fiche.LibelleCourt, Barcode: product.Fiche.Ean, OnlineProductId: product.Fiche.IdProduit, Category: product.Fiche.Rayon, Brand: product.Fiche.Marque, ImageUrl: product.Fiche.UrlImage, Price: product.Fiche.Prix, PriceWeight: product.Fiche.PrixParQuantite, StoreId: 4, StoreName: 'Intermarché', Url: '/' + product.Fiche.IdProduit, Weight: product.Fiche.Conditionnement };
            // intermarcheProductResult = productParsed;
        }

        const response = await request.response();

        const responseHeaders = response.headers();
        let responseBody;
        if (request.redirectChain().length === 0) {
            // body can only be access for non-redirect responses
            responseBody = await response.buffer();
        }

        const information = {
            url: request.url(),
            requestHeaders: request.headers(),
            requestPostData: request.postData(),
            responseHeaders: responseHeaders,
            responseSize: responseHeaders['content-length'],
            responseBody,
        };
        // results.push(information);

        nextRequest(); // continue with next request
    });
    page.on('requestfailed', (request) => {
        // handle failed request
        nextRequest();
    });

    await page.goto('https://lojaonline.intermarche.pt/Plus', { waitUntil: 'networkidle0' });
    console.log(intermarcheProductResult);

    await page.close()
    return intermarcheProductResult;
}
