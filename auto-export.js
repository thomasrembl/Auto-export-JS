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
    headless: false, // Activer l'interface graphique
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  // Vos données
  const url = process.env.URL;
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  // Sélecteurs
  const loginId = "#wp-submit";
  const usernameId = "#user_login";
  const passwordId = "#user_pass";
  const generateId = ".generate";
  const test = ".wrap"; // Remplacez par votre sélecteur de test

  let generateFound = false;

  try {
    // Naviguer vers la page WordPress
    await page.goto(`${url}/wp-login.php`);

    let loginTries = 0;
    while (!generateFound && loginTries < 3) {
      await page.type(usernameId, username);
      await page.type(passwordId, password);
      await page.click(loginId);

      try {
        await page.waitForSelector(test, { timeout: 1000 }); // Attendre que l'élément soit visible
        generateFound = true; // L'élément a été trouvé, sortir de la boucle
      } catch (error) {
        console.error("L'élément de test n'a pas été trouvé :", error);
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
        // Si l'élément est un dossier, créez-le dans le dossier cible
        await fs.promises.mkdir(targetItemPath);

        // Déplacez le contenu du dossier récursivement
        await moveContents(itemPath, targetItemPath);

        // Supprimez le dossier source une fois qu'il est vide
        await fs.promises.rmdir(itemPath);
      } else {
        // Si l'élément est un fichier, déplacez-le vers le dossier cible
        await rename(itemPath, targetItemPath);
      }
    }
  }

  async function checkAndMoveContents() {
    const sourceEmpty = await isFolderEmpty(sourceFolder);

    if (!sourceEmpty) {
      console.log("La copie va commencer");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      console.log("La copie commence");
      // Créez le dossier cible s'il n'existe pas
      if (!fs.existsSync(targetFolder)) {
        await fs.promises.mkdir(targetFolder);
      }

      // Déplacez le contenu du dossier source vers le dossier cible
      await moveContents(sourceFolder, targetFolder);

      // Supprimez le dossier source une fois qu'il est vide
      await fs.promises.rmdir(sourceFolder);
      await fs.promises.mkdir(sourceFolder);

      // Arrêtez la vérification périodique
      clearInterval(intervalId);

      // Affichez un message de fin
      console.log("Le déplacement est terminé. Le programme s'arrête.");
    }
  }

  // Mettez en place la vérification périodique toutes les 5 secondes
  const intervalId = setInterval(checkAndMoveContents, 5000);

  // Code qui s'exécute au démarrage du programme
  console.log(
    "Le programme a démarré. La vérification et le déplacement commencent..."
  );
}

runPuppeteer();
moveFiles();
