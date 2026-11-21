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

var auchan = require('./markets/auchan');
var continente = require('./markets/continente');
var pingoDoce = require('./markets/pingoDoce');
var intermarche = require('./markets/intermarche');

//TODO, turn with map with id, for multiple polling
var pingoDoceResults = [];
var pingoDoceProductData = {};

var requestedUsersShoppingList = ['hehehe'];

const VERSION = "1.9 - UPD: intermarche GetProductMetadata show chrome";

var fetch = require('node-fetch');
// require('log-timestamp');

var SocketUsers = new Map();

require('dotenv').config()

app.set('view engine', 'ejs'); 2
app.use(express.static('public'));
app.set('port', (process.env.PORT || 3005));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//OBSOLETE
// app.use(bodyParser.json()); // support json encoded bodies
// app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use(cookieParser());

var isToAddItemsToBasket = false;

function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function removeTags(str) {
    if ((str === null) || (str === ''))
        return false;
    else
        str = str.toString();
    return str.replace(/(<([^>]+)>)/ig, '');
}

const args = [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--lang=en-US,en"
    ];
var browser2;

var pageGlobal;

server.listen(app.get('port'), () => {
    console.log('Node app is running on port ' + app.get('port'));
    console.log('Version:' + VERSION);
});

app.get("/authenticateAuchan/:username/:password", (req, res) => {
    var jsonBody = req.body;
    var userId = req.params.userId;
    res.send("Doing the work ;)");
    (async () => {
        var startDate = new Date();
        const browser = await puppeteer.launch({ headless: false });
        // const browser = await puppeteer.launch({
        //     args: ['--no-sandbox',
        //         '--disable-setuid-sandbox',
        //         '--disable-gpu']
        // });
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

        console.log("### Starting addUserListToJumbo ###");
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



                //Try to click on Buy and see if popup appears (user needs to confirm delivery adress)
                if (index == 0 || !buyButtonFound) {
                    try {
                        var anchorLogin = await page.$('#conteudo > div.product-detail > div:nth-child(1) > div.col-md-11.col-sm-11.col-xs-12 > div > div.col-md-5.col-sm-5.col-xs-12.text-info.pull-right > div.product-btns-panel > button.btn.btn-link.large.hidden-xs', { timeout: 2500 })
                        // var anchorLogin = await page.$('#conteudo > div.product-detail > div:nth-child(1) > div.col-md-11.col-sm-11.col-xs-12 > div > div.col-md-5.col-sm-5.col-xs-12.text-info.pull-right > div.product-btns-panel > button.btn.btn-link.large.hidden-xs', { timeout: 5000 })

                        //if ancorLogin is null error opining page, add product to notAdded
                        if (anchorLogin == null) {
                            let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
                            SendUpdateToUser(userId, message);
                            productsNotAdded.push(product);
                            continue;
                        }

                        await page.evaluate(e => e.click(), anchorLogin);
                        buyButtonFound = true;
                        var modalContainerPopup = await page.waitForSelector('#deliveryMethodModal > div > div > div.modal-body > form > div > div:nth-child(2) > div.dropdown.col-xs-6', { visible: true, timeout: 2500 })
                        // var modalContainerPopup = await page.waitForSelector('#deliveryMethodModal > div > div > div.modal-body > form > div > div:nth-child(2) > div.dropdown.col-xs-6', { visible: true, timeout: 5000 })
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
                                var modalAdressContainerPopup = await page.waitForSelector('#deliveryAddress', { visible: true, timeout: 2500 })
                                // var modalAdressContainerPopup = await page.waitForSelector('#deliveryAddress', { visible: true, timeout: 5000 })
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
                                console.log('### Passing to next product, this was added while testing the delivery adress modal ###');
                                continue;
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
        }

        var endDate = new Date();
        var seconds = (endDate.getTime() - startDate.getTime()) / 1000;

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

        return;
    })()
});

app.post("/addUserListToJumbo/:userId", async (req, res) => {
    var jsonBody = req.body;
    var userId = req.params.userId;

    res.send("Doing the work ;)");
    // (async () => {
    var productsNotAdded = await auchan.addUserListToJumbo(userId, jsonBody, io, SocketUsers);
    console.log(productsNotAdded);
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

        console.log("### Starting addUserListToContinente ###");
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
            //GOOD ONE, teting the other one
            // await page.waitFor(5000);
            await page.waitFor(10000);

            //check if authentication data was wrong - testing - to uncomment in future?
            var errorOnLoginIsVisible = await page.$('#loginerror', { visible: true });
            // if (errorOnLoginIsVisible) {
            //     console.log("### Login do continente online inválido ###");
            //     let message = { "message": "Login do continente online inválido", "sucess": "true" };
            //     await page.close()
            //     await browser.close()
            //     return;
            // }

            //Testing - to uncomment in future
            // console.log("### Testing if a modal popup exists ###");
            // // var modalContainerPopup = await page.waitForSelector('#simplemodal-container', { visible: true, timeout: 5000 })
            // // var modalContainerPopup = await page.waitForSelector('#simplemodal-container', { visible: true, timeout: 15000 })
            // var modalContainerPopup = await page.waitForSelector('#simplemodal-container', { visible: true, timeout: 10000 })
            // console.log("modalContainerPopup", modalContainerPopup)

            // if (modalContainerPopup) {
            //     console.log("### Modal popup exists, closing it... ###");
            //     var anchorLogin = await page.$('#chkshowavailablecoupons')
            //     await page.evaluate(e => e.click(), anchorLogin);
            //     var anchorLogin = await page.$('#blockUIClose')
            //     await page.evaluate(e => e.click(), anchorLogin);
            // }
        } catch (error) {
            console.log("### ERROR ###");
            console.error(error);
        }


        // await navigationPromise

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

app.get("/keepalive", (req, res) => {
    res.send("just keeping it real");
});


app.get("/lastScreenshot", (req, res) => {
    res.sendFile('/lastScreenshot.png');
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
    return;
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


///
///PINGO DOCE
///
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
                        //IMPORTANT
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

app.post("/addProductsToPingoDoce/:userId", (req, res) => {
    var jsonBody = req.body;
    var userId = req.params.userId;

    res.send("Doing the work - addProductsToPingoDoce ;)");
    (async () => {
        try {
            var startDate = new Date();
            // const browser = await puppeteer.launch({ headless: false });
            const browser = await puppeteer.launch({
                args: ['--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu']
            });
            const page = await browser.newPage();

            console.log("### Starting addProductsToPingoDoce ###");
            await page.setViewport({ width: 1920, height: 1080 })


            var productsNotAdded = [];
            var productsAdded = [];

            const navigationPromise = page.waitForNavigation()

            var _loginSucess = await loginToPingoDoce(page, userId, jsonBody.username, jsonBody.password);

            if (_loginSucess) {
                message = { "message": "A adicionar produtos ao Pingo Doce...", "sucess": "true" };
                SendUpdateToUser(userId, message);

                for (let index = 0; index < jsonBody.products.length; index++) {
                    const product = jsonBody.products[index];
                    console.log("### Adding product ###" + product.Url);
                    console.log(product);
                    try {
                        // for (let indexQnt = 0; indexQnt < product.Quantity; indexQnt++) {
                        var _addProductSucess = await addProductToPingoDoce(browser, product.OnlineProductId, product.Url, product.Quantity,
                            function () {
                                productsAdded.push(product);
                                let message = { "message": (index + 1) + " de " + jsonBody.products.length + " produtos adicionados ao Pingo Doce Online", "sucess": "true" };
                                SendUpdateToUser(userId, message);
                                console.log("Product " + product.Name + " ADDED");
                            },
                            function () {
                                productsNotAdded.push(product);
                                let message = { "message": "Produto " + product.Name + " não adicionado", "sucess": "true", "type": "notAdded", "userListProductsId": product.UserProductListId };
                                SendUpdateToUser(userId, message);
                                console.log("Product " + product.Name + " NOT ADDED");
                            });
                        // }
                    } catch (error) {
                        console.log("### Erro a aceder ao Pingo Doce ###", error);
                        continue;
                    }
                }

                var endDate = new Date();
                var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
                console.log("### Time to finish addProductsToPingoDoce - " + seconds);
                await page.close()
                await browser.close()

                console.log("### Total Products ### - " + jsonBody.products.length);
                console.log("### Products Added ### - " + productsAdded.length);
                console.log("### Products not Added ### - " + productsNotAdded.length);

                message = { "message": "Processo de adicionar produtos finalizado", "sucess": "true" };
                SendUpdateToUser(userId, message);
            } else { //login uncessesflu
                let message = { "message": "Login inválido do Pingo Doce online", "sucess": "true" };
                SendUpdateToUser(userId, message);
                await page.close();
                await browser.close();
            }
            return;
        } catch (error) {
            console.log("### Erro a aceder ao Intermarché ###", error);
            let message = { "message": "Erro a aceder ao Intermarché", "sucess": "false" };
            SendUpdateToUser(userId, message);
            return;
        }
    })()
});

async function loginToPingoDoce(page, userId, username, password) {
    var response = await page.goto('https://mercadao.pt/store/pingo-doce', {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
    });

    await page.waitFor(2000);

    console.log("### Authenticating to Pingo Doce ###");
    let message = { "message": "A autenticar ao Pingo Doce...", "sucess": "true" };
    SendUpdateToUser(userId, message);

    var anchorLogin = await page.$('body > pdo-root > main > pdo-page-container > ng-component > pdo-store-navbar > pdo-navbar-layout > div.Dh6OQaaNQNrGKdaq71kCX._1JewtizL2tXW9DFj0qCo57 > pdo-container > ul > li._26bcm9B5xLGONkgoMJgTU_ > pdo-navbar-top > div > ul.QOgT5JBemhMncyQPQO93X.pdo-hidden-smp > li:nth-child(4) > a');
    await page.evaluate(e => e.click(), anchorLogin);

    await page.waitFor(2000);

    var emailTxt = await page.$('#email');

    await page.type('#email', username)
    await page.type('#password', password)

    var _loginButton = await page.$('body > pdo-root > div:nth-child(3) > ng-component > div > div > div > div > div > ng-component > pdo-login-page > form > button.pdo-button.-primary.-block');
    await page.evaluate(e => e.click(), _loginButton);
    // var _logiSucess = await loginToIntermarche(browser, jsonBody.username, jsonBody.password);

    // "#header-top > div.connexion.inline.js-bloc_connexion > div.sous_menu.js-connecter.deconnecte.cursor"
    // if (_logiSucess) {

    try {
        await page.waitFor(2500);
        //check if authentication data was wrong

        //IMPORTANT - wait for visibility
        var _loginPopup = await page.waitForSelector('body > pdo-root > div:nth-child(3) > ng-component > div > div > div > div > div > ng-component > pdo-login-page > form > button.pdo-button.-primary.-block', { visible: true, timeout: 1000 })
        console.log("loginPopup", _loginPopup)

        if (_loginPopup) {
            console.log("### Login popup exists, login invalid... ###");
            console.log("### Login do Intermarché online inválido ###");
            let message = { "message": "Login do Intermarché online inválido", "sucess": "true" };

            return false;
        }

    } catch (error) {
        console.log("### Login popup not found, login succesful, continuing.... ###");
    }
    return true;
}




app.get("/updateAchanStoresWithBarcode", async (req, res) => {
    res.send("Updating with auchan stores");
    await GetProductsWithBarcodeWithoutAuchanStore();
});


async function GetProductsWithBarcodeWithoutAuchanStore() {
    console.log('Calling http://lisie.app/api/online/GetProductsWithBarcodeWithoutAuchanStore');
    const response = await fetch('http://lisie.app/api/online/GetProductsWithBarcodeWithoutAuchanStore');
    const data = await response.json();
    await updateAchanStoresWithBarcode(data);
}

async function updateAchanStoresWithBarcode(productsIds) {
    for (let index = 0; index < productsIds.length; index++) {
        const productId = productsIds[index];
        try {
            const response = await fetch('http://lisie.app/api/online/UpdateProductWithBarcodeWithAuchanStore?productId=' + productId);
            const data = await response.text();
            console.log(data);
        } catch (error) {
            console.log(error);
        }

    }
    console.log("end");
}


//Crawlers
app.get("/goGetter", async (req, res) => {
    res.send("Doing /GoGetter ;)");
    console.log("running /GoGetter");
    await goGetter();
});


app.get("/auchanGetNewProducts", async (req, res) => {
    res.send("Doing the work /auchanGetNewProducts ;)");
    console.log("running /auchanGetNewProducts");
    await auchanGetNewProducts();
});

app.get("/continenteGetNewProducts", async (req, res) => {
    res.send("Doing the work /continenteGetNewProducts ;)");
    console.log("running /continenteGetNewProducts");
    await continenteGetNewProducts();
});

app.get("/pingoDoceGetNewProducts", async (req, res) => {
    res.send("Doing the work pingoDoceGetNewProducts ;)");
    console.log("running /pingoDoceGetNewProducts");
    await pingoDoceGetNewProducts();

});

app.get("/intermarcheGetNewProducts", async (req, res) => {
    res.send("Doing the work intermarcheGetNewProducts ;)");
    console.log("running /intermarcheGetNewProducts");
    await intermarcheGetNewProducts();
});


async function goGetter() {

    //get categories of all
    var _data = [];
    var _categoriesAuchan = await auchan.getAllCategories();
    var _categoriesContinente = await continente.getAllCategories();
    var _categoriesPingoDoce = await pingoDoce.getAllCategories();
    var _categoriesIntermarche = await intermarche.getAllCategories();
    _data.push({ StoreId: 1, StoreName: 'Auchan', Categories: _categoriesAuchan });
    _data.push({ StoreId: 2, StoreName: 'Continente', Categories: _categoriesContinente });
    // _data.push({ StoreId: 3, StoreName:'Pingo Doce',Categories: _categoriesPingoDoce });
    _data.push({ StoreId: 4, StoreName: 'Intermarché', Categories: _categoriesIntermarche });

    //get last category index for all stores
    var _largestLenght = 0;
    for (let index = 0; index < _data.length; index++) {
        const _store = _data[index];

        var _currentCategory = await fetch('http://lisie.app/api/online/GetStoreGetterLastCategory?storeId=' + _store.StoreId);
        var _currentCategoryText = await _currentCategory.text();

        //get current category index
        var _startIndex = 0;
        if (_currentCategoryText) {
            for (let y = 0; y < _store.Categories.length; y++) {
                const _categoryUrl = _store.Categories[y];
                if (_categoryUrl == _currentCategoryText) {
                    console.log("found last category, starting from there", _currentCategoryText);
                    _startIndex = y + 1;
                    break;
                }
            }
        }
        _store.CategoryStartIndex = _startIndex;
        _store.CategoryLast = _currentCategoryText;
    }


    while (true) {
        for (let index = 0; index < _data.length; index++) {
            const _store = _data[index];

            if (_store.Categories.length == 0) {
                continue;
            }
            //Check if reached the end of categories for this store
            if (_store.CategoryStartIndex == _store.Categories.length) {
                continue;
            }
            var _currentCategory = _store.Categories[_store.CategoryStartIndex];

            //get products
            var productsRequestedForAdd = await getStoreProducts(storeId, _categoryUrl);

            console.log("found ", productsRequestedForAdd.length);

            if (productsRequestedForAdd) {
                var jsonDataObj = {
                    StoreId: _store.StoreId,
                    OnlineProductIds: productsRequestedForAdd,
                };
                // var response = await fetch('http://localhost:4430/api/products/GetOnlineProductIdsNotFound', {
                var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                    method: 'POST',
                    body: JSON.stringify(jsonDataObj),
                    headers: { 'Content-Type': 'application/json' }
                });
                var _json = await response.json();
                console.log("Adding products - ", _json.length);
                console.log(_json);

                productsRequestedForAdd = await addStoreProducts(_json);
            }
            //get new products
            //add new products

            //Remove from list

            _store.Categories.splice(_store.CategoryStartIndex, 1);
            // await fetch('http://lisie.app/api/online/SetStoreGetterLastCategory?storeId=' + _store.StoreId + '&lastCategory=' + _currentCategory);
        }

        //check if all ended, if yes break
        var _allEnded = true;
        for (let index = 0; index < _data.length; index++) {
            _store = _data[index];
            if (_store.CategoryStartIndex < _store.Categories.length) {
                _allEnded = false;
                break;
            }
        }

        if (_allEnded) {
            break;
        }
        // if(_break) break;
    }
}

async function getStoreProducts(storeId, categoryUrl) {
    switch (_store.StoreId) {
        case 1:
            return await auchan.getNewProducts(categoryUrl);
        case 2:
            return await continente.getNewProducts(categoryUrl);
        case 3:
            return await pingoDoce.getNewProducts(categoryUrl);
        case 4:
            return await intermarche.getNewProducts(categoryUrl);
        default:
            break;
    }
}

async function addStoreProducts(storeId, productsOnlineId) {
    switch (_store.StoreId) {
        case 1:
            return await auchan.addNewProducts(productsOnlineId);
        case 2:
            return await continente.addNewProducts(productsOnlineId);
        case 3:
            return await pingoDoce.addNewProducts(productsOnlineId);
        case 4:
            return await intermarche.addNewProducts(productsOnlineId);
        default:
            break;
    }
}

async function auchanGetNewProducts() {
    console.log("fetching all Auchan categories");
    var _auchanCategories = await auchan.getAllCategories();
    console.log("fetching last category, to continue where we were");
    var _currentAuchanCategory = await fetch('http://lisie.app/api/online/GetStoreGetterLastCategory?storeId=1');
    // var _currentAuchanCategory = await fetch('http://localhost:4430/api/online/GetStoreGetterLastCategory?storeId=1');
    var _currentAuchanCategoryText = await _currentAuchanCategory.text();
    var productsRequestedForAdd = null;

    //get current category index
    var _startIndex = 0;
    if (_currentAuchanCategoryText) {
        for (let index = 0; index < _auchanCategories.length; index++) {
            const _categoryUrl = _auchanCategories[index];
            if (_categoryUrl == _currentAuchanCategoryText) {
                console.log("found last category, starting from there", _currentAuchanCategory);
                _startIndex = index + 1;
                break;
            }
        }
    }

    for (let index = _startIndex; index < _auchanCategories.length; index++) {
        const _categoryUrl = _auchanCategories[index];
        console.log("fetching proucts of category - ", _categoryUrl);
        // productsRequestedForAdd = await auchan.getNewProducts(page, _categoryUrl);
        productsRequestedForAdd = await auchan.getNewProducts(_categoryUrl);
        console.log("found ", productsRequestedForAdd.length);

        if (productsRequestedForAdd) {
            var jsonDataObj = {
                StoreId: 1,
                OnlineProductIds: productsRequestedForAdd,
            };
            // var response = await fetch('http://localhost:4430/api/products/GetOnlineProductIdsNotFound', {
            var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                method: 'POST',
                body: JSON.stringify(jsonDataObj),
                headers: { 'Content-Type': 'application/json' }
            });
            var _json = await response.json();
            console.log("Adding products - ", _json.length);
            console.log(_json);

            productsRequestedForAdd = await auchan.addNewProducts(_json);
        }
        console.log("finished Auchan category, saving last category to server");
        var _currentAuchanCategory = await fetch('http://lisie.app/api/online/SetStoreGetterLastCategory?storeId=1&lastCategory=' + _categoryUrl);
    }
}
async function continenteGetNewProducts() {
    console.log("fetching all Continente categories");
    var _categories = await continente.getAllCategories();
    console.log("fetching last category, to continue where we were");
    var _currentCategory = await fetch('https://lisie.app/api/online/GetStoreGetterLastCategory?storeId=2');
    // var _currentCategory = await fetch('http://localhost:4430/api/online/GetStoreGetterLastCategory?storeId=2');
    var _currentCategoryText = await _currentCategory.text();
    var productsRequestedForAdd = null;

    //get current category index
    var _startIndex = 0;
    if (_currentCategoryText) {
        for (let index = 0; index < _categories.length; index++) {
            const _categoryUrl = _categories[index];
            if (_categoryUrl == _currentCategoryText) {
                console.log("found last category, starting from there", _currentCategoryText);
                _startIndex = index + 1;
                break;
            }
        }
    }

    for (let index = _startIndex; index < _categories.length; index++) {
        const _categoryUrl = _categories[index];
        console.log("fetching proucts of category - ", _categoryUrl);
        productsRequestedForAdd = await continente.getNewProducts(_categoryUrl);
        console.log("found ", productsRequestedForAdd.length);
        if (productsRequestedForAdd) {
            var jsonDataObj = {
                StoreId: 2,
                OnlineProductIds: productsRequestedForAdd,
            };

            // var response = await fetch('http://localhost:4430/api/products/GetOnlineProductIdsNotFound', {
            var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                method: 'POST',
                body: JSON.stringify(jsonDataObj),
                headers: { 'Content-Type': 'application/json' }
            });
            var _json = await response.json();
            // console.log(_json.length);
            console.log("Adding products - ", _json.length);
            console.log(_json);


            productsRequestedForAdd = await continente.addNewProducts(_json);
        }
        console.log("finished Continente category, saving last category to server");
        // var _setCurrentCategory = await fetch('http://localhost:4430/api/online/SetStoreGetterLastCategory?storeId=2&lastCategory=' + _categoryUrl);
        var _setCurrentCategory = await fetch('https://lisie.app/api/online/SetStoreGetterLastCategory?storeId=2&lastCategory=' + _categoryUrl);
    }
}
async function pingoDoceGetNewProducts() {
    console.log("fetching all Pingo Doce categories");
    var _categories = await pingoDoce.getAllCategories();
    console.log("fetching last category, to continue where we were");
    var _currentCategory = await fetch('https://lisie.app/api/online/GetStoreGetterLastCategory?storeId=3');
    var _currentCategoryText = await _currentCategory.text();
    var productsRequestedForAdd = null;

    //get current category index
    var _startIndex = 0;
    if (_currentCategoryText) {
        for (let index = 0; index < _categories.length; index++) {
            console.log("found last category, starting from there", _currentCategoryText);
            const _categoryUrl = _categories[index];
            if (_categoryUrl.id == _currentCategoryText) {
                _startIndex = index + 1;
                break;
            }
        }
    }

    for (let index = _startIndex; index < _categories.length; index++) {
        const _categoryUrl = _categories[index];
        console.log("fetching proucts of category - ", _categoryUrl);
        productsRequestedForAdd = await pingoDoce.getNewProducts(_categoryUrl);
        console.log("found ", productsRequestedForAdd.length);
        if (productsRequestedForAdd) {
            var jsonDataObj = {
                StoreId: 3,
                OnlineProductIds: productsRequestedForAdd,
            };
            var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                method: 'POST',
                body: JSON.stringify(jsonDataObj),
                headers: { 'Content-Type': 'application/json' }
            });
            var _json = await response.json();
            console.log("Adding products - ", _json.length);
            console.log(_json);

            productsRequestedForAdd = await pingoDoce.addNewProducts(_json);
        }
        var _setCurrentCategory = await fetch('https://lisie.app/api/online/SetStoreGetterLastCategory?storeId=3&lastCategory=' + _categoryUrl.id);
    }
}
async function intermarcheGetNewProducts() {
    console.log("fetching all Intermarché categories");
    var _categories = await intermarche.getAllCategories();
    console.log("fetching last category, to continue where we were");
    var _currentCategory = await fetch('https://lisie.app/api/online/GetStoreGetterLastCategory?storeId=4');
    // var _currentCategory = await fetch('http://localhost:4430/api/online/GetStoreGetterLastCategory?storeId=2');
    var _currentCategoryText = await _currentCategory.text();
    var productsRequestedForAdd = null;

    //get current category index
    var _startIndex = 0;
    if (_currentCategoryText) {
        for (let index = 0; index < _categories.length; index++) {
            const _categoryUrl = _categories[index];
            if (_categoryUrl == _currentCategoryText) {
                console.log("found last category, starting from there", _currentCategoryText);
                _startIndex = index + 1;
                break;
            }
        }
    }

    for (let index = _startIndex; index < _categories.length; index++) {
        const _categoryUrl = _categories[index];
        console.log("fetching proucts of category - ", _categoryUrl);
        productsRequestedForAdd = await intermarche.getNewProducts(_categoryUrl);
        console.log("found ", productsRequestedForAdd.length);
        if (productsRequestedForAdd) {
            var jsonDataObj = {
                StoreId: 4,
                OnlineProductIds: productsRequestedForAdd,
            };
            // var response = await fetch('http://localhost:4430/api/products/GetOnlineProductIdsNotFound', {
            var response = await fetch('https://lisie.app/api/products/GetOnlineProductIdsNotFound', {
                method: 'POST',
                body: JSON.stringify(jsonDataObj),
                headers: { 'Content-Type': 'application/json' }
            });
            var _json = await response.json();
            // console.log(_json.length);
            console.log("Adding products - ", _json.length);
            console.log(_json);


            productsRequestedForAdd = await intermarche.addNewProducts(_json);
        }
        console.log("finished Intermarché category, saving last category to server");
        // var _setCurrentCategory = await fetch('http://localhost:4430/api/online/SetStoreGetterLastCategory?storeId=2&lastCategory=' + _categoryUrl);
        var _setCurrentCategory = await fetch('https://lisie.app/api/online/SetStoreGetterLastCategory?storeId=4&lastCategory=' + _categoryUrl);
    }
}
//End of Crawlers



