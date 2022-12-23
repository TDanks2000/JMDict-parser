import fs from "fs";
import xml2js from "xml2js";
import escape from "xml-escape";
import got from "got";
import gzip from "node-gzip";
import chalk from "chalk";
const { ungzip } = gzip;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import config from "../config.json" assert { type: "json" };
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const { log } = console;

const xmlParser = new xml2js.Parser();
const XML_IGNORE = '<>"';

const url = config.fileURL;
const filePath = config.downloadsFilePath;
const saveFilePath = config.saveFilePath;
const file = config.file;
const fileExt = config.fileExt;

const fileName = (date) => `${filePath}/${file}-${date}.${fileExt}`;

const getFileAndSave = async (date) => {
  //check if file exists with today's date and if so, exit
  if (fs.existsSync(fileName(date)))
    return log(chalk.yellow`File already exists, moving on...`);

  // fetch file
  log(chalk.bold.yellow`fetching file...`);
  const { body } = await got(url, {
    responseType: "buffer",
  });

  // unzip file
  log(chalk.yellow`unzipping file...`);
  const unzipped = await ungzip(body);

  // save file as xml
  log(chalk.bold.yellow`saving file...`);
  fs.writeFileSync(`${filePath}/${file}-${date}.${fileExt}`, unzipped, "utf8");
  log(chalk.bold.green`done getting file moving on....`);
};

const setupDict = (date) => {
  // Setting up dictionary
  log(chalk.cyan`setting up dictionary...`);
  return new Promise((resolve, reject) => {
    //read file
    log(chalk.green`reading file...`);
    fs.readFile(fileName(date), (err, rawData) => {
      if (err) {
        log(chalk.bold.red(err));
        process.exit(1);
      }
      //parse xml
      log(chalk.green`parsing...`);
      const data = escape(rawData.toString(), XML_IGNORE);

      xmlParser.parseString(data, (parseError, obj) => {
        if (parseError) reject(parseError);
        else resolve(obj.JMdict.entry);
      });
      log(chalk.bold.green`parsed!`);
    });
  });
};

//save dictionary to json file
const saveDict = async (dictionary, date) => {
  const outputFilename = `${saveFilePath}/${file}-${date}.json`;

  //check if file exists with today's date and if so, exit
  if (fs.existsSync(outputFilename))
    return log(chalk.green.bold`File already exists, finished...`);

  await fs.writeFileSync(
    outputFilename,
    JSON.stringify(dictionary),
    "utf8",
    (err) => {
      if (err) log(err);
      else log(chalk.bold.green`JSON saved to ${outputFilename}`);
    }
  );
};

//convert date to human readable format
const convertDate = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${day}-${month}-${year}`;
};

const cleanUpDownloads = async () => {
  const files = await fs.readdirSync(path.join(__dirname, "..", filePath));
  await files.forEach((file) => {
    if (file !== ".gitKeep" || file !== "README.md")
      return fs.unlinkSync(path.join(__dirname, "..", filePath, file));
  });
  log(chalk.bold.green`cleaned up downloads folder...`);
};

// check if file exists
const checkFile = async (filePath) => {
  return await fs.readdirSync(filePath).length;
};

(async () => {
  const date = new Date();
  const dateString = convertDate(date);
  const outputFilename = `${saveFilePath}/${file}-${dateString}.json`;

  //clean up downloads folder
  await cleanUpDownloads();
  return false;

  console.time(chalk.bold.green`finished in:`);
  log(chalk.green.bold("starting..."));
  await getFileAndSave(dateString);
  //check if file exists with today's date and if so, exit
  if (fs.existsSync(outputFilename)) {
    log(chalk.green.bold`File already exists, finished...`);
    console.log(await checkFile(path.join(__dirname, "..", saveFilePath)));
    return console.timeEnd(chalk.bold.green`finished in:`);
  } else {
    const dictionary = await setupDict(dateString);
    await saveDict(dictionary, dateString);
    log(chalk.green.bold("Finished..."));
    console.timeEnd(chalk.bold.green`finished in:`);
  }
})();
