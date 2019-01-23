const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const AWS = require('aws-sdk');
const fs = require('fs-extra');
const { pdfSettings } = require('./src/pdfSettings');
const uuid4 = require('uuid4');

async function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.handler = async (event, context) => {
  let result = null;
  let browser = null;
  const s3 = new AWS.S3();
  const bucket = event.Records[0].s3.bucket.name // Con esto me traigo el bucket a donde tengo que dejar el pdf
  const jsonPath = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

  try {

    // Traigo el json

    const jsonFileS3Params = {
      Bucket: bucket,
      Key: jsonPath
    };

    let jsonData = await s3.getObject(jsonFileS3Params).promise();

    jsonData = JSON.parse(jsonData.Body.toString());

    // Traigo el html a traves del json

    const htmlFileS3Params = {
      Bucket: bucket,
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
      Key: jsonData.pdf_path
    };

    await s3.putObject(uploadedPdfParams).promise();

    // Borro el json

    await s3.deleteObject(jsonFileS3Params).promise();

    // Borro el html

    await s3.deleteObject(htmlFileS3Params).promise();

    // Llamo al lambda que va a mergear este pdf con el de account-status

    const lambda = new AWS.Lambda({
      apiVersion: '2015-03-31',
      region: 'us-west-2',
    })

    let lambdaParams = {
      FunctionName: process.env.MERGER_LAMBDA,
      InvocationType: 'Event',
      Payload: JSON.stringify({
        'Records': [
          {
            's3': {
              'bucket': {
                'name': bucket,
              },
              'object': {
                'key': jsonData.pdf_path,
              },
            },
          },
        ],
      }),
    }

    await lambda.invoke(lambdaParams).promise()

    // Actualizo DynamoDB

    // noinspection SpellCheckingInspection
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
      TableName: JSON.parse(process.env.DDB)[bucket] // lo mando al tabla de ddb correspondiente
    };

    await dynamodb.putItem(params).promise();

    console.log(jsonData.pdf_path)
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