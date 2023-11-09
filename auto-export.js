const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const util = require("util");
require("dotenv").config();

async function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const dateTimeString = `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
  return dateTimeString;
}

async function runPuppeteer() {
  const browser = await puppeteer.launch({
    // headless: false,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  // Données
  const url = process.env.URL;
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  // Sélecteurs
  const loginId = "#wp-submit";
  const usernameId = "#user_login";
  const passwordId = "#user_pass";
  const generateId = ".generate";
  const homepage = ".wrap";

  let generateFound = false;

  try {
    await page.goto(`${url}/wp-login.php`);

    let loginTries = 0;
    while (!generateFound && loginTries < 3) {
      await page.type(usernameId, username);
      await page.type(passwordId, password);
      await page.click(loginId);

      try {
        await page.waitForSelector(homepage, { timeout: 1000 });
        generateFound = true;
      } catch (error) {
        console.error("Erreur de connexion :", error);
        loginTries++;
        console.log("Tentative de connexion n°", loginTries);
      }
    }

    if (generateFound) {
      await page.goto(`${url}/wp-admin/admin.php?page=simply-static-generate`);
      await page.click(generateId);
    } else {
      console.error("Échec de la connexion après plusieurs tentatives.");
    }
  } catch (error) {
    console.error("Une erreur s'est produite :", error);
  } finally {
    await browser.close();
  }
}

async function moveFiles() {
  const sourceFolder = "download";
  const currentDateTime = await getCurrentDateTime();
  const targetFolder = `backup/${currentDateTime}`;

  const readdir = util.promisify(fs.readdir);
  const stat = util.promisify(fs.stat);
  const rename = util.promisify(fs.rename);

  async function isFolderEmpty(folderPath) {
    const items = await readdir(folderPath);
    return items.length === 0;
  }

  async function moveContents(sourcePath, targetPath) {
    const items = await readdir(sourcePath);

    for (const item of items) {
      const itemPath = path.join(sourcePath, item);
      const targetItemPath = path.join(targetPath, item);
      const itemStats = await stat(itemPath);

      if (itemStats.isDirectory()) {
        await fs.promises.mkdir(targetItemPath);

        await moveContents(itemPath, targetItemPath);

        await fs.promises.rmdir(itemPath);
      } else {
        await rename(itemPath, targetItemPath);
      }
    }
  }

  async function checkAndMoveContents() {
    const sourceEmpty = await isFolderEmpty(sourceFolder);

    if (!sourceEmpty) {
      console.log("La copie va commencer");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("La copie commence");

      if (!fs.existsSync(targetFolder)) {
        await fs.promises.mkdir(targetFolder);
      }

      await moveContents(sourceFolder, targetFolder);

      await fs.promises.rmdir(sourceFolder);
      await fs.promises.mkdir(sourceFolder);

      clearInterval(intervalId);

      console.log("Déplacement terminé.");
    }
  }

  const intervalId = setInterval(checkAndMoveContents, 5000);

  console.log("Le programme a démarré. détéction en cours ...");
}

runPuppeteer();
moveFiles();
