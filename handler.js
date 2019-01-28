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
  
  const message = JSON.parse(event.Records[0].body);
  
  const s3 = new AWS.S3();
  const sqs = new AWS.SQS({ apiVersion: '2012-11-05', region: 'us-west-2' });
  
  const bucket = message.bucket;
  const jsonPath = decodeURIComponent(message.ruta.replace(/\+/g, " "));

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

    await page.pdf(pdfSettings);

    // Mato el browser

    await browser.close();

    // Pongo en el S3 el PDF con la ruta del JSON

    let uploadedPdfParams = {
      Body: fs.readFileSync('/tmp/expense.pdf'),
      Bucket: bucket,
      Key: jsonData.ruta
    };

    await s3.putObject(uploadedPdfParams).promise();

    let ACQueueUrl = "https://sqs.us-west-2.amazonaws.com/730404845529/qa_account_status_pdf_queue";

    let ACQueueParams = {
      MessageBody: JSON.stringify(message),
      QueueUrl: ACQueueUrl,
      DelaySeconds: 0,
    };

    await sqs.sendMessage(ACQueueParams).promise();

    // Dejo el console.log para que quede registro en CloudWatch
    console.log(jsonData.ruta);

    result = jsonData.ruta;

    // Fin de la funcion

  } catch (error) {
    return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return context.succeed(result);
};