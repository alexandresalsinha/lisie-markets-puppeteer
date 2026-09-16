// script.js
var intermarche = require('./markets/intermarche');
const puppeteer = require('puppeteer');

// Dummy implementation for demonstration.
// Replace this with your actual getProductMetadata function.

// Get command line arguments


(async () => {
    try {
const [, , url, storeId] = process.argv;

const args = [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--lang=en-US,en"
    ];
        var browser = await puppeteer.launch({
            // headless: 'new',
            headless: false,
            devtools: false, // disable dev tools
            ignoreHTTPSErrors: true, // ignore https error
            args,
            ignoreDefaultArgs: ["--disable-extensions"],
        });

        var pageGlobal = await browser.newPage();

        const result = await intermarche.getProductMetadata(url, pageGlobal);
        // console.log('Result:', result);
           process.exit(1);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
    })();

    // if (!url || !storeId) {
    //     console.error("Usage: node script.js <url> <storeId>");
    //     process.exit(1);
    // } else  
    // {
    //        switch (storeId) {
    //               // case 1:
    //               //     var _loginResponse = await auchan.login(_username, _password);
    //               //     res.json(_loginResponse);
    //               //     break;
    //               // case 2:
    //               //     var _continenteLoginResponse = await continente.login(_username, _password);
    //               //     res.json(_continenteLoginResponse);
    //               //     break;
    //               case 4:
    //                   var _response = await intermarche.getProductMetadata(url, pageGlobal);
    //                   // res.set('Content-Type', 'text/html');
    //                 //   res.send(_response);
    //                 console.log(_response);
    //                   break;
    //               default:
    //                   break;
    //           }
    // }
