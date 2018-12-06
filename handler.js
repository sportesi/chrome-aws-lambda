const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const AWS = require('aws-sdk');
const fs = require('fs-extra');
const { pdfSettings } = require('./src/pdfSettings');
const uuid4 = require('uuid4');

module.exports.handler = async (event, context) => {
  let result = null;
  let browser = null;
  const s3 = new AWS.S3();
  const jsonPath = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

  try {

    // Traigo el json

    const jsonFileS3Params = {
      Bucket: process.env.BUCKET,
      Key: jsonPath
    };

    let jsonData = await s3.getObject(jsonFileS3Params).promise();

    jsonData = JSON.parse(jsonData.Body.toString());

    // Traigo el html a traves del json

    const htmlFileS3Params = {
      Bucket: process.env.BUCKET,
      Key: `pdfs/expense-json-to-generate/${jsonData.html_filename}`
    };

    let html = await s3.getObject(htmlFileS3Params).promise();

    // Invoco el browser

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    let page = await browser.newPage();

    await page.goto(`data:text/html,${html.Body.toString()}`, {
      waitUntil: 'networkidle2'
    });

    // Creo el pdf

    await page.pdf(pdfSettings);

    // Mato el browser

    await browser.close();

    // Pongo en el S3 el PDF con la ruta del JSON

    let uploadedPdfParams = {
      Body: fs.readFileSync('/tmp/expense.pdf'),
      Bucket: process.env.BUCKET,
      Key: jsonData.pdf_path
    };

    await s3.putObject(uploadedPdfParams).promise();

    // Borro el json

    await s3.deleteObject(jsonFileS3Params).promise();

    // Borro el html

    await s3.deleteObject(htmlFileS3Params).promise();

    // Actualizo Dynamo

    const dynamodb = new AWS.DynamoDB({
      apiVersion: '2012-08-10',
      region: 'us-west-2',
    });

    let params = {
      Item: {
        "id": {
          S: uuid4()
        },
        "expense": {
          S: jsonData.expense,
        },
        "functional_unit_id": {
          S: jsonData.functional_unit_id
        },
        "pdf_path": {
          S: jsonData.pdf_path
        },
        "created_at": {
          S: jsonData.created_at
        },
        "pdf_type": {
          S: jsonData.pdf_type
        },
      },
      TableName: process.env.TABLE_NAME
    };

    await dynamodb.putItem(params).promise();

    result = jsonData.pdf_path;

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