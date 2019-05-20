const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const AWS = require('aws-sdk');
const fs = require('fs-extra');
const { pdfSettings } = require('./src/pdfSettings');

async function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.handler = async (event, context) => {
  let result = null;
  let browser = null;
  
  const s3 = new AWS.S3();
  
  const bucket = event.Bucket;
  const jsonPath = decodeURIComponent(event.Key.replace(/\+/g, " "));

  try {

    // Traigo el json
    const jsonFileS3Params = {
      Bucket: bucket,
      Key: jsonPath
    };

    let jsonData = await s3.getObject(jsonFileS3Params).promise();

    jsonData = JSON.parse(jsonData.Body.toString());

    // Traigo el html dentro del JSON
    let html = jsonData.html_expensa;

    // Invoco el browser
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    let page = await browser.newPage();

    await page.goto(`data:text/html,${html}`, {
      waitUntil: 'networkidle0'
    });

    await timeout(4000);

    await page.evaluate(() => { window.scrollBy(0, window.innerHeight); });

    await page.waitFor('*');

    // Creo el pdf

    if (!jsonData.leyenda_mis_expensas) {
      pdfSettings.footerTemplate = '<html><p>&nbsp;</p></html>'
    }

    await page.pdf(pdfSettings);

    // Mato el browser

    await browser.close();

    // Pongo en el S3 el PDF con la ruta del JSON

    let ruta_sin_prorrateo = jsonData.ruta  + '.sin-account-status.pdf';

    let uploadedPdfParams = {
      Body: fs.readFileSync('/tmp/expense.pdf'),
      Bucket: bucket,
      Key: ruta_sin_prorrateo
    };

    await s3.putObject(uploadedPdfParams).promise();

    result = { ruta_sin_prorrateo };

    // Fin de la funcion

  } catch (error) {
    return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return Object.assign(event, result);
};