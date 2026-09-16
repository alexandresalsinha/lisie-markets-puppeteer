async function saveCookiesToFile(page, filePath) {
  try {
    // Getting the cookies from the current page
    const cookies = await page.cookies();

    // Writing the cookies to a file as JSON
    const fs = require('fs');
    fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));

    // Cookies have been saved successfully
    return true;
  } catch (error) {
    // An error occurred while saving cookies
    console.error('Error saving cookies:', error);
    return false;
  }
}

async function saveToFile(text, filePath) {
  try {
    // Writing the cookies to a file as JSON
    const fs = require('fs');
    fs.writeFileSync(filePath, JSON.stringify(text, null, 2));

    // Cookies have been saved successfully
    return true;
  } catch (error) {
    // An error occurred while saving cookies
    console.error('Error saving cookies:', error);
    return false;
  }
}

async function deleteFile(filePath) {
  try {
    // deleting file 
    const fs = require('fs');
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    // An error occurred while saving cookies
    console.error('Error deleting file:', error);
    return false;
  }
}

async function loadCookiesFromFile(page, filePath) {
  try {
    // Reading cookies from the specified file
    const fs = require('fs');
    const cookiesJson = fs.readFileSync(filePath, 'utf-8');
    const cookies = JSON.parse(cookiesJson);

    // Setting the cookies in the current page
    await page.setCookie(...cookies);
    // Cookies have been loaded successfully
    return true;
  } catch (error) {
    // An error occurred while loading cookies
    console.error('Error loading cookies:', error);
    return false;
  }
}

exports.saveCookiesToFile = async function (page, filePath) {
  return await saveCookiesToFile(page, filePath)
};

exports.loadCookiesFromFile = async function (page, filePath) {
  return await loadCookiesFromFile(page, filePath)
};


exports.saveToFile = async function (text, filePath) {
  return await saveToFile(text, filePath)
};


exports.deleteFile = async function (filePath) {
  return await deleteFile(filePath)
};
