const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const AWS = require('aws-sdk');
const fs = require('fs-extra');

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

    const data = fs.readFileSync('1.5.expense.html').toString();

    await page.goto(`data:text/html,${data}`, { waitUntil: 'networkidle2' });

    await page.pdf({
      path: '/tmp/expense.pdf',
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: {
        top: '30px',
        bottom: '60px',
        right: '30px',
        left: '30px',
      },
      headerTemplate: header_template,
      footerTemplate: footer_template
    });

    result = await page.title();

    const s3 = new AWS.S3();

    let params = {
      Body: fs.readFileSync('/tmp/expense.pdf'),
      Bucket: "app.octopus.dev",
      Key: "expense.pdf"
    };

    s3.putObject(params, (err) => {
      if (err) {
        throw err;
      }
    });

  } catch (error) {
    return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return context.succeed(result);
};