app.get("/auchanAddMyProducts", async (req, res) => {

    var _myProducts = await fetch('https://lisie.app/api/online/GetAllStoreProductsToAddToOnlineStoreCart?userid=9ff8224f-17cf-49fb-b555-05779a13eb40&storeId=1');
    var _myProductsJson = await _myProducts.text();

    var _productsToAdd = JSON.parse(_myProductsJson);

    var _data = {
        products: _productsToAdd,
        username: '2alexandresalsinha@gmail.com',
        password: '1234Qwrefdsa'
    }

    res.send("Doing the work ;)");
    // (async () => {
    var productsNotAdded = await auchan.addUserListToJumbo('9ff8224f-17cf-49fb-b555-05779a13eb40', _data, io, SocketUsers);
    console.log(productsNotAdded);

});

app.get("/continenteAddMyProducts", async (req, res) => {

    var _myProducts = await fetch('https://lisie.app/api/online/GetAllStoreProductsToAddToOnlineStoreCart?userid=9ff8224f-17cf-49fb-b555-05779a13eb40&storeId=2');
    var _myProductsJson = await _myProducts.text();

    var _productsToAdd = JSON.parse(_myProductsJson);

    var _data = {
        products: _productsToAdd,
        username: 'alexandresalsinha@gmail.com',
        password: '1234qwrefdsa'
    }

    res.send("Doing the work ;)");
    // (async () => {
    var productsNotAdded = await continente.addUserList('9ff8224f-17cf-49fb-b555-05779a13eb40', _data, io, SocketUsers);
    console.log(productsNotAdded);

});

