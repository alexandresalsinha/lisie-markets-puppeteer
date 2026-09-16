const puppeteer = require('puppeteer');
const fs = require('fs');

puppeteer.launch({ args: ['--no-sandbox'] }).then(async browser => {
  var myArgs = process.argv.slice(2);
  //console.log(myArgs);
  const page = await browser.newPage();
  const response = await page.goto('https://www.google.com/search?q=' + myArgs[0],{ waitUntil: ['domcontentloaded', 'networkidle0'] });
  var pageRsp = await response.text()
	fs.writeFile("d:\googleSearch.html", pageRsp, function(err) {
		if(err) {
			return console.log(err);
		}

		//console.log("The file was saved!");
	}); 
  console.log(pageRsp);
  browser.close();
});