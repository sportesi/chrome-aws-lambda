cd home/node/
ls -l
npm i chrome-aws-lambda
l
git
git init
node --version
node handler.js 
node handler.js 
npm i puppeteer-core --save
node handler.js 
node handler.js 
npm remove puppeteer-core
npm i const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
exports.handler = async (event, context) => {
  let result = null;
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    let page = await browser.newPage();
    await page.goto(event.url || 'https://example.com');
    result = await page.title();
  } catch (error) {
    return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
  return context.succeed(result);
npm i chrome-aws-lambda --save
npm init -y
npm i chrome-aws-lambda --save
node handler.js 
npm i puppeteer-core --save
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
node handler.js 