app.get("/AddUserProductsToOnlineCarts", async (req, res) => {
    res.send("Doing the work ;)");
    var _storeIds = req.query["storeIds"];
    var _userId = req.query["userId"];
    console.log("Calling /api/online/GetStoresProductsToAddToOnlineStoreCart")
    var _myProducts = await fetch('https://lisie.app/api/online/GetStoresProductsToAddToOnlineStoreCart?userid=' + _userId + '&storeIds=' + _storeIds);
    var _myProductsJson = await _myProducts.text();
    var _storesProductsToAdd = JSON.parse(_myProductsJson);
    console.log("_storesProductsToAdd", _storesProductsToAdd);

    var productsNotAdded = [];
    for (let index = 0; index < _storesProductsToAdd.length; index++) {
        const _storeProductsToAdd = _storesProductsToAdd[index];

        switch (_storeProductsToAdd.StoreId) {
            case 1:
                // break;
                var _data = {
                    products: _storeProductsToAdd.Products,
                    username: '2alexandresalsinha@gmail.com',
                    password: '1234Qwrefdsa'
                }
                var _auchanProductsNotAdded = await auchan.addUserList(_userId, _data, io, SocketUsers);
                console.log("Auchan products not added");
                console.log(_auchanProductsNotAdded);
                productsNotAdded = productsNotAdded.concat(_auchanProductsNotAdded);
                break;
            case 2:
                var _data = {
                    products: _storeProductsToAdd.Products,
                    username: 'alexandresalsinha@gmail.com',
                    password: '1234qwrefdsa'
                }
                var _continenteProductsNotAdded = await continente.addUserList(_userId, _data, io, SocketUsers);
                console.log("Continent products not added");
                console.log(_continenteProductsNotAdded);
                productsNotAdded = productsNotAdded.concat(_continenteProductsNotAdded);
                break;
            default:
                break;
        }
    }
});

app.post("/AddUserProductsToOnlineCartsV2", async (req, res) => {
    var jsonBody = req.body;
    res.send("Doing the work ;)");

    var _userId = jsonBody.UserId;
    var _finishedStores = {
        UserId: _userId,
        FinishedStores: []
    }
    for (let index = 0; index < jsonBody.Stores.length; index++) {
        const _storeProductsToAdd = jsonBody.Stores[index];

        switch (_storeProductsToAdd.StoreId) {
            case 1:
                var _data = {
                    products: _storeProductsToAdd.Products,
                    username: _storeProductsToAdd.Username,
                    password: _storeProductsToAdd.Password
                }
                var _auchanProductsNotAdded = await auchan.addUserList(_userId, _data, io, SocketUsers);
                console.log("Auchan products not added");
                console.log(_auchanProductsNotAdded);
                _finishedStores.FinishedStores.push({
                    StoreId: _storeProductsToAdd.StoreId,
                    StoreName: _storeProductsToAdd.StoreName,
                    Success: _auchanProductsNotAdded !== null ? true : false,
                    ProductsNotAdded: _auchanProductsNotAdded !== null ? _auchanProductsNotAdded : []
                });
                break;
            case 2:
                var _data = {
                    products: _storeProductsToAdd.Products,
                    username: _storeProductsToAdd.Username,
                    password: _storeProductsToAdd.Password
                }
                var _continenteProductsNotAdded = await continente.addUserList(_userId, _data, io, SocketUsers);
                console.log("Continent products not added");
                console.log(_continenteProductsNotAdded);
                _finishedStores.FinishedStores.push({
                    StoreId: _storeProductsToAdd.StoreId,
                    StoreName: _storeProductsToAdd.StoreName,
                    Success: _continenteProductsNotAdded !== null ? true : false,
                    ProductsNotAdded: _continenteProductsNotAdded !== null ? _continenteProductsNotAdded : []
                });
                break;
            default:
                break;
        }
    }
    console.log(JSON.stringify(_finishedStores));
    var response = await fetch('https://lisie.app/api/Notifications/FinishedAddingProductsToOnlineStore', {
        method: 'POST',
        body: JSON.stringify(_finishedStores),
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.text();
});

async function AddUserProductsToOnlineCartsV2mine() {
    //first request prices updates
    var _storeIds = '1,2';
    var _userId = '9ff8224f-17cf-49fb-b555-05779a13eb40';
    

    console.log("Updating prices for user:", _userId);
    // var _updatePrices = await fetch('https://lisie.app/api/UserLists/UpdateUserProducts?userid=' + _userId);
    // console.log("Prices update response:", _updatePrices);
    // return;
    
    var _myProducts = await fetch('https://lisie.app/api/online/GetStoresProductsToAddToOnlineStoreCart?userid=' + _userId + '&storeIds=' + _storeIds);
    // var _myProducts = await fetch('http://localhost:4430/api/online/GetStoresProductsToAddToOnlineStoreCart?userid=' + _userId + '&storeIds=' + _storeIds);
    var _myProductsJson = await _myProducts.text();
    var _storesProductsToAdd = JSON.parse(_myProductsJson);
    console.log("_storesProductsToAdd", _storesProductsToAdd);

    var _finishedStores = {
        UserId: _userId,
        FinishedStores: []
    }
    for (let index = 0; index < _storesProductsToAdd.length; index++) {
        const _storeProductsToAdd = _storesProductsToAdd[index];

        switch (_storeProductsToAdd.StoreId) {
            case 1:
                // break;
                var _data = {
                    products: _storeProductsToAdd.Products,
                    username: '2alexandresalsinha@gmail.com',
                    password: '1234Qwrefdsa'
                }
                var _auchanProductsNotAdded = await auchan.addUserList(_userId, _data, io, SocketUsers);
                console.log("### Auchan products not added ###");
                console.log(_auchanProductsNotAdded);
                console.log(JSON.stringify(_auchanProductsNotAdded));
                _finishedStores.FinishedStores.push({
                    StoreId: _storeProductsToAdd.StoreId,
                    StoreName: _storeProductsToAdd.StoreName,
                    Success: _auchanProductsNotAdded !== null ? true : false,
                    ProductsNotAdded: _auchanProductsNotAdded !== null ? _auchanProductsNotAdded : []
                });
                break;
            case 2:
                // break;
                var _data = {
                    products: _storeProductsToAdd.Products,
                    username: 'alexandresalsinha@gmail.com',
                    password: '1234qwrefdsa'
                }
                var _continenteProductsNotAdded = await continente.addUserList(_userId, _data, io, SocketUsers);
                console.log("### Continent products not added ###");
                console.log(_continenteProductsNotAdded);
                console.log(JSON.stringify(_continenteProductsNotAdded));
                _finishedStores.FinishedStores.push({
                    StoreId: _storeProductsToAdd.StoreId,
                    StoreName: _storeProductsToAdd.StoreName,
                    Success: _continenteProductsNotAdded !== null ? true : false,
                    ProductsNotAdded: _continenteProductsNotAdded !== null ? _continenteProductsNotAdded : []
                });
                break;
            default:
                break;
        }
        // if (index < _storesProductsToAdd.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10000));
        // }
    }
    console.log(JSON.stringify(_finishedStores));
    var response = await fetch('https://lisie.app/api/Notifications/FinishedAddingProductsToOnlineStore', {
        // var response = await fetch('http://localhost:4430/api/Notifications/FinishedAddingProductsToOnlineStore', {
        method: 'POST',
        body: JSON.stringify(_finishedStores),
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.text();
}

app.get("/AddUserProductsToOnlineCartsV2mine", async (req, res) => {
    var jsonBody = req.body;
    res.send("Doing the work ;)");
    await AddUserProductsToOnlineCartsV2mine();
});

app.get("/UpdateUserProducts", async (req, res) => {
    res.send("Doing the work ;)");
    var _userId = req.query["userId"];
    var _myProducts = await fetch('http://lisie.app/api/UserLists/GetV3?userId=' + _userId + '&list=all');
    var _myProductsJson = await _myProducts.text();

    var _products = JSON.parse(_myProductsJson);
    var productsNotAdded = [];
    ProductsPricesUpdatesTimeouts = [];

    console.log('#productIds', _products);
    for (let index = 0; index < _products.length; index++) {
        const _Product = _products[index];

        console.log('Updating prices of http://lisie.app/api/Products/UpdatePrices?productId=' + _Product.ProductId + " Product Update " + (index + 1) + " of " + _products.length);
        var _updateProduct = await fetch('http://lisie.app/api/Products/UpdatePrices?productId=' + _Product.ProductId);
        var _updateProductRsp = await _updateProduct.text();
        console.log(_updateProductRsp);
        // request
        // .get('http://lisie.app/api/Products/UpdatePrices?productId=' + _Product.ProductId)
        // //.get('http://localhost:4430/api/ProductsApi/UpdatePrices?productId=' + _userProduct.ProductId)
        // .on('response', function (response) {
        //     console.log(response.statusCode);
        // })
        // .on("data", function (chunk) {
        //     console.log("BODY: " + chunk);
        //     // if (index == productIds.length - 1) {
        //     //     StartPriceUpdatesOfLast(1000);
        //     // }
        // })
        // .on('error', function (e) {
        //     console.log(e);
        //     console.log('Error calling http://lisie.app/api/Products/UpdatePrices?productId=' + _Product.ProductId);
        // });
    }
});

app.get("/LoginMarket", async (req, res) => {

    var _storeId = parseInt(req.query["storeId"]);
    var _userId = req.query["userId"];
    var _username = req.query["username"];
    var _password = req.query["password"];

    switch (_storeId) {
        case 1:
            var _loginResponse = await auchan.login(_username, _password);
            res.json(_loginResponse);
            break;
        case 2:
            var _continenteLoginResponse = await continente.login(_username, _password);
            res.json(_continenteLoginResponse);
            break;
        default:
            break;
    }

});

app.get("/GetProductMetadata", async (req, res) => {

    var _storeId = parseInt(req.query["storeId"]);
    var _productUrl = req.query["url"];


    

    switch (_storeId) {
        // case 1:
        //     var _loginResponse = await auchan.login(_username, _password);
        //     res.json(_loginResponse);
        //     break;
        // case 2:
        //     var _continenteLoginResponse = await continente.login(_username, _password);
        //     res.json(_continenteLoginResponse);
        //     break;
        case 4:
            var _response = await intermarche.getProductMetadata(_productUrl, pageGlobal);
            // res.set('Content-Type', 'text/html');
            res.send(_response);
            break;
        default:
            break;
    }

});

(async () => {
    await AddUserProductsToOnlineCartsV2mine();
})();
// (async () => {
//     browser2 = await puppeteer.launch({
//         // headless: 'new',
//         headless: false,
//         devtools: false, // disable dev tools
//         ignoreHTTPSErrors: true, // ignore https error
//         args,
//         ignoreDefaultArgs: ["--disable-extensions"],
//     });
    
//     pageGlobal = await browser2.newPage();
//     // var _response = await intermarche.getProductMetadata('/product/ean/8001090134226', pageGlobal);
// })()